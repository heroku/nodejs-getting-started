app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages) {
      return res.sendStatus(200);
    }

    const from = messages[0].from;
    const text = messages[0].text?.body?.trim();

    let reply = '';

    // Greeting / Menu
    if (!text || ['hi', 'hello', 'menu'].includes(text.toLowerCase())) {
      reply =
        `Welcome to *Bala Milk Store* 🥛\n\n` +
        `Please choose an option:\n` +
        `1️⃣ Buffalo Milk – ₹100/L\n` +
        `2️⃣ Cow Milk – ₹120/L\n` +
        `3️⃣ Paneer – ₹600/Kg\n` +
        `4️⃣ Ghee – ₹1000/Kg\n` +
        `5️⃣ Daily Milk Subscription\n` +
        `6️⃣ Talk to Owner\n\n` +
        `Reply with the option number.`;
    }

    // Option 1 - Buffalo Milk
    else if (text === '1') {
      reply =
        `🥛 *Buffalo Milk*\n\n` +
        `Price: ₹100 per liter\n` +
        `Fresh & Pure\n\n` +
        `Reply with quantity in liters (Example: 2L)`;
    }

    // Option 2 - Cow Milk
    else if (text === '2') {
      reply =
        `🥛 *Cow Milk*\n\n` +
        `Price: ₹120 per liter\n` +
        `Healthy & Natural\n\n` +
        `Reply with quantity in liters (Example: 1L)`;
    }

    // Option 3 - Paneer
    else if (text === '3') {
      reply =
        `🧀 *Paneer*\n\n` +
        `Price: ₹600 per Kg\n` +
        `Fresh homemade paneer\n\n` +
        `Reply with quantity (Example: 0.5 Kg)`;
    }

    // Option 4 - Ghee
    else if (text === '4') {
      reply =
        `🫙 *Pure Ghee*\n\n` +
        `Price: ₹1000 per Kg\n` +
        `Traditional & aromatic\n\n` +
        `Reply with quantity (Example: 1 Kg)`;
    }

    // Option 5 - Subscription
    else if (text === '5') {
      reply =
        `📅 *Daily Milk Subscription*\n\n` +
        `✔ Morning delivery\n` +
        `✔ Monthly billing\n` +
        `✔ Fresh every day\n\n` +
        `Reply *YES* to subscribe or *NO* to cancel.`;
    }

    // Option 6 - Talk to Owner
    else if (text === '6') {
      reply =
        `📞 *Talk to Owner*\n\n` +
        `Name: Bala\n` +
        `Mobile: +91-XXXXXXXXXX\n\n` +
        `Call anytime between 6 AM – 10 PM`;
    }

    // Invalid input
    else {
      reply =
        `❌ Invalid option\n\n` +
        `Please reply with:\n` +
        `1️⃣ Buffalo Milk\n` +
        `2️⃣ Cow Milk\n` +
        `3️⃣ Paneer\n` +
        `4️⃣ Ghee\n` +
        `5️⃣ Subscription\n` +
        `6️⃣ Talk to Owner`;
    }

    // Send WhatsApp message
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
          text: { body: reply }
        })
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook Error:', err);
    res.sendStatus(500);
  }
});
