import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { SpeedInsights } from '@vercel/speed-insights/react';
// Marketing Pages
const MarketingLayout = lazy(() => import('./components/MarketingLayout'));
const Home = lazy(() => import('./pages/marketing/Home'));
const Features = lazy(() => import('./pages/marketing/Features'));
const Pricing = lazy(() => import('./pages/marketing/Pricing'));

// Dashboard Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inbox = lazy(() => import('./pages/Inbox'));
const FAQManager = lazy(() => import('./pages/FAQManager'));
const KnowledgeBaseManager = lazy(() => import('./pages/KnowledgeBaseManager'));
const TemplateManager = lazy(() => import('./pages/TemplateManager'));
const FlowBuilder = lazy(() => import('./pages/FlowBuilder'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DesignShowcase = lazy(() => import('./pages/DesignShowcase'));

// Admin Pages
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminTenants = lazy(() => import('./pages/admin/AdminTenants'));
const AdminProvisioning = lazy(() => import('./pages/admin/AdminProvisioning'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));

// Legal Pages
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'));
const DataDeletion = lazy(() => import('./pages/legal/DataDeletion'));

const LoadingSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00B2FF]"></div>
  </div>
);

function App() {
  return (
    <>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Marketing Routes */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
        </Route>
        
        {/* Public Routes (No Layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/showcase" element={<DesignShowcase />} />
        
        {/* Legal Routes */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/refund" element={<RefundPolicy />} />
        <Route path="/data-deletion" element={<DataDeletion />} />

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/faqs" element={<FAQManager />} />
            <Route path="/knowledge" element={<KnowledgeBaseManager />} />
            <Route path="/templates" element={<TemplateManager />} />
            <Route path="/flows" element={<FlowBuilder />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="provision" element={<AdminProvisioning />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
    <SpeedInsights />
    </>
  );
}

export default App;
