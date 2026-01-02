const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ENV variables (must be set in Render)
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Webhook verification
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive messages
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body;

    console.log("From:", from);
    console.log("Message:", text);

    let reply = "Welcome to Bala Milk Store 🥛\n\nReply:\n1️⃣ Buffalo Milk\n2️⃣ Cow Milk\n3️⃣ Paneer\n4️⃣ Ghee\n5️⃣ Subscription\n6️⃣ Talk to Owner";

    if (text === "1") reply = "🥛 Buffalo Milk – ₹100/L";
    else if (text === "2") reply = "🐄 Cow Milk – ₹120/L";
    else if (text === "3") reply = "🧀 Paneer – ₹600/Kg";
    else if (text === "4") reply = "🧈 Ghee – ₹1000/Kg";
    else if (text === "5") reply = "📅 Daily Milk Subscription – Please share quantity";
    else if (text === "6") reply = "📞 Owner will contact you shortly";

    // SEND MESSAGE TO WHATSAPP
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
