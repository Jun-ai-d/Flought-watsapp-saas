# Developer API Reference

**Document Type:** Reference  
**Target Audience:** Tenant Developers, Integration Partners (Zapier, Make, custom backends)  
**Base URL:** `https://api.flought.com/api/v1` *(or your self-hosted API URL)*

The Developer API allows you to programmatically interact with your Flought instance. You can sync contacts from your CRM, send outbound messages automatically, or manage AI bot takeovers.

---

## Authentication

All Developer API endpoints require authentication using a **Secret API Key**. 

1. Generate your Secret Key in the dashboard under **Settings > Developer API**.
2. Include the key in the `Authorization` header of all requests as a Bearer token.

**Example Header:**
```http
Authorization: Bearer sk_live_3c96656579dd964c44
Content-Type: application/json
```

> [!WARNING]
> Your Secret API Key grants full access to your tenant data. Keep it secure and never expose it in client-side code (e.g., frontend React/Next.js apps). If your key is compromised, immediately rotate it in the Settings dashboard.

---

## 1. Contacts API

### Sync a Contact
`POST /contacts`

Creates a new contact or updates an existing one based on the phone number. Use this to automatically sync leads from your website or external CRM into Flought.

**Request Body:**
```json
{
  "phone_number": "1234567890",
  "name": "John Doe",
  "tags": ["lead", "website"]
}
```
*Note: `phone_number` should contain only digits (include the country code).*

**Response (200 OK):**
```json
{
  "success": true,
  "contact": {
    "id": "uuid",
    "tenant_id": "uuid",
    "phone_number": "1234567890",
    "name": "John Doe",
    "tags": ["lead", "website"],
    "opted_in": true
  }
}
```

---

## 2. Messaging API

### Send a Message
`POST /messages/send`

Sends an outbound WhatsApp message to a customer. This is typically used for transactional notifications (order updates, shipping alerts, etc.).

**Request Body:**
```json
{
  "conversationId": "uuid-of-existing-conversation",
  "text": "Your order #1234 has been shipped!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "result": {
    "bspMessageId": "wamid.HBg..."
  }
}
```

> [!NOTE]  
> If the conversation has expired (past the 24-hour WhatsApp customer service window), sending a free-form text message will fail. In those cases, you must send an approved WhatsApp Template instead.

---

## 3. Bot Handover API

Control whether the AI bot or a human agent is currently handling the conversation.

### Pause AI (Human Takeover)
`POST /conversations/:id/takeover`

Forces the conversation into human handover mode, completely silencing the AI bot from responding to further messages in this conversation.

**Path Parameters:**
- `id` (string): The UUID of the conversation.

**Response (200 OK):**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "status": "handover_active"
  }
}
```

### Resume AI
`POST /conversations/:id/resolve`

Resolves the human handover state and turns the AI bot back on for this conversation.

**Path Parameters:**
- `id` (string): The UUID of the conversation.

**Response (200 OK):**
```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "status": "bot"
  }
}
```

---

## Error Codes & Troubleshooting

| HTTP Status | Error Context | Resolution |
|-------------|---------------|------------|
| **401 Unauthorized** | Missing or invalid API key. | Ensure the `Authorization` header is correctly formatted as `Bearer <key>`. |
| **400 Bad Request** | Missing required fields. | Check the response body for details on which fields are missing. |
| **404 Not Found** | Resource does not exist. | Ensure the `conversationId` or contact ID is correct and belongs to your tenant. |
| **500 Internal Error** | Server-side failure. | Verify your BSP/Meta credentials are valid in the Settings dashboard. |
