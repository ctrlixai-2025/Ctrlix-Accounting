import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storageService } from '../services/storage';
import { googleSheetsService } from '../services/googleSheets';
import { analyzeReceipt } from '../services/gemini';
import { Role, Transaction, TransactionStatus, TransactionType, User } from '../types';
import { Camera, Save, ArrowLeft, Loader2, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react';

interface Props {
  user: User;
}

export const TransactionForm: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const categories = storageService.getCategories().filter(c => c.isActive);
  const projects = storageService.getProjects().filter(p => p.isActive);
  const paymentMethods = storageService.getPaymentMethods().filter(pm => pm.isActive);

  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    recordedById: user.id,
    amount: 0,
    summary: '',
    hasTaxId: false,
    paymentMethodId: paymentMethods[0]?.id || '',
    categoryId: categories[0]?.id || '',
    projectDeptId: projects[0]?.id || ''
  });

  useEffect(() => {
    if (id) {
      const tx = storageService.getTransactions().find(t => t.id === id);
      if (tx) {
        // Permission check
        if (user.role === Role.EMPLOYEE && tx.recordedById !== user.id) {
          alert('無權限編輯此記錄');
          navigate('/transactions');
          return;
        }
        setFormData(tx);
      }
    } else {
        // Set defaults for new transaction if lists are loaded
        setFormData(prev => ({
            ...prev,
            paymentMethodId: prev.paymentMethodId || paymentMethods[0]?.id || '',
            categoryId: prev.categoryId || categories[0]?.id || '',
            projectDeptId: prev.projectDeptId || projects[0]?.id || ''
        }));
    }
  }, [id, user, navigate]); // Removed dependencies on lists to prevent resets

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: name === 'amount' ? Number(value) : value
        }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, attachmentUrl: base64 }));
        
        // Auto-trigger Gemini analysis WITHOUT confirmation dialog
        setIsAnalyzing(true);
        const result = await analyzeReceipt(base64);
        setIsAnalyzing(false);
        
        if (result) {
          setFormData(prev => ({
            ...prev,
            date: result.date || prev.date,
            amount: result.amount || prev.amount,
            summary: result.summary || prev.summary,
            hasTaxId: result.hasTaxId !== undefined ? result.hasTaxId : prev.hasTaxId,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 1. Prepare Data
    const newTx: Transaction = {
      id: formData.id || `t_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: formData.date!,
      type: formData.type!,
      amount: Number(formData.amount),
      summary: formData.summary!,
      attachmentUrl: formData.attachmentUrl,
      hasTaxId: formData.hasTaxId || false,
      paymentMethodId: formData.paymentMethodId || paymentMethods[0]?.id,
      categoryId: formData.categoryId || categories[0]?.id,
      projectDeptId: formData.projectDeptId || projects[0]?.id,
      recordedById: formData.recordedById!,
      status: formData.status!,
      createdAt: formData.createdAt || Date.now()
    };

    // 2. Get readable names for Google Sheets
    const categoryName = categories.find(c => c.id === newTx.categoryId)?.name || 'Unknown';
    const projectName = projects.find(p => p.id === newTx.projectDeptId)?.name || 'Unknown';
    const methodName = paymentMethods.find(p => p.id === newTx.paymentMethodId)?.name || 'Unknown';

    // 3. Save to Local Storage immediately
    storageService.saveTransaction(newTx);

    // 4. Send to Google Sheets (Fire and Forget - do not await)
    // We don't await this so the UI is responsive.
    googleSheetsService.syncTransaction(newTx, user, categoryName, projectName, methodName);

    // 5. Navigate away immediately
    setTimeout(() => {
        setIsLoading(false);
        navigate('/transactions');
    }, 100); // Tiny delay to ensure local storage write
  };

  const handleDelete = async () => {
      if (!formData.id || !window.confirm('確定要刪除此筆記錄嗎？(此動作將同步刪除雲端資料)')) return;
      setIsLoading(true);

      // 1. Delete Locally
      storageService.deleteTransaction(formData.id);

      // 2. Delete from Cloud
      await googleSheetsService.deleteTransaction(formData.id);

      // 3. Navigate
      setTimeout(() => {
        setIsLoading(false);
        navigate('/transactions');
      }, 100);
  };

  const canDelete = () => {
    if (!id) return false; // Can't delete a new record
    if (user.role === Role.MANAGER) return true;
    if (user.role === Role.EMPLOYEE && formData.recordedById === user.id && formData.status === TransactionStatus.PENDING) return true;
    return false;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
            {id ? '編輯記錄' : '新增記錄'}
            </h2>
        </div>
        {canDelete() && (
            <button 
                type="button" 
                onClick={handleDelete}
                className="text-red-500 hover:text-red-700 p-2 rounded-lg flex items-center gap-1"
            >
                <Trash2 className="w-5 h-5" />
                <span className="text-sm font-medium">刪除</span>
            </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selection */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: TransactionType.EXPENSE }))}
            className={`py-3 rounded-xl font-bold transition-all ${
              formData.type === TransactionType.EXPENSE
                ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            支出 (Expense)
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: TransactionType.INCOME }))}
            className={`py-3 rounded-xl font-bold transition-all ${
              formData.type === TransactionType.INCOME
                ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            收入 (Income)
          </button>
        </div>

        {/* Receipt Upload */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              交易憑證 / 收據
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group relative overflow-hidden">
                {formData.attachmentUrl ? (
                  <img 
                    src={formData.attachmentUrl} 
                    alt="Receipt" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400 group-hover:text-blue-500">
                    <Camera className="w-8 h-8 mb-2" />
                    <span className="text-sm">拍照或上傳圖片</span>
                  </div>
                )}
                {/* Removed capture="environment" to allow gallery selection */}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="hidden" 
                />
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <Sparkles className="w-8 h-8 mb-2 animate-spin" />
                    <span className="text-sm font-bold">AI 正在辨識內容...</span>
                  </div>
                )}
              </label>
            </div>
            {formData.attachmentUrl && !isAnalyzing && (
                <p className="text-xs text-green-600 mt-2 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI 自動辨識完成
                </p>
            )}
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
            <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                <input
                type="number"
                name="amount"
                required
                min="0"
                value={formData.amount}
                onChange={handleInputChange}
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-lg font-bold text-gray-800"
                />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">摘要說明</label>
          <input
            type="text"
            name="summary"
            required
            placeholder="例如：客戶餐費、購買文具"
            value={formData.summary}
            onChange={handleInputChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          />
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">會計科目</label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">專案 / 部門</label>
            <select
              name="projectDeptId"
              value={formData.projectDeptId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
            <select
              name="paymentMethodId"
              value={formData.paymentMethodId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Boolean Tax ID Checkbox */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <input
                type="checkbox"
                id="hasTaxId"
                name="hasTaxId"
                checked={formData.hasTaxId}
                onChange={handleInputChange}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="hasTaxId" className="text-gray-700 font-medium select-none cursor-pointer">
                是否已報公司統編？
            </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-900 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              儲存中...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              確認儲存
            </>
          )}
        </button>
      </form>
    </div>
  );
};
