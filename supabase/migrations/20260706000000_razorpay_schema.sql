-- Phase 12: Razorpay Payment Integration Schema Updates

-- Add razorpay customer mapping to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Add razorpay subscription ID to subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- Create an invoices table to track billing history
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    razorpay_invoice_id TEXT UNIQUE,
    amount_inr NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'cancelled')),
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can view their own invoices"
ON invoices FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- Note: Invoices are inserted/updated strictly via the backend Webhook (Admin client),
-- so we do not need INSERT/UPDATE policies for authenticated users.
