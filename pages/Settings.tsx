import React, { useState } from 'react';
import { storageService } from '../services/storage';
import { Category, ProjectDept, TransactionType } from '../types';
import { Trash2, Plus, Save } from 'lucide-react';

export const Settings: React.FC = () => {
  const [categories, setCategories] = useState(storageService.getCategories());
  const [projects, setProjects] = useState(storageService.getProjects());
  const [googleScriptUrl, setGoogleScriptUrl] = useState(storageService.getGoogleScriptUrl());
  
  // Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);
  
  // Project State
  const [newProjName, setNewProjName] = useState('');

  const handleSaveGoogleUrl = () => {
    storageService.saveGoogleScriptUrl(googleScriptUrl);
    alert('設定已儲存');
  };

  // --- Category Logic ---
  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: `c_${Date.now()}`,
      name: newCatName,
      type: newCatType,
      isActive: true
    };
    const updated = [...categories, newCat];
    setCategories(updated);
    storageService.saveCategories(updated);
    setNewCatName('');
  };

  const deleteCategory = (id: string) => {
    if(!window.confirm('確定要刪除此科目嗎？(僅建議刪除未使用過的科目)')) return;
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    storageService.saveCategories(updated);
  };

  const toggleCategory = (id: string) => {
    const updated = categories.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    setCategories(updated);
    storageService.saveCategories(updated);
  };

  // --- Project Logic ---
  const addProject = () => {
    if (!newProjName.trim()) return;
    const newProj: ProjectDept = {
      id: `p_${Date.now()}`,
      name: newProjName,
      isActive: true
    };
    const updated = [...projects, newProj];
    setProjects(updated);
    storageService.saveProjects(updated);
    setNewProjName('');
  };

  const deleteProject = (id: string) => {
    if(!window.confirm('確定要刪除此專案/部門嗎？(僅建議刪除未使用過的專案)')) return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    storageService.saveProjects(updated);
  };

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-gray-800">系統設定</h2>

      {/* Google Sheets Sync */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-green-500">
        <h3 className="text-lg font-bold mb-4 text-green-800">Google Sheet 雲端設定</h3>
        <p className="text-sm text-gray-600 mb-2">
          所有員工帳號與記帳資料皆同步至 Google Sheet。<br/>
          請在 Google Sheet 的 <b>Users</b> 分頁管理員工帳號，在 <b>Transactions</b> 分頁審核帳務。
        </p>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={googleScriptUrl}
            onChange={(e) => setGoogleScriptUrl(e.target.value)}
            placeholder="請輸入 Apps Script 網址 (https://script.google.com/...)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={handleSaveGoogleUrl} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center flex-shrink-0">
            <Save className="w-4 h-4 mr-1" /> 儲存連結
          </button>
        </div>
      </div>

      {/* Categories Section */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          會計科目管理
        </h3>
        
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input 
            type="text" 
            placeholder="新科目名稱" 
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-3 text-sm"
          />
          <div className="flex gap-2">
            <select 
              value={newCatType} 
              onChange={e => setNewCatType(e.target.value as TransactionType)}
              className="border rounded-lg px-3 py-3 text-sm bg-white"
            >
              <option value={TransactionType.EXPENSE}>支出</option>
              <option value={TransactionType.INCOME}>收入</option>
            </select>
            <button onClick={addCategory} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5" />
              <span className="md:hidden ml-1">新增</span>
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`flex-shrink-0 px-2 py-1 rounded text-xs font-bold ${cat.type === 'EXPENSE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {cat.type === 'EXPENSE' ? '支' : '收'}
                </span>
                <span className={`truncate font-medium ${!cat.isActive ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {cat.name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => toggleCategory(cat.id)}
                  className={`text-xs px-2 py-1 rounded border ${cat.isActive ? 'border-green-200 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400 bg-gray-100'}`}
                >
                  {cat.isActive ? '啟用中' : '已停用'}
                </button>
                <button 
                  onClick={() => deleteCategory(cat.id)}
                  className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-bold mb-4">專案/部門管理</h3>
        
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="新專案或部門名稱" 
            value={newProjName}
            onChange={e => setNewProjName(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-3 text-sm"
          />
          <button onClick={addProject} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-shrink-0">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {projects.map(proj => (
            <div key={proj.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
              <span className={`font-medium ${!proj.isActive ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {proj.name}
              </span>
              <button 
                onClick={() => deleteProject(proj.id)}
                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 flex-shrink-0 transition-colors"
                title="刪除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};