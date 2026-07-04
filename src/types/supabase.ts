export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agent_invitations: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: 'admin' | 'agent'
          status: 'pending' | 'processed' | 'failed'
          error_details: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          role?: 'admin' | 'agent'
          status?: 'pending' | 'processed' | 'failed'
          error_details?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          role?: 'admin' | 'agent'
          status?: 'pending' | 'processed' | 'failed'
          error_details?: string | null
          created_at?: string
        }
      }
      tenants: {
        Row: {
          id: string
          business_name: string
          vertical: string | null
          region: string
          tier: 'standard' | 'vip'
          status: 'onboarding' | 'active' | 'suspended' | 'churned'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_name: string
          vertical?: string | null
          region?: string
          tier?: 'standard' | 'vip'
          status?: 'onboarding' | 'active' | 'suspended' | 'churned'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_name?: string
          vertical?: string | null
          region?: string
          tier?: 'standard' | 'vip'
          status?: 'onboarding' | 'active' | 'suspended' | 'churned'
          created_at?: string
          updated_at?: string
        }
      }
      tenant_users: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: 'admin' | 'agent'
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          role?: 'admin' | 'agent'
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          role?: 'admin' | 'agent'
          created_at?: string
        }
      }
      tenant_bsp_config: {
        Row: {
          id: string
          tenant_id: string
          bsp_provider: 'gupshup' | 'twilio' | '360dialog' | 'telnyx'
          waba_id: string
          phone_number_id: string
          access_token_encrypted: string
          webhook_verify_token: string
          tier: 'standard' | 'vip'
          region: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          bsp_provider: 'gupshup' | 'twilio' | '360dialog' | 'telnyx'
          waba_id: string
          phone_number_id: string
          access_token_encrypted: string
          webhook_verify_token: string
          tier?: 'standard' | 'vip'
          region?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          bsp_provider?: 'gupshup' | 'twilio' | '360dialog' | 'telnyx'
          waba_id?: string
          phone_number_id?: string
          access_token_encrypted?: string
          webhook_verify_token?: string
          tier?: 'standard' | 'vip'
          region?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          tenant_id: string
          serial_number: number
          customer_phone: string
          customer_name: string | null
          status: 'bot' | 'handover_pending' | 'handover_active' | 'resolved'
          assigned_agent_id: string | null
          last_customer_message_at: string | null
          last_message_at: string
          service_window_expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          serial_number?: number
          customer_phone: string
          customer_name?: string | null
          status?: 'bot' | 'handover_pending' | 'handover_active' | 'resolved'
          assigned_agent_id?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string
          service_window_expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          serial_number?: number
          customer_phone?: string
          customer_name?: string | null
          status?: 'bot' | 'handover_pending' | 'handover_active' | 'resolved'
          assigned_agent_id?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string
          service_window_expires_at?: string | null
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          tenant_id: string
          direction: 'inbound' | 'outbound'
          message_type: 'text' | 'image' | 'document' | 'audio' | 'template' | 'interactive'
          content: string | null
          media_url: string | null
          transcript: string | null
          category: 'marketing' | 'utility' | 'authentication' | 'service' | null
          wa_message_id: string | null
          sender: 'customer' | 'bot' | 'agent' | null
          llm_model_used: string | null
          retrieved_chunk_ids: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          tenant_id: string
          direction: 'inbound' | 'outbound'
          message_type: 'text' | 'image' | 'document' | 'audio' | 'template' | 'interactive'
          content?: string | null
          media_url?: string | null
          transcript?: string | null
          category?: 'marketing' | 'utility' | 'authentication' | 'service' | null
          wa_message_id?: string | null
          sender?: 'customer' | 'bot' | 'agent' | null
          llm_model_used?: string | null
          retrieved_chunk_ids?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          tenant_id?: string
          direction?: 'inbound' | 'outbound'
          message_type?: 'text' | 'image' | 'document' | 'audio' | 'template' | 'interactive'
          content?: string | null
          media_url?: string | null
          transcript?: string | null
          category?: 'marketing' | 'utility' | 'authentication' | 'service' | null
          wa_message_id?: string | null
          sender?: 'customer' | 'bot' | 'agent' | null
          llm_model_used?: string | null
          retrieved_chunk_ids?: string[] | null
          created_at?: string
        }
      }
      faqs: {
        Row: {
          id: string
          tenant_id: string
          question: string
          answer: string
          keywords: string[] | null
          match_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          question: string
          answer: string
          keywords?: string[] | null
          match_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          question?: string
          answer?: string
          keywords?: string[] | null
          match_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      knowledge_documents: {
        Row: {
          id: string
          tenant_id: string
          source_name: string
          uploaded_by: string | null
          status: 'processing' | 'ready' | 'failed'
          uploaded_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          source_name: string
          uploaded_by?: string | null
          status?: 'processing' | 'ready' | 'failed'
          uploaded_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          source_name?: string
          uploaded_by?: string | null
          status?: 'processing' | 'ready' | 'failed'
          uploaded_at?: string
        }
      }
      knowledge_chunks: {
        Row: {
          id: string
          document_id: string
          tenant_id: string
          content: string
          embedding: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          tenant_id: string
          content: string
          embedding?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          tenant_id?: string
          content?: string
          embedding?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          tenant_id: string
          plan: string
          cap_messages: number
          price_inr: number
          status: 'active' | 'past_due' | 'cancelled'
          renewed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          plan: string
          cap_messages: number
          price_inr: number
          status?: 'active' | 'past_due' | 'cancelled'
          renewed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          plan?: string
          cap_messages?: number
          price_inr?: number
          status?: 'active' | 'past_due' | 'cancelled'
          renewed_at?: string
          created_at?: string
        }
      }
      usage_tracking: {
        Row: {
          id: string
          tenant_id: string
          billing_period: string
          messages_sent: number
          llm_calls: number
          stt_minutes: number
          overage_count: number
          overage_charge_inr: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          billing_period: string
          messages_sent?: number
          llm_calls?: number
          stt_minutes?: number
          overage_count?: number
          overage_charge_inr?: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          billing_period?: string
          messages_sent?: number
          llm_calls?: number
          stt_minutes?: number
          overage_count?: number
          overage_charge_inr?: number
          created_at?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          tenant_id: string | null
          actor_user_id: string | null
          action: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          actor_user_id?: string | null
          action: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          actor_user_id?: string | null
          action?: string
          details?: Json
          created_at?: string
        }
      }
      platform_admins: {
        Row: {
          id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_tenant_member: {
        Args: {
          check_tenant_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: {
          check_tenant_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
