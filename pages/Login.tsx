import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { googleSheetsService } from '../services/googleSheets';
import { Role, User } from '../types';
import { ShieldCheck, User as UserIcon, Lock, Loader2, RefreshCw, Settings, Save, X } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');

  useEffect(() => {
    // Load local users first
    setUsers(storageService.getUsers());
    setGoogleUrl(storageService.getGoogleScriptUrl());
    
    // Attempt to fetch from cloud if URL exists
    if (storageService.getGoogleScriptUrl()) {
      syncUsers();
    }
  }, []);

  const syncUsers = async () => {
    setIsSyncing(true);
    const cloudUsers = await googleSheetsService.fetchUsers();
    if (cloudUsers && cloudUsers.length > 0) {
      storageService.updateUsersList(cloudUsers);
      setUsers(cloudUsers);
    }
    setIsSyncing(false);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Try finding by Name + Password
    let targetUser = users.find(u => 
      u.name.trim().toLowerCase() === username.trim().toLowerCase() && 
      u.password === password
    );

    // Fallback: Check if user is trying to use the default local admin if sheet is empty or connection failed
    if (!targetUser && username === 'admin' && password === 'admin888') {
       targetUser = users.find(u => u.id === 'admin');
       // If local admin doesn't exist in the list (rare), create a temp one
       if (!targetUser) {
         targetUser = { id: 'admin', name: '系統管理員', role: Role.MANAGER, avatar: '', password: 'admin888' };
       }
    }

    if (targetUser) {
      onLogin(targetUser);
    } else {
      setError('帳號或密碼錯誤 (若剛設定完網址，請等待下方名單同步完成)');
    }
  };

  const handleSaveSettings = () => {
    storageService.saveGoogleScriptUrl(googleUrl);
    setShowSettings(false);
    syncUsers(); // Retry fetching users immediately
  };

  return (
    <div className="min-h-screen bg-[#01203F] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden flex flex-col min-h-[450px] justify-center">
        
        {/* Settings Toggle (Top Left) */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 z-20 p-2"
          title="設定連線"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="text-center mb-8 relative z-10">
           <div className="flex justify-center mb-4">
              <img 
                 src="/logo.png" 
                 alt="Ctrlix" 
                 className="h-16 w-auto object-contain"
                 onError={(e) => {
                   e.currentTarget.style.display = 'none';
                   e.currentTarget.nextElementSibling?.classList.remove('hidden');
                 }}
              />
              <div className="hidden inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full text-blue-600 shadow-sm">
                 <ShieldCheck className="w-8 h-8" />
              </div>
           </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">科睿思公司記帳系統</h1>
          <p className="text-gray-500 text-xs uppercase tracking-widest">Ctrlix ACCOUNTING</p>
        </div>

        {showSettings ? (
          <div className="relative z-10 animate-in fade-in zoom-in duration-300 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-700">設定連線網址</h3>
              <button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-gray-500"/></button>
            </div>
            <p className="text-xs text-gray-500 mb-2">請貼上 Google Apps Script 發布網址以同步人員名單：</p>
            <input
              type="text"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://script.google.com/..."
              className="w-full border rounded p-2 text-sm mb-3"
            />
            <button 
              onClick={handleSaveSettings}
              className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> 儲存並同步
            </button>
          </div>
        ) : (
          <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="請輸入姓名 (帳號)"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  required
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 mt-2"
              >
                登入系統
              </button>
            </form>

            <div className="mt-4 flex items-center justify-center text-xs text-gray-400 gap-1 h-5">
               {isSyncing ? (
                 <>
                   <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                   <span className="text-blue-500">正在更新雲端人員名單...</span>
                 </>
               ) : (
                 users.length > 0 ? <span>人員名單已同步 ({users.length} 人)</span> : <span>尚未設定連線或無人員資料</span>
               )}
            </div>
          </div>
        )}
        
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-white opacity-5 z-0 pointer-events-none"></div>
      </div>
    </div>
  );
};
