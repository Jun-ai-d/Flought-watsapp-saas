import { Router } from 'express';
import { handleInboundWebhook } from '../services/messageHandler';
import { getBSPProvider } from '../bsp/providerFactory';
import crypto from 'crypto';

const router = Router();

// Endpoint to receive Meta webhooks
router.post('/meta', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;
    
    const appSecret = process.env.META_APP_SECRET;
    
    if (!appSecret) {
      if (process.env.SKIP_WEBHOOK_VERIFY !== 'true') {
        return res.status(500).json({ error: 'META_APP_SECRET is required. Set SKIP_WEBHOOK_VERIFY=true to bypass in dev.' });
      }
      console.warn('WARNING: META_APP_SECRET not set, skipping signature verification (SKIP_WEBHOOK_VERIFY=true)');
    }

    // Verify HMAC signature (only when META_APP_SECRET is configured)
    const signature = headers['x-hub-signature-256'];
    
    const rawBody = (req as any).rawBody;
    if (appSecret && signature) {
      if (!rawBody) {
        return res.status(400).send('Missing raw body for signature verification');
      }

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
  
  const verifyToken = process.env.META_VERIFY_TOKEN;
  
  if (!verifyToken) {
    return res.status(500).send('Server misconfigured: META_VERIFY_TOKEN not set');
  }
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK_VERIFIED', { trace_id: req.traceId });
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

export default router;
