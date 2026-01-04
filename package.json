const express = require("express");
const axios = require("axios");

const app = express();

// Render / Express config
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ENV variables (set in Render)
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bala_verify_token";

// ---------------------------
// 1️⃣ Webhook Verification (GET)
// ---------------------------
app.get("/webhook", (req, res) => {
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

// ---------------------------
// 2️⃣ Receive WhatsApp Messages (POST)
// ---------------------------
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from; // user phone number
    const text = message.text?.body?.trim();

    console.log("📩 From:", from);
    console.log("💬 Message:", text);

    let reply = "";

    switch (text) {
      case "1":
        reply = "🥛 *Buffalo Milk*\n₹100 per litre\nFresh & daily supply.";
        break;
      case "2":
        reply = "🐄 *Cow Milk*\n₹120 per litre\nPure & hygienic.";
        break;
      case "3":
        reply = "🧀 *Paneer*\n₹600 per Kg\nFresh homemade paneer.";
        break;
      case "4":
        reply = "🧈 *Ghee*\n₹1000 per Kg\nTraditional & pure.";
        break;
      case "5":
        reply =
          "📅 *Daily Milk Subscription*\nReply YES to start subscription.";
        break;
      case "6":
        reply =
          "📞 *Talk to Owner*\nCall or WhatsApp: +91 81218 93882";
        break;
      default:
        reply =
          "🙏 *Welcome to Bala Milk Store 🥛*\n\n" +
          "Please choose an option:\n" +
          "1️⃣ Buffalo Milk – ₹100/L\n" +
          "2️⃣ Cow Milk – ₹120/L\n" +
          "3️⃣ Paneer – ₹600/Kg\n" +
          "4️⃣ Ghee – ₹1000/Kg\n" +
          "5️⃣ Daily Milk Subscription\n" +
          "6️⃣ Talk to Owner\n\n" +
          "Reply with the option number.";
    }

    // ---------------------------
    // 3️⃣ Send WhatsApp Reply
    // ---------------------------
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Reply sent");
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.sendStatus(200);
  }
});

// ---------------------------
// 4️⃣ Health Check
// ---------------------------
app.get("/", (req, res) => {
  res.send("✅ Bala Milk Store WhatsApp Bot is running");
});

// ---------------------------
// Start Server
// ---------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
