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
const Signup = lazy(() => import('./pages/Signup'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

// Legal Pages
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'));



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
        <Route path="/signup" element={<Signup />} />
        <Route path="/showcase" element={<DesignShowcase />} />
        
        {/* Legal Routes */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/refund" element={<RefundPolicy />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
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
