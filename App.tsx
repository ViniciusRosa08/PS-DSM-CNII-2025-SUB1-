import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminVehicles from './pages/AdminVehicles';
import AdminCustomers from './pages/AdminCustomers';
import AdminRentals from './pages/AdminRentals';
import CustomerPortal from './pages/CustomerPortal';
import { initializeAzureResources } from './services/azure';

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactElement, requiredRole?: 'ADMIN' }) => {
    const role = localStorage.getItem('userRole');
    
    if (!role) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && role !== requiredRole) {
        return <Navigate to="/customer/browse" replace />; // Redirect non-admins
    }

    return children;
};

const App: React.FC = () => {
  
  useEffect(() => {
    // Attempt to create tables/containers on app load
    initializeAzureResources();
  }, []);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Admin Routes */}
          <Route path="/admin/vehicles" element={
              <ProtectedRoute requiredRole="ADMIN">
                  <AdminVehicles />
              </ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
               <ProtectedRoute requiredRole="ADMIN">
                  <AdminCustomers />
               </ProtectedRoute>
          } />
          <Route path="/admin/rentals" element={
               <ProtectedRoute requiredRole="ADMIN">
                  <AdminRentals />
               </ProtectedRoute>
          } />
          
          {/* Customer Routes */}
          <Route path="/customer/browse" element={<ProtectedRoute><CustomerPortal /></ProtectedRoute>} />
          <Route path="/customer/my-rentals" element={<ProtectedRoute><CustomerPortal /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute><CustomerPortal /></ProtectedRoute>} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;