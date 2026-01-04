const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const sessions = {};

/* ================= PRODUCTS ================= */
const PRODUCTS = {
  "1": {
    name: "Buffalo Milk",
    emoji: "🐃",
    units: {
      "1": { qty: "500ml", price: 50 },
      "2": { qty: "1 Litre", price: 100 },
      "3": { qty: "2 Litres", price: 200 }
    }
  },
  "2": {
    name: "Cow Milk",
    emoji: "🐄",
    units: {
      "1": { qty: "500ml", price: 60 },
      "2": { qty: "1 Litre", price: 120 },
      "3": { qty: "2 Litres", price: 240 }
    }
  },
  "3": {
    name: "Paneer",
    emoji: "🧀",
    units: {
      "1": { qty: "250g", price: 150 },
      "2": { qty: "500g", price: 300 },
      "3": { qty: "1 Kg", price: 600 }
    }
  },
  "4": {
    name: "Ghee",
    emoji: "🥘",
    units: {
      "1": { qty: "250ml", price: 250 },
      "2": { qty: "500ml", price: 500 },
      "3": { qty: "1 Litre", price: 1000 }
    }
  }
};

/* ================= VERIFY ================= */
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* ================= WEBHOOK ================= */
app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const contact = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.trim();
  const name = contact?.profile?.name || "";

  if (!sessions[from] || text === "0") {
    sessions[from] = { step: "MENU", name };
    await sendMenu(from);
    return res.sendStatus(200);
  }

  const s = sessions[from];
  let reply = "";

  switch (s.step) {

    /* -------- MENU -------- */
    case "MENU":
      if (text === "6") {
        await saveSheet({ phone: from, name, type: "Enquiry" });
        reply = "📞 Owner will contact you shortly.";
        delete sessions[from];
        break;
      }
      if (!PRODUCTS[text]) {
        reply = "❌ Please select valid option";
        break;
      }
      s.productKey = text;
      s.product = PRODUCTS[text].name;
      reply = formatQuantityMenu(PRODUCTS[text]);
      s.step = "QTY";
      break;

    /* -------- QTY -------- */
    case "QTY":
      const product = PRODUCTS[s.productKey];
      if (!product.units[text]) {
        reply = "❌ Please select valid quantity";
        break;
      }
      s.quantity = product.units[text].qty;
      s.price = product.units[text].price;
      reply =
        "📍 Please enter delivery address\n" +
        "or share *current location*\n\n0️⃣ Back";
      s.step = "ADDRESS";
      break;

    /* -------- ADDRESS -------- */
    case "ADDRESS":
      s.address = text;
      reply =
        "🕒 Delivery Slot:\n\n" +
        "1️⃣ Morning\n2️⃣ Evening\n\n0️⃣ Back";
      s.step = "SLOT";
      break;

    /* -------- SLOT -------- */
    case "SLOT":
      if (text === "1") s.slot = "Morning";
      else if (text === "2") s.slot = "Evening";
      else { reply = "❌ Choose 1 or 2"; break; }
      reply = "⏰ Enter delivery time (eg: 6:30 AM)";
      s.step = "TIME";
      break;

    /* -------- TIME -------- */
    case "TIME":
      s.time = text;
      reply =
        "💳 Payment Method:\n\n" +
        "1️⃣ Cash on Delivery\n" +
        "2️⃣ UPI Payment\n\n0️⃣ Back";
      s.step = "PAYMENT";
      break;

    /* -------- PAYMENT -------- */
    case "PAYMENT":
      if (text === "1") {
        s.payment = "Cash on Delivery";
        await saveSheet({ ...s, phone: from, type: "Payment" });
        reply = "✅ Order Confirmed (COD) 🙏";
        delete sessions[from];
      } else if (text === "2") {
        s.payment = "UPI";
        reply =
          `💰 Amount: ₹${s.price}\n\n` +
          `UPI ID:\n8121893882-2@ybl\n\n` +
          `📸 Send payment screenshot`;
        s.step = "SCREENSHOT";
      } else reply = "❌ Choose 1 or 2";
      break;

    /* -------- SCREENSHOT -------- */
    case "SCREENSHOT":
      if (msg.image) {
        s.screenshot = msg.image.id;
        await saveSheet({ ...s, phone: from, type: "Payment" });
        reply = "✅ Payment received. Order confirmed 🎉";
        delete sessions[from];
      } else reply = "📸 Please send screenshot";
      break;
  }

  if (reply) await sendMessage(from, reply);
  res.sendStatus(200);
});

/* ================= HELPERS ================= */

function formatQuantityMenu(product) {
  let txt = `${product.emoji} *${product.name} – Price Details*\n\n`;
  Object.entries(product.units).forEach(([k, v]) => {
    txt += `${k}️⃣ ${v.qty} – ₹${v.price}\n`;
  });
  txt += "\n0️⃣ ⬅ Back";
  return txt;
}

async function sendMenu(to) {
  await sendMessage(
    to,
    "🥛 *Bala Milk Store*\n\n" +
    "1️⃣ Buffalo Milk\n" +
    "2️⃣ Cow Milk\n" +
    "3️⃣ Paneer\n" +
    "4️⃣ Ghee\n" +
    "5️⃣ Daily Milk Subscription\n" +
    "6️⃣ Talk to Owner"
  );
}

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

async function saveSheet(data) {
  await axios.post(process.env.GOOGLE_SHEET_URL, data);
}

app.listen(process.env.PORT || 3000);
