const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const sessions = {};

const PRODUCTS = {
  "500ml": 50,
  "1L": 90,
  "2L": 170
};

/* =========================
   WEBHOOK VERIFY
========================= */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

/* =========================
   WEBHOOK RECEIVE MESSAGE
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) return res.sendStatus(200);

    const from = messageObj.from;
    const text = messageObj.text?.body?.toLowerCase();

    if (!sessions[from]) {
      sessions[from] = { step: "START" };
    }

    let reply = "";

    switch (sessions[from].step) {

      /* ===== START ===== */
      case "START":
        reply =
          "🥛 *Welcome to Milk Service*\n\n" +
          "Select Quantity:\n" +
          "1️⃣ 500ml – ₹50\n" +
          "2️⃣ 1L – ₹90\n" +
          "3️⃣ 2L – ₹170\n\n" +
          "Reply with 1 / 2 / 3";
        sessions[from].step = "QTY";
        break;

      /* ===== QUANTITY ===== */
      case "QTY":
        if (text === "1") sessions[from].quantity = "500ml";
        else if (text === "2") sessions[from].quantity = "1L";
        else if (text === "3") sessions[from].quantity = "2L";
        else {
          reply = "❌ Please reply 1 / 2 / 3";
          break;
        }

        sessions[from].price = PRODUCTS[sessions[from].quantity];
        reply = "📍 Please share delivery address.";
        sessions[from].step = "ADDRESS";
        break;

      /* ===== ADDRESS ===== */
      case "ADDRESS":
        sessions[from].address = text;
        reply =
          "📅 Select start date:\n\n" +
          "1️⃣ Today\n" +
          "2️⃣ Tomorrow\n\n" +
          "Reply 1 or 2";
        sessions[from].step = "DATE";
        break;

      /* ===== DATE ===== */
      case "DATE":
        if (text === "1") sessions[from].startDate = "Today";
        else if (text === "2") sessions[from].startDate = "Tomorrow";
        else {
          reply = "❌ Reply 1 or 2";
          break;
        }

        reply =
          "⏰ Delivery Time:\n\n" +
          "1️⃣ Morning\n" +
          "2️⃣ Evening\n\n" +
          "Reply 1 or 2";
        sessions[from].step = "TIME";
        break;

      /* ===== TIME ===== */
      case "TIME":
        if (text === "1") sessions[from].deliveryTime = "Morning";
        else if (text === "2") sessions[from].deliveryTime = "Evening";
        else {
          reply = "❌ Reply 1 or 2";
          break;
        }

        reply =
          `💰 *Payment Details*\n\n` +
          `Amount: ₹${sessions[from].price}\n` +
          `UPI ID: 8121893882-2@ybl\n\n` +
          `After payment, please send *payment screenshot*.`;
        sessions[from].step = "WAIT_PAYMENT";
        break;

      /* ===== PAYMENT SCREENSHOT ===== */
      case "WAIT_PAYMENT":
        if (messageObj.image) {
          const imageId = messageObj.image.id;

          await axios.post(process.env.GOOGLE_SHEET_URL, {
            phone: from,
            product: "Milk",
            quantity: sessions[from].quantity,
            price: sessions[from].price,
            address: sessions[from].address,
            startDate: sessions[from].startDate,
            deliveryTime: sessions[from].deliveryTime,
            paymentScreenshot: imageId
          });

          reply =
            "✅ *Payment Received!*\n\n" +
            "Your order is confirmed 🙏\n" +
            "Thank you for choosing us.";

          delete sessions[from];
        } else {
          reply = "📸 Please send payment screenshot to confirm order.";
        }
        break;
    }

    if (reply) {
      await sendMessage(from, reply);
    }

    res.sendStatus(200);

  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/* =========================
   SEND MESSAGE FUNCTION
========================= */
async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

/* ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
