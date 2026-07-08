import crypto from 'crypto';
import Razorpay from 'razorpay';

// The Shopify webhook HMAC validation logic extracted for unit testing
function validateShopifyWebhook(rawBody: string, webhookSecret: string, signatureHeader: string): boolean {
  if (!rawBody || !webhookSecret || !signatureHeader) return false;
  
  const genHash = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('base64');
    
  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(genHash);
  
  if (sigBuffer.length !== expectedBuffer.length) return false;
  
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

function validateMetaWebhook(rawBody: string, appSecret: string, signatureHeader: string): boolean {
  if (!rawBody || !appSecret || !signatureHeader) return false;
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const sigBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

describe('Security: Webhook Validation', () => {
  it('should validate a correct Shopify HMAC signature', () => {
    const rawBody = JSON.stringify({ order_id: 12345, status: 'paid' });
    const secret = 'super_secret_shopify_key_123';
    const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    expect(validateShopifyWebhook(rawBody, secret, validSignature)).toBe(true);
  });

  it('should reject an invalid Shopify HMAC signature', () => {
    const rawBody = JSON.stringify({ order_id: 12345, status: 'paid' });
    const secret = 'super_secret_shopify_key_123';
    const fakeSignature = Buffer.from('fake_signature').toString('base64');
    expect(validateShopifyWebhook(rawBody, secret, fakeSignature)).toBe(false);
  });

  it('should validate a correct Meta HMAC signature', () => {
    const rawBody = JSON.stringify({ entry: [] });
    const secret = 'meta_secret';
    const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(validateMetaWebhook(rawBody, secret, validSignature)).toBe(true);
  });

  it('should reject an invalid Meta HMAC signature', () => {
    const rawBody = JSON.stringify({ entry: [] });
    const secret = 'meta_secret';
    const fakeSignature = 'sha256=abcdef123456';
    expect(validateMetaWebhook(rawBody, secret, fakeSignature)).toBe(false);
  });

  it('should validate a correct Razorpay signature', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const secret = 'razorpay_secret';
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(Razorpay.validateWebhookSignature(body, signature, secret)).toBe(true);
  });
});
