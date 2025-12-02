import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TransactionList } from './pages/TransactionList';
import { TransactionForm } from './pages/TransactionForm';
import { Settings } from './pages/Settings';
import { storageService } from './services/storage';
import { Role, User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isInit, setIsInit] = useState(true);

  useEffect(() => {
    const savedUser = storageService.getCurrentUser();
    if (savedUser) setUser(savedUser);
    setIsInit(false);
  }, []);

  const handleLogin = (u: User) => {
    storageService.setCurrentUser(u);
    setUser(u);
  };

  const handleLogout = () => {
    storageService.setCurrentUser(null);
    setUser(null);
  };

  if (isInit) return null; // or a loading spinner

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/transactions" replace />} />
          
          <Route path="/transactions" element={<TransactionList user={user} />} />
          <Route path="/new" element={<TransactionForm user={user} />} />
          <Route path="/edit/:id" element={<TransactionForm user={user} />} />

          {/* Manager Only Routes */}
          {user.role === Role.MANAGER && (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/transactions" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;