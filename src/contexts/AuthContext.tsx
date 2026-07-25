/**
 * Authentication & Tenant Context
 * 
 * This file is the core identity provider for the entire React application.
 * It tracks three distinct things:
 * 1. Is the user logged in? (session, user)
 * 2. Which business do they belong to? (tenant, role) — supports multi-membership
 * 3. Are they a Flought employee? (isPlatformAdmin)
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const ACTIVE_TENANT_KEY = 'flought_active_tenant_id';

interface TenantContext {
  id: string;
  business_name: string;
  role: 'admin' | 'agent';
  plan_type?: string;
  trial_expires_at?: string;
  trial_conversations_used?: number;
  trial_conversations_limit?: number;
  ai_settings?: {
    welcome_message_type: 'fixed' | 'llm';
    fixed_welcome_message: string;
    system_prompt: string;
  };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenant: TenantContext | null;
  /** All tenant memberships for the signed-in user (may be empty). */
  tenants: TenantContext[];
  /** Switch active tenant when the user belongs to more than one. */
  switchTenant: (tenantId: string) => void;
  isPlatformAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapMembership(row: any): TenantContext | null {
  const t = row?.tenants;
  if (!t?.id) return null;
  return {
    id: t.id,
    business_name: t.business_name,
    role: row.role as 'admin' | 'agent',
    plan_type: t.plan_type,
    trial_expires_at: t.trial_expires_at,
    trial_conversations_used: t.trial_conversations_used,
    trial_conversations_limit: t.trial_conversations_limit,
    ai_settings: t.ai_settings,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [tenants, setTenants] = useState<TenantContext[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const switchTenant = (tenantId: string) => {
    const next = tenants.find((t) => t.id === tenantId);
    if (!next) return;
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    setTenant(next);
  };

  const fetchTenantContext = async (userId: string) => {
    const { data, error } = await supabase
      .from('tenant_users')
      .select(
        'role, tenants (id, business_name, plan_type, trial_expires_at, trial_conversations_used, trial_conversations_limit, ai_settings)'
      )
      .eq('user_id', userId);

    const memberships = (data ?? [])
      .map(mapMembership)
      .filter((m): m is TenantContext => m !== null);

    if (error || memberships.length === 0) {
      setTenants([]);
      setTenant(null);
    } else {
      setTenants(memberships);
      const preferredId = localStorage.getItem(ACTIVE_TENANT_KEY);
      const preferred =
        (preferredId && memberships.find((m) => m.id === preferredId)) || memberships[0];
      localStorage.setItem(ACTIVE_TENANT_KEY, preferred.id);
      setTenant(preferred);
    }

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/admin/check`, {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        if (res.ok) {
          const body = await res.json();
          setIsPlatformAdmin(!!body.isPlatformAdmin);
        } else {
          setIsPlatformAdmin(false);
        }
      }
    } catch {
      setIsPlatformAdmin(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchTenantContext(initialSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setLoading(true);
        fetchTenantContext(nextSession.user.id).finally(() => setLoading(false));
      } else {
        setTenant(null);
        setTenants([]);
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
    <AuthContext.Provider
      value={{
        session,
        user,
        tenant,
        tenants,
        switchTenant,
        isPlatformAdmin,
        loading,
        signOut,
      }}
    >
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
