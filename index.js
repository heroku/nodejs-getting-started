const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ENV variables (Render)
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "bala_verify_token";

// --------------------
// Webhook verification
// --------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --------------------
// Receive messages
// --------------------
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim();

    console.log("📩 From:", from);
    console.log("💬 Message:", text);

    let reply;

    switch (text) {
      case "1":
        reply = "🥛 *Buffalo Milk*\n₹100 per litre";
        break;
      case "2":
        reply = "🐄 *Cow Milk*\n₹120 per litre";
        break;
      case "3":
        reply = "🧀 *Paneer*\n₹600 per Kg";
        break;
      case "4":
        reply = "🧈 *Ghee*\n₹1000 per Kg";
        break;
      case "5":
        reply = "📅 Daily milk subscription\nReply YES to continue";
        break;
      case "6":
        reply = "📞 Owner: +91 81218 93882";
        break;
      default:
        reply =
          "🙏 *Welcome to Bala Milk Store 🥛*\n\n" +
          "1️⃣ Buffalo Milk\n" +
          "2️⃣ Cow Milk\n" +
          "3️⃣ Paneer\n" +
          "4️⃣ Ghee\n" +
          "5️⃣ Subscription\n" +
          "6️⃣ Talk to Owner\n\n" +
          "Reply with option number";
    }

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Reply sent");
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    res.sendStatus(200);
  }
});

// --------------------
app.get("/", (req, res) => {
  res.send("✅ Bala WhatsApp Bot is running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
