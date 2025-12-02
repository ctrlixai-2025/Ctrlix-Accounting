import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storage';
import { googleSheetsService } from '../services/googleSheets';
import { Role, Transaction, TransactionStatus, User } from '../types';
import { Edit2, Search, Download, CheckCircle, Clock, BookOpen, Receipt, User as UserIcon, RefreshCw, ThumbsUp, CheckSquare, Trash2 } from 'lucide-react';

interface Props {
  user: User;
}

export const TransactionList: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  
  // Local state
  const [localTx, setLocalTx] = useState(storageService.getTransactions());
  // We don't render this state, but triggering a fetch updates localStorage for the Form to use
  const [_, setConfigVersion] = useState(0); 

  const categories = storageService.getCategories();
  const projects = storageService.getProjects();
  const paymentMethods = storageService.getPaymentMethods();
  const usersList = storageService.getUsers();

  const sync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    // 1. Fetch Transactions Status
    const cloudTxs = await googleSheetsService.fetchTransactions(user.id);
    if (cloudTxs && cloudTxs.length > 0) {
      const merged = storageService.mergeTransactions(cloudTxs);
      setLocalTx(merged);
    }

    // 2. Fetch Latest Categories (Silent Update)
    const cloudCats = await googleSheetsService.fetchCategories();
    if (cloudCats && cloudCats.length > 0) {
        storageService.updateCategoriesList(cloudCats);
    }

    // 3. Fetch Latest Projects (Silent Update)
    const cloudProjs = await googleSheetsService.fetchProjects();
    if (cloudProjs && cloudProjs.length > 0) {
        storageService.updateProjectsList(cloudProjs);
    }
    
    setConfigVersion(v => v + 1); // trigger re-render if needed
    setLastSyncTime(new Date().toLocaleTimeString());
    setIsSyncing(false);
  };

  // Auto Sync on Mount
  useEffect(() => {
    sync();
  }, [user.id]);

  const filteredData = useMemo(() => {
    let data = localTx; 
    
    if (user.role === Role.EMPLOYEE) {
      // Employees see their own records. 
      // We check by ID first, but if data was synced from cloud without ID map, we might need to rely on Name.
      // However, for viewing the list, 'recordedById' is usually set correctly during creation or merge.
      data = data.filter(t => t.recordedById === user.id || t.recordedByName === user.name);
    }

    if (filterStatus !== 'ALL') {
      data = data.filter(t => t.status === filterStatus);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(t => 
        t.summary.toLowerCase().includes(lower) || 
        t.amount.toString().includes(lower)
      );
    }

    return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [localTx, user, filterStatus, searchTerm]);

  const getCategoryName = (id: string, syncedName?: string) => {
      if (syncedName && id === 'synced') return syncedName;
      return categories.find(c => c.id === id)?.name || id;
  };
  
  const getProjectName = (id: string, syncedName?: string) => {
      if (syncedName && id === 'synced') return syncedName;
      return projects.find(p => p.id === id)?.name || id;
  };

  const getUserName = (id: string, syncedName?: string) => {
      if (syncedName) return syncedName;
      return usersList.find(u => u.id === id)?.name || '未知';
  };

  const handleExport = () => {
    const headers = ['Date', 'RecordedBy', 'Type', 'Amount', 'Summary', 'Category', 'Project', 'Status', 'HasTaxId'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(t => [
        t.date,
        getUserName(t.recordedById, t.recordedByName),
        t.type,
        t.amount,
        `"${t.summary}"`,
        getCategoryName(t.categoryId, t.categoryName),
        getProjectName(t.projectDeptId, t.projectName),
        t.status,
        t.hasTaxId ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleStatusUpdate = async (e: React.MouseEvent, tx: Transaction, newStatus: TransactionStatus) => {
      e.stopPropagation(); // Prevent opening edit modal
      if (!window.confirm(`確定要將狀態更新為「${newStatus === TransactionStatus.APPROVED ? '已審核' : '已入帳'}」嗎？`)) return;

      const updatedTx = { ...tx, status: newStatus };
      
      // 1. Update Local Storage
      storageService.saveTransaction(updatedTx);
      
      // 2. Update UI
      setLocalTx(prev => prev.map(t => t.id === tx.id ? updatedTx : t));

      // 3. Sync to Cloud
      // We need to fetch readable names again to ensure sync payload is complete
      const catName = getCategoryName(tx.categoryId, tx.categoryName);
      const projName = getProjectName(tx.projectDeptId, tx.projectName);
      const pmName = paymentMethods.find(p => p.id === tx.paymentMethodId)?.name || 'Unknown';
      
      // Note: This updates the log in Google Sheet. 
      // recordedByName will effectively become the Manager's name if we pass 'user', 
      // acting as an "Updated By" log.
      await googleSheetsService.syncTransaction(updatedTx, user, catName, projName, pmName);
  };

  const handleDelete = async (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    if (!window.confirm('確定要刪除此筆記錄嗎？(此動作將同步刪除雲端資料)')) return;

    // 1. Update Local Storage
    storageService.deleteTransaction(tx.id);
    
    // 2. Update UI
    setLocalTx(prev => prev.filter(t => t.id !== tx.id));

    // 3. Sync to Cloud (Fire delete command)
    await googleSheetsService.deleteTransaction(tx.id);
  };

  const canDelete = (tx: Transaction) => {
    if (user.role === Role.MANAGER) return true;
    if (user.role === Role.EMPLOYEE && tx.status === TransactionStatus.PENDING) {
        // Primary check: ID
        if (tx.recordedById === user.id) return true;
        // Fallback check: Name (Useful if data synced from cloud has different/missing ID structure)
        if (tx.recordedByName === user.name) return true;
    }
    return false;
  };

  const getStatusBadge = (status: TransactionStatus) => {
    switch(status) {
      case TransactionStatus.APPROVED:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/>已審核</span>;
      case TransactionStatus.BOOKED:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><BookOpen className="w-3 h-3 mr-1"/>已入帳</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/>待審核</span>;
    }
  };

  const getHasTaxIdBadge = (hasTaxId: boolean) => {
      if(hasTaxId) return <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 ml-2">統編</span>
      return null;
  }

  // Manager Action Buttons Component
  const ManagerActions = ({ tx }: { tx: Transaction }) => {
    if (user.role !== Role.MANAGER) return null;

    return (
      <div className="flex items-center gap-1">
        {tx.status === TransactionStatus.PENDING && (
          <button 
            onClick={(e) => handleStatusUpdate(e, tx, TransactionStatus.APPROVED)}
            className="flex items-center px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100 text-xs font-medium transition-colors"
            title="通過審核"
          >
            <ThumbsUp className="w-3 h-3 mr-1" /> 通過
          </button>
        )}
        {(tx.status === TransactionStatus.PENDING || tx.status === TransactionStatus.APPROVED) && (
          <button 
            onClick={(e) => handleStatusUpdate(e, tx, TransactionStatus.BOOKED)}
            className="flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100 text-xs font-medium transition-colors"
            title="確認入帳"
          >
            <CheckSquare className="w-3 h-3 mr-1" /> 入帳
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 md:space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 sticky top-0 bg-gray-50 z-10 pb-2">
        <div className="flex items-center gap-2 pl-1">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">{user.role === Role.MANAGER ? '審核清單' : '我的記錄'}</h2>
            <button 
                onClick={sync} 
                className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                disabled={isSyncing}
            >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? '更新中...' : '立即同步'}
            </button>
            {!isSyncing && lastSyncTime && <span className="text-[10px] text-gray-400 hidden sm:inline">({lastSyncTime})</span>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
           <div className="relative w-full sm:w-auto">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
             <input 
              type="text" 
              placeholder="搜尋摘要..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full shadow-sm"
             />
           </div>
           
           <select 
             className="px-4 py-2 border rounded-lg text-sm bg-white shadow-sm w-full sm:w-auto"
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
           >
             <option value="ALL">全部狀態</option>
             {Object.values(TransactionStatus).map(s => <option key={s} value={s}>{s}</option>)}
           </select>

           {user.role === Role.MANAGER && (
             <button onClick={handleExport} className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm transition-colors shadow-sm w-full sm:w-auto">
               <Download className="w-4 h-4 mr-2" />
               匯出
             </button>
           )}
        </div>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-3">
        {filteredData.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>尚無資料</p>
          </div>
        ) : (
          filteredData.map((tx) => (
            <div key={tx.id} className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 active:scale-[0.99] transition-transform" onClick={() => (user.role === Role.MANAGER || (user.role === Role.EMPLOYEE && tx.status === TransactionStatus.PENDING)) && navigate(`/edit/${tx.id}`)}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{tx.date}</span>
                <span className={`text-lg font-bold ${tx.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                  {tx.type === 'EXPENSE' ? '-' : '+'}${tx.amount.toLocaleString()}
                </span>
              </div>
              
              <div className="mb-3">
                <div className="flex items-center mb-1">
                    <h3 className="font-bold text-gray-800 line-clamp-1 text-lg mr-1">{tx.summary}</h3>
                    {getHasTaxIdBadge(tx.hasTaxId)}
                </div>
                <div className="flex items-center text-sm text-gray-500 gap-2 flex-wrap">
                    <span className="bg-gray-50 px-1.5 rounded">{getCategoryName(tx.categoryId, tx.categoryName)}</span>
                    <span className="text-gray-300">|</span>
                    <span className="bg-gray-50 px-1.5 rounded">{getProjectName(tx.projectDeptId, tx.projectName)}</span>
                </div>
              </div>

              {/* Show Recorder for Everyone */}
              <div className="mb-3 text-xs text-gray-500 flex items-center">
                  <UserIcon className="w-3 h-3 mr-1" />
                  填寫人: <span className="font-medium text-gray-700 ml-1">{getUserName(tx.recordedById, tx.recordedByName)}</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {getStatusBadge(tx.status)}
                  {user.role === Role.MANAGER && <ManagerActions tx={tx} />}
                </div>
                
                <div className="flex items-center gap-2">
                    {(user.role === Role.MANAGER || (user.role === Role.EMPLOYEE && tx.status === TransactionStatus.PENDING)) && (
                        <span className="text-sm text-blue-600 font-medium flex items-center bg-blue-50 px-2 py-1 rounded">
                            編輯 <Edit2 className="w-3 h-3 ml-1" />
                        </span>
                    )}
                    {canDelete(tx) && (
                        <button 
                            onClick={(e) => handleDelete(e, tx)}
                            className="flex items-center px-2 py-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100 text-xs font-medium"
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            刪除
                        </button>
                    )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Desktop View (Table) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">填寫人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目/專案</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                        {getUserName(tx.recordedById, tx.recordedByName)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="font-medium">{tx.summary}</span>
                        {getHasTaxIdBadge(tx.hasTaxId)}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${tx.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                      {tx.type === 'EXPENSE' ? '-' : '+'}${tx.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{getCategoryName(tx.categoryId, tx.categoryName)}</div>
                      <div className="text-xs text-gray-400">{getProjectName(tx.projectDeptId, tx.projectName)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(tx.status)}
                        {/* Quick Actions for Manager in Desktop Table */}
                        {user.role === Role.MANAGER && (
                           <ManagerActions tx={tx} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                            {(user.role === Role.MANAGER || (user.role === Role.EMPLOYEE && tx.status === TransactionStatus.PENDING)) && (
                                <button 
                                onClick={() => navigate(`/edit/${tx.id}`)}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full"
                                title="編輯詳情"
                                >
                                <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                            {canDelete(tx) && (
                                <button 
                                    onClick={(e) => handleDelete(e, tx)}
                                    className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full"
                                    title="刪除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
