import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, HelpCircle, FileText, Settings, CreditCard, LogOut, Shield, Megaphone, Users, Menu, X, MoreHorizontal, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WebChatWidget } from './WebChatWidget';

const Layout: React.FC = () => {
  const { user, tenant, signOut, isPlatformAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const { data: hasQuota = true } = useQuery({
    queryKey: ['quota', tenant?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('check_tenant_quota', { p_tenant_id: tenant!.id });
      if (error) return true; // fail open
      return data;
    },
    enabled: !!tenant?.id,
    refetchInterval: 60000 // Check every minute
  });

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/inbox", label: "Inbox", icon: MessageSquare },
    { path: "/faqs", label: "FAQs", icon: HelpCircle },
    { path: "/knowledge", label: "Knowledge Base", icon: FileText },
    { path: "/templates", label: "Templates", icon: LayoutDashboard }, // using LayoutDashboard for now
    { path: "/flows", label: "Flow Builder", icon: Zap },
    { path: "/contacts", label: "Contacts", icon: Users },
    { path: "/campaigns", label: "Campaigns", icon: Megaphone },
    { path: "/billing", label: "Usage & Billing", icon: CreditCard },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  // Mobile bottom bar core items (limit 4, plus a 'More' button)
  const mobileCoreNav = [
    { path: "/dashboard", label: "Home", icon: LayoutDashboard },
    { path: "/inbox", label: "Inbox", icon: MessageSquare },
    { path: "/contacts", label: "Contacts", icon: Users },
    { path: "/campaigns", label: "Campaigns", icon: Megaphone },
  ];

  return (
    <div className="flex h-screen bg-theme-bg text-theme-text overflow-hidden relative">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-theme-surface border-r border-theme-border z-20 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-theme-border gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm p-1 border border-theme-border">
            <img src="/favicon.svg" alt="Flought Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-theme-text truncate">
            {tenant?.business_name || 'Flought'}
          </h1>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 border",
                  isActive 
                    ? "bg-brand-accent text-white border-brand-accent shadow-md" 
                    : "text-theme-text-muted border-transparent hover:border-theme-border hover:text-theme-text hover:bg-theme-surface-hover"
                )}
                style={{ borderRadius: 'var(--radius-button)' }}
              >
                <Icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {isPlatformAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center px-4 py-3 mt-8 text-sm font-medium transition-all duration-200 border",
                location.pathname === "/admin"
                  ? "bg-purple-600 text-white border-purple-600 shadow-md" 
                  : "text-purple-600 border-transparent hover:border-purple-600 hover:bg-purple-600/10"
              )}
              style={{ borderRadius: 'var(--radius-button)' }}
            >
              <Shield className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">Platform Admin</span>
            </Link>
          )}
        </nav>

        {/* User / Logout */}
        <div className="p-4 border-t border-theme-border bg-theme-surface shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-theme-text truncate">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-theme-text-muted truncate mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-theme-text-muted border border-theme-border hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
            style={{ borderRadius: 'var(--radius-button)' }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen md:h-screen relative z-10">

        {hasQuota === false && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 text-xs md:text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate font-medium">
                <span className="md:hidden">Quota exceeded. Outbound paused.</span>
                <span className="hidden md:inline">Your workspace has exceeded its monthly message limit. Outbound messaging and AI features are suspended.</span>
              </span>
            </div>
            <Link to="/billing" className="font-bold whitespace-nowrap hover:underline shrink-0">
              Upgrade
            </Link>
          </div>
        )}

        {tenant?.plan_type === 'trial' && (
          <div className={cn(
            "border-b px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 text-xs md:text-sm",
            tenant.trial_conversations_used! >= tenant.trial_conversations_limit!
              ? "bg-red-500/10 border-red-500/20 text-red-600"
              : tenant.trial_conversations_used! >= tenant.trial_conversations_limit! * 0.8
                ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                : "bg-blue-500/10 border-blue-500/20 text-blue-700"
          )}>
            <div className="flex items-center gap-2 min-w-0">
              {tenant.trial_conversations_used! >= tenant.trial_conversations_limit! ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
              <span className="truncate font-medium">
                Free Trial: {tenant.trial_conversations_used}/{tenant.trial_conversations_limit} conversations used. 
                {new Date() > new Date(tenant.trial_expires_at!) ? " Trial expired." : ` Expires ${new Date(tenant.trial_expires_at!).toLocaleDateString()}.`}
              </span>
            </div>
            <Link to="/billing" className="font-bold whitespace-nowrap hover:underline shrink-0">
              Upgrade Now
            </Link>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Embedded Trial Web Widget */}
      <WebChatWidget />

      {/* Mobile Native Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-theme-surface border-t border-theme-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileCoreNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-full transition-colors",
                  isActive 
                    ? "text-brand-accent" 
                    : "text-theme-text-muted hover:text-theme-text"
                )}
              >
                <Icon size={22} className={cn("mb-1", isActive ? "scale-110 transition-transform" : "")} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full transition-colors text-theme-text-muted hover:text-theme-text",
              isMobileMenuOpen ? "text-theme-text" : ""
            )}
          >
            <MoreHorizontal size={22} className="mb-1" />
            <span className="text-[10px] font-medium tracking-wide">More</span>
          </button>
        </div>
      </div>

      {/* Mobile "More" Menu Fullscreen Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="md:hidden fixed inset-0 z-[60] bg-theme-bg flex flex-col"
          >
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-theme-border bg-theme-surface">
              <h2 className="text-xl md:text-2xl font-display font-bold text-theme-text">Menu</h2>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-theme-surface-hover flex items-center justify-center text-theme-text border border-theme-border"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 md:p-6 rounded-2xl md:rounded-3xl border transition-all",
                        isActive 
                          ? "bg-brand-accent/10 border-brand-accent text-brand-accent shadow-sm" 
                          : "bg-theme-surface border-theme-border text-theme-text hover:border-brand-accent/50"
                      )}
                    >
                      <Icon className="mb-2 md:mb-3 w-6 h-6 md:w-7 md:h-7" />
                      <span className="text-xs md:text-sm font-bold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {isPlatformAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-4 flex items-center p-4 rounded-2xl bg-purple-600/10 border border-purple-600/20 text-purple-500 font-bold"
                >
                  <Shield className="mr-3" />
                  Platform Admin
                </Link>
              )}
            </div>

            <div className="p-4 md:p-6 bg-theme-surface border-t border-theme-border">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-lg md:text-xl">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-bold text-theme-text text-sm md:text-base">{user?.email?.split('@')[0] || 'User'}</p>
                  <p className="text-xs text-theme-text-muted">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-3 md:py-4 rounded-xl md:rounded-2xl bg-red-500/10 text-red-500 font-bold border border-red-500/20 flex items-center justify-center text-sm md:text-base"
              >
                <LogOut className="mr-2 w-4 h-4 md:w-5 md:h-5" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Layout;
