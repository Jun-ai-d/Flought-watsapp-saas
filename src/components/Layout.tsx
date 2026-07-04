import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, HelpCircle, FileText, Settings, CreditCard, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const Layout: React.FC = () => {
  const { user, tenant, signOut, isPlatformAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/inbox", label: "Inbox", icon: MessageSquare },
    { path: "/faqs", label: "FAQs", icon: HelpCircle },
    { path: "/knowledge", label: "Knowledge Base", icon: FileText },
    { path: "/templates", label: "Templates", icon: LayoutDashboard },
    { path: "/billing", label: "Usage & Billing", icon: CreditCard },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F5F5F0]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r-2 border-[#E5E5E5] flex flex-col">
        <div className="h-16 flex items-center px-6 border-b-2 border-[#E5E5E5]">
          <h1 className="text-xl font-bold font-display tracking-tight text-[#1A1A1A]">
            Flought
          </h1>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 border-2",
                  isActive 
                    ? "bg-[#C1440E] text-white border-[#C1440E]" 
                    : "text-[#666666] border-transparent hover:border-[#1A1A1A] hover:text-[#1A1A1A] hover:bg-gray-50"
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          {isPlatformAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center px-4 py-3 mt-8 text-sm font-medium transition-all duration-200 border-2",
                location.pathname === "/admin"
                  ? "bg-purple-600 text-white border-purple-600" 
                  : "text-purple-600 border-transparent hover:border-purple-600 hover:bg-purple-50"
              )}
            >
              <Shield className="mr-3 h-5 w-5" />
              Platform Admin
            </Link>
          )}
        </nav>

        <div className="p-4 border-t-2 border-[#E5E5E5]">
          <div className="px-4 py-3 mb-2">
            <p className="text-sm font-medium text-[#1A1A1A] truncate">
              {tenant?.business_name || 'My Business'}
            </p>
            <p className="text-xs text-[#666666] truncate mt-1">
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-[#DC2626] border-2 border-transparent hover:border-[#DC2626] hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
