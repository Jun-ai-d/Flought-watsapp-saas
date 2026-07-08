import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Server, Settings, LogOut, ArrowLeft, Menu, X, Users, CreditCard, Building, PlusCircle, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const AdminLayout: React.FC = () => {
  const { user, signOut, isPlatformAdmin } = useAuth();
  const { colorMode, setColorMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // If someone manually types /admin but isn't an admin, redirect them
  if (!isPlatformAdmin) {
    navigate('/dashboard');
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: "/admin", label: "Platform Overview", icon: Server },
    { path: "/admin/tenants", label: "Tenant Directory", icon: Building },
    { path: "/admin/provision", label: "Provision Tenant", icon: PlusCircle },
    { path: "/admin/billing", label: "Billing & Plans", icon: CreditCard },
    { path: "/admin/users", label: "Platform Users", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-theme-surface text-theme-text font-sans overflow-hidden relative">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-theme-bg border-r border-theme-border z-20 shrink-0 text-theme-text shadow-xl">
        <div className="h-16 flex items-center px-6 border-b border-theme-border gap-3 shrink-0 bg-theme-bg">
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center shadow-sm p-1">
            <img src="/logo.png" alt="Flought Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-theme-text truncate">
            Flought Admin
          </h1>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-thin">
          <div className="px-2 mb-2 text-xs font-bold text-theme-text-muted uppercase tracking-wider">
            Super Admin
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 border rounded",
                  isActive 
                    ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20 shadow-md" 
                    : "text-theme-text-muted border-transparent hover:border-theme-border hover:text-theme-text hover:bg-theme-surface-hover/50"
                )}
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <div className="mt-8">
            <div className="px-2 mb-2 text-xs font-bold text-theme-text-muted uppercase tracking-wider">
              Tenant Access
            </div>
            <Link
              to="/dashboard"
              className="flex items-center px-4 py-3 text-sm font-medium text-theme-text-muted border border-transparent rounded hover:border-theme-border hover:text-theme-text hover:bg-theme-surface-hover/50 transition-all duration-200"
            >
              <ArrowLeft className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">Back to Workspace</span>
            </Link>
          </div>
        </nav>

        {/* User / Logout */}
        <div className="p-4 border-t border-theme-border bg-theme-bg shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-10 h-10 rounded bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-theme-text truncate">
                Super Admin
              </p>
              <p className="text-xs text-theme-text-muted truncate mt-0.5">
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => setColorMode(colorMode === 'light' ? 'dark' : 'light')}
              className="p-2 text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover rounded transition-colors"
              title="Toggle Theme"
            >
              {colorMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-theme-text-muted border border-theme-border rounded hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen relative z-10 bg-theme-surface">
        
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-theme-bg border-b border-theme-border text-theme-text">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-brand-accent flex items-center justify-center text-theme-text font-bold text-lg">
              A
            </div>
            <span className="font-bold tracking-tight">Admin Portal</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setColorMode(colorMode === 'light' ? 'dark' : 'light')}
              className="p-2 text-theme-text-muted hover:text-theme-text"
            >
              {colorMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-theme-text-muted hover:text-theme-text">
              <Menu size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="md:hidden fixed inset-0 z-[60] bg-theme-bg text-theme-text flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-xl font-bold tracking-tight">Admin Menu</h2>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 rounded bg-theme-surface flex items-center justify-center text-theme-text-muted border border-theme-border"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center p-4 rounded border transition-all",
                      isActive 
                        ? "bg-brand-accent/10 border-brand-accent/20 text-brand-accent" 
                        : "bg-theme-surface border-theme-border text-theme-text-muted hover:border-brand-accent/50"
                    )}
                  >
                    <Icon className="mr-3 w-6 h-6" />
                    <span className="font-bold">{item.label}</span>
                  </Link>
                );
              })}

              <div className="my-6 h-px bg-theme-surface-hover" />

              <Link
                to="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center p-4 rounded bg-theme-surface border border-theme-border text-theme-text font-bold"
              >
                <ArrowLeft className="mr-3 w-6 h-6" />
                Back to Workspace
              </Link>
            </div>

            <div className="p-6 border-t border-theme-border">
               <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full px-4 py-3 font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded"
              >
                <LogOut className="mr-2 w-5 h-5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminLayout;
