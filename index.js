const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== Root check ======
app.get('/', (req, res) => {
  res.send('Bala Milk Store WhatsApp Bot is running ✅');
});

// ====== WhatsApp Webhook ======
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages?.[0];

    // If no message, return OK
    if (!messages) {
      return res.sendStatus(200);
    }

    const from = messages.from; // customer WhatsApp number
    const text = messages.text?.body?.trim();

    console.log('From:', from);
    console.log('Message:', text);

    let reply = '';

    switch (text) {
      case '1':
        reply = `🥛 *Buffalo Milk*
Price: ₹100 / Litre
Fresh & Pure

Reply *ORDER* to place order`;
        break;

      case '2':
        reply = `🥛 *Cow Milk*
Price: ₹120 / Litre
Healthy & Fresh

Reply *ORDER* to place order`;
        break;

      case '3':
        reply = `🧀 *Paneer*
Price: ₹600 / Kg
Fresh Homemade Paneer

Reply *ORDER* to place order`;
        break;

      case '4':
        reply = `🧈 *Ghee*
Price: ₹1000 / Kg
Pure Desi Ghee

Reply *ORDER* to place order`;
        break;

      case '5':
        reply = `📦 *Daily Milk Subscription*
✔ Morning delivery
✔ Monthly billing

Reply *SUBSCRIBE* to continue`;
        break;

      case '6':
        reply = `📞 *Talk to Owner*
Please call: 9XXXXXXXXX`;
        break;

      case 'ORDER':
        reply = `✅ Thank you!
Please reply with:
Product name
Quantity
Delivery address`;
        break;

      case 'SUBSCRIBE':
        reply = `📝 Subscription details:
Milk type:
Quantity per day:
Address:`;
        break;

      default:
        reply = `Welcome to *Bala Milk Store* 🥛

Please choose an option:
1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg
5️⃣ Daily Milk Subscription
6️⃣ Talk to Owner

Reply with the option number.`;
    }

    // ====== Send reply to WhatsApp ======
    await sendWhatsAppMessage(from, reply);

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// ====== Send message function ======
async function sendWhatsAppMessage(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      text: { body: message }
    })
  });
}

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
