const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===============================
// WEBHOOK VERIFICATION (META)
// ===============================
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===============================
// RECEIVE WHATSAPP MESSAGE
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from; // customer phone
    const text = message.text?.body?.trim();

    console.log("📩 From:", from, "Message:", text);

    // ===============================
    // MENU LOGIC
    // ===============================
    let replyText = "";
    let product = "";

    switch (text) {
      case "1":
        product = "Buffalo Milk";
        replyText = "🥛 Buffalo Milk selected\nPrice: ₹100/L\nThank you for your order!";
        break;

      case "2":
        product = "Cow Milk";
        replyText = "🥛 Cow Milk selected\nPrice: ₹120/L\nThank you for your order!";
        break;

      case "3":
        product = "Paneer";
        replyText = "🧀 Paneer selected\nPrice: ₹600/Kg\nThank you for your order!";
        break;

      case "4":
        product = "Ghee";
        replyText = "🧈 Ghee selected\nPrice: ₹1000/Kg\nThank you for your order!";
        break;

      case "5":
        replyText = "📅 Daily Milk Subscription\nOwner will contact you shortly.";
        product = "Subscription";
        break;

      case "6":
        replyText = "📞 Owner will call you shortly.\nThank you!";
        product = "Talk to Owner";
        break;

      default:
        replyText =
          "Welcome to *Bala Milk Store* 🥛\n\n" +
          "Please choose an option:\n" +
          "1️⃣ Buffalo Milk – ₹100/L\n" +
          "2️⃣ Cow Milk – ₹120/L\n" +
          "3️⃣ Paneer – ₹600/Kg\n" +
          "4️⃣ Ghee – ₹1000/Kg\n" +
          "5️⃣ Daily Milk Subscription\n" +
          "6️⃣ Talk to Owner\n\n" +
          "Reply with the option number.";
        product = "Menu Shown";
    }

    // ===============================
    // SAVE ORDER TO GOOGLE SHEET
    // ===============================
    await axios.post(process.env.GOOGLE_SHEET_URL, {
      phone: from,
      product: product,
      quantity: 1,
      message: text,
    });

    // ===============================
    // SEND WHATSAPP REPLY
    // ===============================
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: replyText },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.sendStatus(200);
  }
});

// ===============================
// SERVER START
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
