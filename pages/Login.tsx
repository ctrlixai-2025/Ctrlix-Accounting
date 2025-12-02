import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { googleSheetsService } from '../services/googleSheets';
import { Role, User } from '../types';
import { ShieldCheck, User as UserIcon, Lock, Loader2, RefreshCw } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load local users first
    setUsers(storageService.getUsers());
    
    // Attempt to fetch from cloud
    const syncUsers = async () => {
      setIsSyncing(true);
      const cloudUsers = await googleSheetsService.fetchUsers();
      if (cloudUsers && cloudUsers.length > 0) {
        storageService.updateUsersList(cloudUsers);
        setUsers(cloudUsers);
      }
      setIsSyncing(false);
    };
    
    // Delay slightly to not block initial render
    setTimeout(syncUsers, 500);
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Unified Login Logic:
    // Check if input matches Name + Password (Employee) OR Password-only matches Admin
    
    // 1. Try finding by Name + Password
    let targetUser = users.find(u => 
      u.name.trim().toLowerCase() === username.trim().toLowerCase() && 
      u.password === password
    );

    // 2. If not found, and username is empty (Manager mode shortcut? No, user requested just login)
    // Actually, user said: "I don't need manager login separate."
    // So everyone logs in with Name + Password.
    // If it's the default admin (id: admin), name might be '系統管理員' or whatever is in sheet.
    
    // Fallback: Check if user is trying to use the default local admin if sheet is empty
    if (!targetUser && username === 'admin' && password === 'admin888') {
       targetUser = users.find(u => u.id === 'admin');
    }

    if (targetUser) {
      onLogin(targetUser);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-[#01203F] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden flex flex-col min-h-[450px] justify-center">
        
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

          <div className="mt-4 flex items-center justify-center text-xs text-gray-400 gap-1">
             {isSyncing ? (
               <>
                 <RefreshCw className="w-3 h-3 animate-spin" />
                 <span>正在更新雲端人員名單...</span>
               </>
             ) : (
               <span>人員名單已同步</span>
             )}
          </div>
        </div>
        
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-5 z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-white opacity-5 z-0 pointer-events-none"></div>
      </div>
    </div>
  );
};