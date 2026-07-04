import { Router } from 'express';
import { handleInboundWebhook } from '../services/messageHandler';

const router = Router();

// Endpoint to receive Gupshup webhooks
router.post('/gupshup', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers;
    
    // Quick acknowledge to the BSP so it doesn't retry
    res.status(200).send('OK');

    // Process asynchronously (Gupshup async model)
    await handleInboundWebhook('gupshup', headers, payload);
    
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
});

export default router;
