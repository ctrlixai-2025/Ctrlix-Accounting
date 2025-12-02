import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Role, User } from '../types';
import { 
  LogOut, 
  Menu, 
  X, 
  PieChart, 
  List, 
  PlusCircle, 
  Settings, 
  User as UserIcon 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const isActive = location.pathname === to;
    return (
      <button
        onClick={() => {
          navigate(to);
          setIsMobileMenuOpen(false);
        }}
        className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          isActive 
            ? 'bg-blue-50 text-blue-700' 
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Icon className="w-5 h-5 mr-3" />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm h-14">
        <div className="flex items-center gap-2">
           {/* Logo Image: Expects logo.png in public folder */}
           <img 
             src="/logo.png" 
             alt="Logo" 
             className="h-8 w-auto object-contain" 
             onError={(e) => e.currentTarget.style.display = 'none'}
           />
           <div className="font-bold text-lg text-blue-900">Ctrlix Accounting</div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar / Mobile Drawer */}
      <div className={`
        fixed inset-0 z-10 bg-gray-800/50 md:hidden transition-opacity
        ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `} onClick={() => setIsMobileMenuOpen(false)} />

      <div className={`
        fixed inset-y-0 left-0 z-20 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:h-screen sticky top-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b hidden md:block">
            <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-8 w-auto object-contain" 
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
              “科睿思公司記帳系統”
            </h1>
          </div>

          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full border" />
              <div className="overflow-hidden">
                <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 uppercase">{user.role === Role.MANAGER ? '管理員' : '員工'}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {user.role === Role.MANAGER && (
              <NavItem to="/dashboard" icon={PieChart} label="報表中心" />
            )}
            <NavItem to="/transactions" icon={List} label={user.role === Role.MANAGER ? "審核清單" : "我的記錄"} />
            <NavItem to="/new" icon={PlusCircle} label="新增記錄" />
            
            {user.role === Role.MANAGER && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">管理</p>
                </div>
                <NavItem to="/settings" icon={Settings} label="系統設定" />
              </>
            )}
          </nav>

          <div className="p-4 border-t">
            <button 
              onClick={onLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="w-5 h-5 mr-3" />
              登出系統
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
        {/* Adjusted padding: pt-1 (mobile) to bring content up */}
        <div className="container mx-auto px-4 pt-1 md:pt-4 pb-20 max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
};