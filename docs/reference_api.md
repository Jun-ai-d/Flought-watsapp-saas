# API Reference: Webhooks & Endpoints

**Document Type:** Reference
**Target Audience:** Backend Developers & Integration Partners
**Goal:** Provide an authoritative, information-oriented dictionary of the available API endpoints, their expected payloads, and security mechanisms.

---

## 1. Webhook Endpoints

The system exposes public webhook endpoints to receive asynchronous events from third-party Business Solution Providers (BSPs) and external services.

### 1.1 Inbound WhatsApp Webhook (Meta)
Receives real-time updates from Meta about incoming WhatsApp messages, message status updates (sent, delivered, read), and template approvals.

- **Endpoint:** `POST /api/webhooks/meta`
- **Security:** HMAC SHA-256 signature verification.
- **Headers Required:**
  - `x-hub-signature-256`: `sha256={hmac_hash}`
- **Verification Logic:** The payload is hashed using `META_APP_SECRET`. The request is rejected (401) if the hash does not match `x-hub-signature-256` using `crypto.timingSafeEqual`.

#### Expected Payload (Message Received)
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "display_phone_number": "123", "phone_number_id": "456" },
            "contacts": [{ "profile": { "name": "User" }, "wa_id": "789" }],
            "messages": [
              {
                "from": "789",
                "id": "wamid.HBg...",
                "timestamp": "1710000000",
                "type": "text",
                "text": { "body": "Hello!" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### 1.2 Shopify Webhook
Receives events from Shopify (e.g., `orders/create`, `checkouts/update`) to trigger automated WhatsApp notifications to customers.

- **Endpoint:** `POST /api/integrations/shopify/webhook`
- **Query Parameters:** `?tenant_id=UUID` (Required to map the event to the correct tenant).
- **Security:** HMAC SHA-256 signature verification.
- **Headers Required:**
  - `x-shopify-hmac-sha256`: `{base64_hmac_hash}`
  - `x-shopify-topic`: e.g., `orders/create`
- **Verification Logic:** The raw payload is hashed using the tenant's specific `webhook_secret` from the `shopify_settings` table. Rejected (401) on mismatch.

### 1.3 Razorpay Webhook
Receives payment events to automatically update SaaS subscription statuses.

- **Endpoint:** `POST /api/billing/webhook`
- **Security:** Signature verification using official SDK.
- **Headers Required:**
  - `x-razorpay-signature`: `{hmac_hash}`
- **Verification Logic:** Verified using `Razorpay.validateWebhookSignature(body, signature, RAZORPAY_WEBHOOK_SECRET)`.

---

## 2. Internal Frontend APIs

These endpoints are called by the React/Next.js frontend dashboard and require active user authentication.

### Authentication Middleware
All internal APIs are protected by the `requireTenantMember` middleware.
- **Header:** `Authorization: Bearer <Supabase JWT>`
- **Logic:** Extracts the user ID from the JWT and queries `tenant_members` to ensure the user has access to the requested `tenantId`.

### 2.1 Outbound Messaging
Used by human agents in the dashboard to manually reply to users.

- **Endpoint:** `POST /api/outbound/send`
- **Payload:**
```json
{
  "tenantId": "UUID",
  "contactPhone": "1234567890",
  "messageText": "Hello from support!"
}
```
- **Behavior:** Fetches the tenant's active BSP config, dynamically loads the provider (Meta/Gupshup), and dispatches the message. Automatically marks the conversation's `human_handover` status back to false if the agent closes the ticket.

### 2.2 Template Submission
Used to create and submit new WhatsApp templates to Meta for approval.

- **Endpoint:** `POST /api/templates/submit`
- **Payload:**
```json
{
  "tenantId": "UUID",
  "name": "seasonal_promo",
  "language": "en_US",
  "category": "MARKETING",
  "components": [ ... ]
}
```
- **Behavior:** Interacts with the `message_templates` Graph API endpoint. Saves the pending template to the database awaiting a webhook status update from Meta.
