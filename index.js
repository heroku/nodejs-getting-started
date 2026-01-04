const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;

/* ================= CONFIG ================= */

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const SHEET_URL = process.env.SHEET_WEBHOOK; // Google Apps Script URL
const OWNER_UPI = "8121893882-2@ybl";

/* ================= SESSION ================= */

const sessions = {};

function newSession(phone) {
  return {
    orderId: "ORD-" + Date.now(),
    phone,
    step: "MENU",
  };
}

/* ================= PRODUCTS ================= */

const PRODUCTS = {
  "1": { name: "Buffalo Milk", price: 100 },
  "2": { name: "Cow Milk", price: 120 },
  "3": { name: "Paneer", price: 600 },
  "4": { name: "Ghee", price: 1000 },
  "5": { name: "Daily Milk Subscription" },
  "6": { name: "Talk to Owner" },
};

/* ================= WHATSAPP SEND ================= */

async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

/* ================= GOOGLE SHEET ================= */

async function saveToSheet(data) {
  await axios.post(SHEET_URL, data);
}

/* ================= MENU ================= */

function menuText() {
  return `🥛 Welcome to *Bala Milk Store*

Please choose an option:
1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg
5️⃣ Daily Milk Subscription
6️⃣ Talk to Owner

Reply with option number.`;
}

/* ================= WEBHOOK ================= */

app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!entry) return res.sendStatus(200);

  const from = entry.from;
  const text = entry.text?.body?.trim();
  const image = entry.image;

  if (!sessions[from]) {
    sessions[from] = newSession(from);
    await sendMessage(from, menuText());
    return res.sendStatus(200);
  }

  const s = sessions[from];

  /* ===== MENU ===== */
  if (s.step === "MENU") {
    if (!PRODUCTS[text]) {
      await sendMessage(from, "❌ Invalid option. Please choose again.\n\n" + menuText());
      return res.sendStatus(200);
    }

    if (text === "6") {
      await sendMessage(from, "📞 Please call: 8121893882");
      delete sessions[from];
      return res.sendStatus(200);
    }

    s.product = PRODUCTS[text].name;
    s.unitPrice = PRODUCTS[text].price;
    s.step = "QTY";

    await sendMessage(
      from,
      `🧾 *${s.product}*\n\nChoose quantity:\n1️⃣ 500ml\n2️⃣ 1 L\n3️⃣ 2 L`
    );
    return res.sendStatus(200);
  }

  /* ===== QUANTITY ===== */
  if (s.step === "QTY") {
    if (!["1", "2", "3"].includes(text)) {
      await sendMessage(from, "❌ Choose 1 / 2 / 3");
      return res.sendStatus(200);
    }

    s.quantity =
      text === "1" ? "500ml" : text === "2" ? "1L" : "2L";

    const multiplier = text === "1" ? 0.5 : text === "2" ? 1 : 2;
    s.price = s.unitPrice * multiplier;

    s.step = "ADDRESS";
    await sendMessage(from, "📍 Please send your delivery address.");
    return res.sendStatus(200);
  }

  /* ===== ADDRESS ===== */
  if (s.step === "ADDRESS") {
    s.address = text;
    s.step = "SLOT";
    await sendMessage(from, "🚚 Choose delivery slot:\n1️⃣ Morning\n2️⃣ Evening");
    return res.sendStatus(200);
  }

  /* ===== SLOT ===== */
  if (s.step === "SLOT") {
    if (!["1", "2"].includes(text)) {
      await sendMessage(from, "❌ Choose 1 or 2");
      return res.sendStatus(200);
    }

    s.slot = text === "1" ? "Morning" : "Evening";
    s.step = "TIME";
    await sendMessage(from, "⏰ Enter delivery time (example: 6:30 AM)");
    return res.sendStatus(200);
  }

  /* ===== TIME ===== */
  if (s.step === "TIME") {
    s.time = text;
    s.step = "PAYMENT";

    await sendMessage(
      from,
      `💰 *Payment Options*\n\nUPI ID:\n${OWNER_UPI}\n\n1️⃣ Send payment screenshot\n2️⃣ Cash on Delivery`
    );
    return res.sendStatus(200);
  }

  /* ===== PAYMENT ===== */
  if (s.step === "PAYMENT") {
    if (text === "2") {
      s.paymentMethod = "Cash on Delivery";
    }

    if (image) {
      s.paymentMethod = "UPI";
      s.screenshot = image.id;
    }

    if (!s.paymentMethod) {
      await sendMessage(from, "❌ Please choose payment option");
      return res.sendStatus(200);
    }

    await saveToSheet({
      orderId: s.orderId,
      date: new Date().toLocaleString(),
      phone: s.phone,
      product: s.product,
      quantity: s.quantity,
      price: s.price,
      address: s.address,
      delivery: `${s.slot} ${s.time}`,
      payment: s.paymentMethod,
      screenshot: s.screenshot || "",
    });

    await sendMessage(
      from,
      `✅ *Order Confirmed!*\n\n🧾 Order ID: ${s.orderId}\n🥛 ${s.product}\n📦 ${s.quantity}\n💰 ₹${s.price}\n🚚 ${s.slot} ${s.time}\n\n🙏 Thank you for choosing Bala Milk Store`
    );

    delete sessions[from]; // 🔥 IMPORTANT
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

/* ================= VERIFY ================= */

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* ================= START ================= */

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
