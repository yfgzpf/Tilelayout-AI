import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectEdit from './pages/ProjectEdit';
import LayoutPreview from './pages/LayoutPreview';
import ConfirmationPreview from './pages/ConfirmationPreview';
import UpgradePage from './pages/UpgradePage';
import ContactPage from './pages/ContactPage';
import TextureLibrary from './pages/TextureLibrary';
import ProductManager from './pages/ProductManager';
import StoreProfilePage from './pages/StoreProfilePage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import UserProfilePage from './pages/UserProfilePage';
import { api } from './services/api';
import { useAppStore } from './store';

function App() {
  const { setUser } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    if (token) {
      api.setToken(token);
      if (userId) {
        setUser({
          id: userId,
          phone: '',
          isMember: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        api.get<any>('/users/me').then((resp) => {
          const userData = resp?.data || resp;
          if (userData) {
            setUser({
              id: userId,
              phone: userData.phone || '',
              isMember: userData.is_member ?? userData.isMember ?? false,
              memberUntil: userData.member_until ? new Date(userData.member_until) : undefined,
              storeProfile: userData.store_profile ? {
                userId: userId,
                storeName: userData.store_profile.store_name || '',
                phone: userData.store_profile.phone || '',
                address: userData.store_profile.address || '',
                logoUrl: userData.store_profile.logo_url,
                updatedAt: new Date(),
              } : undefined,
              createdAt: new Date(userData.created_at || Date.now()),
              updatedAt: new Date(userData.updated_at || Date.now()),
            });
          }
        }).catch(() => {});
      }
    }
  }, [setUser]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/upgrade" element={<UpgradePage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/textures" element={<TextureLibrary />} />
      <Route path="/products" element={<ProductManager />} />
      <Route path="/store/profile" element={<StoreProfilePage />} />
      <Route path="/orders" element={<OrderListPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
      <Route path="/user/profile" element={<UserProfilePage />} />
      <Route path="/project/new" element={<ProjectEdit />} />
      <Route path="/project/:id" element={<ProjectEdit />} />
      <Route path="/project/preview" element={<LayoutPreview />} />
      <Route path="/confirmation" element={<ConfirmationPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
