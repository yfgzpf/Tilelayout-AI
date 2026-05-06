import React from 'react';
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

function App() {
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
      <Route path="/project/new" element={<ProjectEdit />} />
      <Route path="/project/:id" element={<ProjectEdit />} />
      <Route path="/project/preview" element={<LayoutPreview />} />
      <Route path="/confirmation" element={<ConfirmationPreview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
