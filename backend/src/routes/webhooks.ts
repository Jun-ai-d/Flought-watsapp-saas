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
    if (process.env.NODE_ENV === 'production' && !appSecret) {
      throw new Error('FATAL: META_APP_SECRET must be set in production');
    }

    // Verify HMAC signature
    const signature = headers['x-hub-signature-256'];
    if (signature) {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret || 'flought-meta-test').update((req as any).rawBody || '').digest('hex');
      if (signature !== expectedSignature) {
        return res.status(401).send('Unauthorized: Invalid Signature');
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(401).send('Unauthorized: Missing Signature');
    }

    // Quick acknowledge to Meta so it doesn't retry
    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously
    await handleInboundWebhook('meta', headers, payload);
    
  } catch (error) {
    console.error('Error processing Meta webhook:', { error, trace_id: req.traceId });
  }
});

// Meta requires a GET endpoint for initial webhook URL verification
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (process.env.NODE_ENV === 'production' && !verifyToken) {
    console.error('FATAL: META_VERIFY_TOKEN must be set in production');
    return res.sendStatus(500);
  }
  
  if (mode === 'subscribe' && token === (verifyToken || 'flought-meta-test')) {
    console.log('WEBHOOK_VERIFIED', { trace_id: req.traceId });
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

export default router;
