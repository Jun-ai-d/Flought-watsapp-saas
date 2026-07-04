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
    const verifyToken = process.env.GUPSHUP_VERIFY_TOKEN || 'default-token';
    if (!provider.verifyWebhookAuth(headers, verifyToken)) {
      return res.status(401).send('Unauthorized');
    }
    
    // Quick acknowledge to the BSP so it doesn't retry
    res.status(200).send('OK');

    // Process asynchronously (Gupshup async model)
    await handleInboundWebhook('gupshup', headers, payload);
    
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
});

// Endpoint to receive Meta webhooks
router.post('/meta', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;
    
    // Quick acknowledge to Meta so it doesn't retry
    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously
    await handleInboundWebhook('meta', headers, payload);
    
  } catch (error) {
    console.error('Error processing Meta webhook:', error);
  }
});

// Meta requires a GET endpoint for initial webhook URL verification
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const verifyToken = process.env.META_VERIFY_TOKEN || 'flought-meta-test';
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

export default router;
