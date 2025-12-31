const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 5006;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static & views
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Home route
app.get('/', (req, res) => {
  res.send('WhatsApp Webhook is running ✅');
});

// 🔐 Webhook verification (Meta Step)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'my_verify_token'; // must match Meta token

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 📩 Receive WhatsApp messages
app.post('/webhook', async (req, res) => {
  console.log('Incoming webhook:', JSON.stringify(req.body, null, 2));

  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const messages = value?.messages;

  if (messages && messages.length > 0) {
    const from = messages[0].from;
    const text = messages[0].text?.body;

    console.log(`Message from ${from}: ${text}`);

    // Auto-reply
    await fetch(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          text: { body: '👋 Hello! Your message has been received successfully.' }
        })
      }
    );
  }

  res.sendStatus(200);
});

// Start server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.keepAliveTimeout = 95 * 1000;
