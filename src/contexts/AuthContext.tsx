/**
 * Authentication & Tenant Context
 * 
 * This file is the core identity provider for the entire React application.
 * It tracks three distinct things:
 * 1. Is the user logged in? (session, user)
 * 2. Which business do they belong to? (tenant, role)
 * 3. Are they a Flought employee? (isPlatformAdmin)
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// Represents the business that the current user is employed by
interface TenantContext {
  id: string;
  business_name: string;
  role: 'admin' | 'agent';
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenant: TenantContext | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  
  // If true, the sidebar will render a special "Platform Admin" button allowing 
  // Flought employees to provision new tenants.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches the user's business association from Postgres.
   * Also makes a secure call to the Node.js backend to verify if this user
   * is a Super Admin. We do NOT rely on client-side state for actual security,
   * this is purely to toggle UI rendering.
   */
  const fetchTenantContext = async (userId: string) => {
    // 1. Find which business this user works for
    const { data, error } = await supabase
      .from('tenant_users')
      .select('role, tenants (id, business_name)')
      .eq('user_id', userId)
      .single();

    if (data && data.tenants && !error) {
      setTenant({
        id: (data.tenants as any).id,
        business_name: (data.tenants as any).business_name,
        role: data.role as 'admin' | 'agent'
      });
    } else {
      setTenant(null);
    }

    // 2. Check Platform Admin status via the secure Express backend
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/admin/check`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setIsPlatformAdmin(!!data.isPlatformAdmin);
        } else {
          setIsPlatformAdmin(false);
        }
      }
    } catch (e) {
      setIsPlatformAdmin(false);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTenantContext(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchTenantContext(session.user.id).finally(() => setLoading(false));
      } else {
        setTenant(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, tenant, isPlatformAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
