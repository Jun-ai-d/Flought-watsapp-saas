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
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server misconfigured: META_APP_SECRET not set' });
      } else {
        console.warn('WARNING: META_APP_SECRET not set, skipping signature verification in dev');
      }
    }

    // Verify HMAC signature (only when META_APP_SECRET is configured)
    const signature = headers['x-hub-signature-256'];
    
    const rawBody = (req as any).rawBody;
    if (appSecret && signature) {
      if (!rawBody) {
        return res.status(400).send('Missing raw body for signature verification');
      }
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.error(`Webhook signature mismatch. Expected: ${expectedSignature}, Got: ${signature}`);
        return res.status(401).send('Invalid signature');
      }
    } else if (appSecret && !signature) {
      return res.status(401).send('Missing signature');
    }

    // Quick acknowledge to Meta so it doesn't retry
    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously
    await handleInboundWebhook('meta', headers, payload);
    
  } catch (error: any) {
    console.error('Error processing Meta webhook:', { error, trace_id: req.traceId });
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
