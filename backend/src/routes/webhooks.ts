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

export default router;
