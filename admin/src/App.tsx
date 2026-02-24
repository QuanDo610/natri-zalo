import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import DealersPage from './pages/DealersPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import ActivationsPage from './pages/ActivationsPage';
import UsersPage from './pages/UsersPage';

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('admin_token'),
  );
  const [role, setRole] = useState<string>(
    localStorage.getItem('admin_role') || '',
  );

  const handleLogin = (accessToken: string, userRole: string) => {
    setToken(accessToken);
    setRole(userRole);
    localStorage.setItem('admin_token', accessToken);
    localStorage.setItem('admin_role', userRole);
  };

  const handleLogout = () => {
    setToken(null);
    setRole('');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AdminLayout role={role} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/dealers" element={<DealersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/activations" element={<ActivationsPage />} />
        {role === 'ADMIN' && <Route path="/users" element={<UsersPage />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AdminLayout>
  );
}

export default App;
