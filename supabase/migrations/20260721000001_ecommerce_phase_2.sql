-- Phase 2: E-Commerce Automation Schema

-- 1. E-Commerce Integrations
CREATE TABLE IF NOT EXISTS ecommerce_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'custom')),
    store_domain TEXT NOT NULL,
    access_token_encrypted TEXT,
    webhook_secret_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_ecom_tenant ON ecommerce_integrations(tenant_id);

ALTER TABLE ecommerce_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's ecommerce integrations"
ON ecommerce_integrations FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. Abandoned Carts
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform_cart_id TEXT NOT NULL,
    customer_phone TEXT,
    cart_url TEXT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recovered', 'abandoned', 'message_sent')),
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform_cart_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_tenant ON abandoned_carts(tenant_id);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant's abandoned carts"
ON abandoned_carts FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Order Confirmations (For COD flows)
CREATE TABLE IF NOT EXISTS order_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform_order_id TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    is_cod BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'timeout')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON order_confirmations(tenant_id);

ALTER TABLE order_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant's order confirmations"
ON order_confirmations FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));
