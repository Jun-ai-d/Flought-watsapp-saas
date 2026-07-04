import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const DesignShowcase = lazy(() => import('./pages/DesignShowcase'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inbox = lazy(() => import('./pages/Inbox'));
const FAQManager = lazy(() => import('./pages/FAQManager'));
const KnowledgeBaseManager = lazy(() => import('./pages/KnowledgeBaseManager'));
const TemplateManager = lazy(() => import('./pages/TemplateManager'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

import './App.css';

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C1440E]"></div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/showcase" element={<DesignShowcase />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/faqs" element={<FAQManager />} />
            <Route path="/knowledge" element={<KnowledgeBaseManager />} />
            <Route path="/templates" element={<TemplateManager />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
