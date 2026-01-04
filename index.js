const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===============================
// TEMP SESSION STORAGE
// ===============================
const sessions = {};

// ===============================
// WEBHOOK VERIFY
// ===============================
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ===============================
// WEBHOOK RECEIVE
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!sessions[from]) {
      sessions[from] = { step: "MENU" };
    }

    let reply = "";

    // ===============================
    // STEP 1: MENU
    // ===============================
    if (sessions[from].step === "MENU") {
      if (["1", "2", "3", "4", "5", "6"].includes(text)) {
        const products = {
          "1": "Buffalo Milk",
          "2": "Cow Milk",
          "3": "Paneer",
          "4": "Ghee",
          "5": "Daily Milk Subscription",
          "6": "Talk to Owner",
        };

        sessions[from].product = products[text];
        sessions[from].step = "QUANTITY";

        reply =
          `🛒 *${products[text]} selected*\n\n` +
          "Please select quantity:\n" +
          "1️⃣ 1 Litre\n" +
          "2️⃣ 2 Litres\n" +
          "3️⃣ 3 Litres\n\n" +
          "Reply with number.";
      } else {
        reply =
          "Welcome to *Bala Milk Store* 🥛\n\n" +
          "1️⃣ Buffalo Milk – ₹100/L\n" +
          "2️⃣ Cow Milk – ₹120/L\n" +
          "3️⃣ Paneer – ₹600/Kg\n" +
          "4️⃣ Ghee – ₹1000/Kg\n" +
          "5️⃣ Daily Milk Subscription\n" +
          "6️⃣ Talk to Owner\n\n" +
          "Reply with option number.";
      }
    }

    // ===============================
    // STEP 2: QUANTITY
    // ===============================
    else if (sessions[from].step === "QUANTITY") {
      const qtyMap = { "1": "1 Litre", "2": "2 Litres", "3": "3 Litres" };

      if (!qtyMap[text]) {
        reply = "❌ Invalid option.\nPlease reply 1 / 2 / 3";
      } else {
        sessions[from].quantity = qtyMap[text];
        sessions[from].step = "ADDRESS";
        reply = "📍 Please send your *delivery address*.";
      }
    }

    // ===============================
    // STEP 3: ADDRESS
    // ===============================
    else if (sessions[from].step === "ADDRESS") {
      sessions[from].address = text;
      sessions[from].step = "START_DATE";

      reply =
        "📅 From which date do you want milk?\n\n" +
        "Example: *05-Jan-2026*";
    }

    // ===============================
    // STEP 4: START DATE
    // ===============================
    else if (sessions[from].step === "START_DATE") {
      sessions[from].startDate = text;

      // SAVE TO GOOGLE SHEET
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        phone: from,
        product: sessions[from].product,
        quantity: sessions[from].quantity,
        address: sessions[from].address,
        startDate: sessions[from].startDate,
      });

      reply =
        "✅ *Order Confirmed!*\n\n" +
        `🥛 Product: ${sessions[from].product}\n` +
        `📦 Quantity: ${sessions[from].quantity}\n` +
        `📍 Address: ${sessions[from].address}\n` +
        `📅 Start Date: ${sessions[from].startDate}\n\n` +
        "Thank you for choosing *Bala Milk Store* 🙏";

      delete sessions[from]; // clear session
    }

    // ===============================
    // SEND MESSAGE
    // ===============================
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(200);
  }
});

// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
