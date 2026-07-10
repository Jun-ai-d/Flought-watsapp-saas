import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, HelpCircle, FileText, Settings, CreditCard, LogOut, Shield, Megaphone, Users, Menu, X, MoreHorizontal, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WebChatWidget } from '../WebChatWidget';

const MobileLayout: React.FC = () => {
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
    { path: "/templates", label: "Templates", icon: LayoutDashboard }, 
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen relative z-10">

        {/* Mobile Header (replaces sidebar branding) */}
        <div className="h-14 flex items-center px-4 bg-theme-surface border-b border-theme-border shrink-0 justify-between">
          <div className="flex items-center gap-3">
             <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm p-1 border border-theme-border">
              <img src="/logo.png" alt="Flought Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-bold font-display tracking-tight text-theme-text truncate">
              {tenant?.business_name || 'Flought'}
            </h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-sm shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        {hasQuota === false && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate font-medium">Quota exceeded. Outbound paused.</span>
            </div>
            <Link to="/billing" className="font-bold whitespace-nowrap hover:underline shrink-0">
              Upgrade
            </Link>
          </div>
        )}

        {tenant?.plan_type === 'trial' && (
          <div className={cn(
            "border-b px-4 py-2 flex items-center justify-between gap-3 shrink-0 text-xs",
            tenant.trial_conversations_used! >= tenant.trial_conversations_limit!
              ? "bg-red-500/10 border-red-500/20 text-red-600"
              : tenant.trial_conversations_used! >= tenant.trial_conversations_limit! * 0.8
                ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                : "bg-blue-500/10 border-blue-500/20 text-blue-700"
          )}>
            <div className="flex items-center gap-2 min-w-0">
              {tenant.trial_conversations_used! >= tenant.trial_conversations_limit! ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
              <span className="truncate font-medium">
                {tenant.trial_conversations_used}/{tenant.trial_conversations_limit} msgs used.
              </span>
            </div>
            <Link to="/billing" className="font-bold whitespace-nowrap hover:underline shrink-0">
              Upgrade
            </Link>
          </div>
        )}
        
        {/* Adjusted padding: pb-24 ensures content isn't hidden behind the bottom tab bar */}
        <div className={cn("flex-1 overflow-y-auto pb-24", location.pathname.startsWith('/inbox') ? "p-0" : "p-4")}>
          <Outlet />
        </div>
      </main>

      {/* Embedded Trial Web Widget */}
      <WebChatWidget />

      {/* Mobile Native Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-theme-surface border-t border-theme-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {mobileCoreNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
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
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full transition-colors",
              isMobileMenuOpen ? "text-brand-accent" : "text-theme-text-muted hover:text-theme-text"
            )}
          >
            {isMobileMenuOpen ? <X size={22} className="mb-1" /> : <MoreHorizontal size={22} className="mb-1" />}
            <span className="text-[10px] font-medium tracking-wide">{isMobileMenuOpen ? 'Close' : 'More'}</span>
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
            className="fixed inset-0 z-40 bg-theme-bg flex flex-col pt-14 pb-20"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all shadow-sm",
                        isActive 
                          ? "bg-brand-accent/10 border-brand-accent text-brand-accent" 
                          : "bg-theme-surface border-theme-border text-theme-text hover:border-brand-accent/50"
                      )}
                    >
                      <Icon className="mb-2 w-6 h-6" />
                      <span className="text-xs font-bold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {isPlatformAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-4 flex items-center p-4 rounded-2xl bg-purple-600/10 border border-purple-600/20 text-purple-600 font-bold shadow-sm"
                >
                  <Shield className="mr-3" />
                  Platform Admin
                </Link>
              )}
            </div>

            <div className="p-4 bg-theme-surface border-t border-theme-border shrink-0">
              <button
                onClick={handleLogout}
                className="w-full py-3.5 rounded-xl bg-red-50 text-red-600 font-bold border border-red-100 flex items-center justify-center text-sm shadow-sm"
              >
                <LogOut className="mr-2 w-5 h-5" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MobileLayout;
