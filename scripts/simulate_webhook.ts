async function simulate() {
  console.log('🚀 Simulating inbound webhook from Gupshup...');

  const payload = {
    app: 'FloughtApp',
    timestamp: Date.now(),
    type: 'message',
    payload: {
      id: `wa-${Date.now()}`,
      source: '+919876543210',  // Customer phone
      destination: 'Flought-WABA-ID', // WABA ID
      type: 'text',
      payload: {
        text: process.argv[2] || 'This is a simulated inbound message! Hello from backend.'
      },
      sender: {
        phone: '+919876543210',
        name: 'Priya Sharma'
      }
    }
  };

  try {
    const response = await fetch('http://localhost:4000/webhooks/gupshup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gupshup-signature': 'test-signature'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Response Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response Body: ${text}`);
    
    if (response.status === 200) {
      console.log('✅ Webhook accepted. Check the database to see the message.');
    }
  } catch (error) {
    console.error('❌ Error simulating webhook:', error);
  }
}

simulate();
