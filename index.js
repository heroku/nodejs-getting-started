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
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
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
    const location = message.location;

    if (!sessions[from]) sessions[from] = { step: "MENU" };

    let reply = "";

    // ===============================
    // STEP 1: MENU
    // ===============================
    if (sessions[from].step === "MENU") {
      const products = {
        "1": "Buffalo Milk",
        "2": "Cow Milk",
        "3": "Paneer",
        "4": "Ghee",
        "5": "Daily Milk Subscription",
        "6": "Talk to Owner",
      };

      if (products[text]) {
        sessions[from].product = products[text];
        sessions[from].step = "QUANTITY";

        reply =
          `🥛 *${products[text]} selected*\n\n` +
          "Choose quantity:\n" +
          "1️⃣ 500 ml – ₹50\n" +
          "2️⃣ 1 L – ₹100\n" +
          "3️⃣ 2 L – ₹200\n" +
          "4️⃣ 3 L – ₹300\n\n" +
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
      const qtyMap = {
        "1": { qty: "500 ml", price: 50 },
        "2": { qty: "1 L", price: 100 },
        "3": { qty: "2 L", price: 200 },
        "4": { qty: "3 L", price: 300 },
      };

      if (!qtyMap[text]) {
        reply = "❌ Invalid choice. Please reply 1 / 2 / 3 / 4";
      } else {
        sessions[from].quantity = qtyMap[text].qty;
        sessions[from].price = qtyMap[text].price;
        sessions[from].step = "ADDRESS";

        reply =
          "📍 Please share *delivery address* or use 📎 → *Location* option.";
      }
    }

    // ===============================
    // STEP 3: ADDRESS / LOCATION
    // ===============================
    else if (sessions[from].step === "ADDRESS") {
      if (location) {
        sessions[from].address = `Location: ${location.latitude}, ${location.longitude}`;
      } else {
        sessions[from].address = text;
      }

      sessions[from].step = "START_DATE";

      reply =
        "📅 Select start date:\n\n" +
        "1️⃣ Today\n" +
        "2️⃣ Tomorrow\n" +
        "3️⃣ Custom Date";
    }

    // ===============================
    // STEP 4: START DATE
    // ===============================
    else if (sessions[from].step === "START_DATE") {
      if (text === "1") {
        sessions[from].startDate = "Today";
        sessions[from].step = "DELIVERY_TIME";
      } else if (text === "2") {
        sessions[from].startDate = "Tomorrow";
        sessions[from].step = "DELIVERY_TIME";
      } else if (text === "3") {
        sessions[from].step = "CUSTOM_DATE";
        reply = "✍️ Please type date (DD-MM-YYYY)";
      } else {
        reply = "❌ Invalid option. Reply 1 / 2 / 3";
      }

      if (sessions[from].step === "DELIVERY_TIME") {
        reply =
          "⏰ Choose delivery time:\n\n" +
          "1️⃣ Morning\n" +
          "2️⃣ Evening";
      }
    }

    // ===============================
    // CUSTOM DATE
    // ===============================
    else if (sessions[from].step === "CUSTOM_DATE") {
      sessions[from].startDate = text;
      sessions[from].step = "DELIVERY_TIME";

      reply =
        "⏰ Choose delivery time:\n\n" +
        "1️⃣ Morning\n" +
        "2️⃣ Evening";
    }

    // ===============================
    // DELIVERY TIME
    // ===============================
    else if (sessions[from].step === "DELIVERY_TIME") {
      sessions[from].deliveryTime =
        text === "1" ? "Morning" : "Evening";

      // SAVE TO GOOGLE SHEET
      await axios.post(process.env.GOOGLE_SHEET_URL, {
        phone: from,
        product: sessions[from].product,
        quantity: sessions[from].quantity,
        price: sessions[from].price,
        address: sessions[from].address,
        startDate: sessions[from].startDate,
        deliveryTime: sessions[from].deliveryTime,
      });

      reply =
        "✅ *Order Confirmed!*\n\n" +
        `🥛 ${sessions[from].product}\n` +
        `📦 ${sessions[from].quantity}\n` +
        `💰 ₹${sessions[from].price}\n` +
        `📍 ${sessions[from].address}\n` +
        `📅 ${sessions[from].startDate}\n` +
        `⏰ ${sessions[from].deliveryTime}\n\n` +
        "Thank you for choosing *Bala Milk Store* 🙏";

      delete sessions[from];
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
    console.error(err.message);
    res.sendStatus(200);
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
