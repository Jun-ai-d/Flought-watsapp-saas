import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = Router();

// Initialize Razorpay instance
// In production, these should be securely stored in process.env
const rzpKeyId = process.env.RAZORPAY_KEY_ID;
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (process.env.NODE_ENV === 'production' && (!rzpKeyId || !rzpKeySecret)) {
  console.warn('WARNING: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing. Using mock keys in production.');
}

const razorpay = new Razorpay({
  key_id: rzpKeyId || 'rzp_test_mock_key',
  key_secret: rzpKeySecret || 'rzp_test_mock_secret',
});

// Route: Create a new subscription checkout session
router.post('/create-subscription', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { plan_id } = req.body; // e.g. "plan_abc123"

  try {
    // 1. Get the tenant details
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('business_name, razorpay_customer_id')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    let customerId = tenant.razorpay_customer_id;

    // 2. Create Razorpay Customer if it doesn't exist
    if (!customerId) {
      // In a real app, you would pass the tenant's primary email/contact
      const customer = await razorpay.customers.create({
        name: tenant.business_name,
        notes: {
          tenant_id: tenantId
        }
      });
      customerId = customer.id;

      // Update tenant with the new customer ID
      await supabaseAdmin
        .from('tenants')
        .update({ razorpay_customer_id: customerId })
        .eq('id', tenantId);
    }

    // 3. Create Subscription (Mock plan ID for now if none provided)
    const targetPlanId = plan_id || process.env.RAZORPAY_STANDARD_PLAN_ID || 'plan_Oxxxxxxxxx';
    
    // Check if we are running without real keys to prevent crashing
    if (process.env.RAZORPAY_KEY_ID === undefined) {
      return res.json({ 
        subscription_id: 'sub_mock_123', 
        short_url: 'https://rzp.io/i/mockUrl',
        mock: true 
      });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: targetPlanId,
      customer_id: customerId,
      total_count: 12, // 1 year billing cycle
      notes: {
        tenant_id: tenantId
      }
    } as any) as any;

    res.json({
      subscription_id: subscription.id,
      short_url: subscription.short_url,
      status: subscription.status
    });

  } catch (error: any) {
    console.error('Error creating Razorpay subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Webhook to receive events from Razorpay (like payment success)
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (process.env.NODE_ENV === 'production' && !secret) {
    console.error('FATAL: RAZORPAY_WEBHOOK_SECRET missing in production');
    return res.status(500).json({ error: 'Configuration Error' });
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  const body = (req as any).rawBody || JSON.stringify(req.body);

  if (!signature) {
    return res.status(400).send('Missing signature');
  }

  // Use the secret if available, otherwise fallback to the dev mock secret
  const activeSecret = secret || 'flought_secret';

  try {
    const isValid = Razorpay.validateWebhookSignature(body, signature, activeSecret);
    if (!isValid) {
      console.error('Razorpay webhook signature mismatch');
      return res.status(400).send('Invalid signature');
    }
  } catch (err) {
    console.error('Error validating Razorpay signature:', err);
    return res.status(400).send('Invalid signature format');
  }

  const event = req.body.event;
  const payload = req.body.payload;

  try {
    switch (event) {
      case 'subscription.charged': {
        const sub = payload.subscription.entity;
        const payment = payload.payment.entity;
        const tenantId = sub.notes?.tenant_id;

        if (tenantId) {
          // Record Invoice
          await supabaseAdmin.from('invoices').insert({
            tenant_id: tenantId,
            razorpay_invoice_id: payment.invoice_id,
            amount_inr: payment.amount / 100, // Amount is in paise
            status: 'paid',
            billing_period_start: new Date(sub.current_start * 1000).toISOString(),
            billing_period_end: new Date(sub.current_end * 1000).toISOString()
          });

          // Update Subscription Status
          await supabaseAdmin.from('subscriptions').upsert({
            tenant_id: tenantId,
            razorpay_subscription_id: sub.id,
            status: 'active',
            plan: 'standard', // Parse from Razorpay or keep sync
            price_inr: payment.amount / 100,
            cap_messages: 1500
          }, { onConflict: 'tenant_id' });
        }
        break;
      }
      
      case 'subscription.halted':
      case 'subscription.cancelled': {
        const sub = payload.subscription.entity;
        const tenantId = sub.notes?.tenant_id;
        
        if (tenantId) {
          await supabaseAdmin.from('subscriptions')
            .update({ status: 'cancelled' })
            .eq('tenant_id', tenantId);
        }
        break;
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
