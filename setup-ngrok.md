# How to Test WhatsApp Live with Meta Cloud API & Ngrok

Now that we have fully implemented the MetaProvider, you can connect a real WhatsApp test number to your local environment.

## 1. Set Up Meta Developer Account
1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app (Type: Business).
2. Add the **WhatsApp** product to your app.
3. Meta will automatically provide you with a **Test Phone Number** and a Temporary Access Token.
4. Note down your **Phone Number ID** (not the phone number itself) and your **Temporary Access Token**.

## 2. Start Ngrok
You need to expose your local backend (port 4000) to the internet so Meta can send webhook events.
1. Install [ngrok](https://ngrok.com/).
2. Run the following command in your terminal:
   ```bash
   ngrok http 4000
   ```
3. Copy the **Forwarding URL** from the ngrok output (e.g., `https://1234-abcd.ngrok-free.app`).

## 3. Configure Webhook in Meta
1. In the WhatsApp developer dashboard, go to **Configuration**.
2. Click **Edit** next to Webhook.
3. Set the Callback URL to: `https://<YOUR_NGROK_URL>/webhooks/meta`
4. Set the Verify Token to: `flought-meta-test` (this is the hardcoded default in `webhooks.ts`).
5. Click **Verify and Save**. Meta will send a GET request to your ngrok URL. If your backend is running, it will succeed.
6. Click **Manage** next to Webhook fields and subscribe to the `messages` event.

## 4. Configure Flought Settings
1. Log into your local Flought dashboard.
2. Go to **Settings -> BSP**.
3. (Note: You may need to temporarily alter the Settings UI or use the API directly to set provider to `meta` and supply the `meta_phone_number_id` and `meta_access_token`, since the UI currently hardcodes `interakt` / `gupshup`).
   - *Alternatively, just add `META_ACCESS_TOKEN` and `META_PHONE_NUMBER_ID` to your backend `.env` file.*

## 5. Send a Test Message!
1. Add your personal phone number as a recipient in the Meta dashboard to authorize testing.
2. Send a WhatsApp message from your phone to the Meta Test Number.
3. You should see the webhook hit your ngrok terminal, the backend process it, and your AI bot will reply back to your phone!
