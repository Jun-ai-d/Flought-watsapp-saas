import { Router } from 'express';
import { handleInboundWebhook } from '../services/messageHandler';
import { getBSPProvider } from '../bsp/providerFactory';

const router = Router();

// Endpoint to receive Gupshup webhooks
router.post('/gupshup', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;
    
    const provider = getBSPProvider('gupshup');
    const verifyToken = process.env.GUPSHUP_VERIFY_TOKEN;
    if (process.env.NODE_ENV === 'production' && !verifyToken) {
      throw new Error('FATAL: GUPSHUP_VERIFY_TOKEN must be set in production');
    }
    
    if (!provider.verifyWebhookAuth(headers, verifyToken || 'default-token')) {
      return res.status(401).send('Unauthorized');
    }
    
    // Quick acknowledge to the BSP so it doesn't retry
    res.status(200).send('OK');

    // Process asynchronously (Gupshup async model)
    await handleInboundWebhook('gupshup', headers, payload);
    
  } catch (error) {
    console.error('Error processing webhook:', { error, trace_id: req.traceId });
  }
});

// Endpoint to receive Meta webhooks
router.post('/meta', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;
    
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.warn('WARNING: META_APP_SECRET not set, skipping signature verification');
    }

    // Verify HMAC signature (only when META_APP_SECRET is configured)
    const signature = headers['x-hub-signature-256'];
    
    if (appSecret && signature) {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update((req as any).rawBody || '').digest('hex');
      if (signature !== expectedSignature) {
        const { supabaseAdmin } = require('../lib/supabase');
        try {
          await supabaseAdmin.from('contacts').insert({
            tenant_id: '486ecee1-ce4b-40de-b3f8-788de913f98a',
            phone_number: 'DEBUG_SIG_FAIL_' + Date.now(),
            name: `Expected: ${expectedSignature}, Got: ${signature}`,
            notes: `Raw body length: ${((req as any).rawBody || '').length}`
          });
        } catch (e) { console.error(e); }
        
        return res.status(401).send('Unauthorized: Invalid Signature');
      }
    }

    // Quick acknowledge to Meta so it doesn't retry
    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously
    // Log success to DB for debugging
    const { supabaseAdmin } = require('../lib/supabase');
    try {
      await supabaseAdmin.from('contacts').insert({
        tenant_id: '486ecee1-ce4b-40de-b3f8-788de913f98a',
        phone_number: 'DEBUG_SUCCESS_' + Date.now(),
        name: 'Webhook passed verification',
        notes: `Payload: ${JSON.stringify(payload)}`
      });
    } catch (e) { console.error(e); }

    await handleInboundWebhook('meta', headers, payload);
    
  } catch (error: any) {
    console.error('Error processing Meta webhook:', { error, trace_id: req.traceId });
    // Log error to DB for debugging
    const { supabaseAdmin } = require('../lib/supabase');
    try {
      await supabaseAdmin.from('contacts').insert({
        tenant_id: '486ecee1-ce4b-40de-b3f8-788de913f98a',
        phone_number: 'DEBUG_ERROR_' + Date.now(),
        name: error.message || 'Unknown error',
        notes: error.stack
      });
    } catch (e) { console.error(e); }
  }
});

// Meta requires a GET endpoint for initial webhook URL verification
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const verifyToken = process.env.META_VERIFY_TOKEN || 'flought-meta-test';
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK_VERIFIED', { trace_id: req.traceId });
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

export default router;
