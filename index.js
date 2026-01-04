const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const sessions = {};

const PRODUCTS = {
  "1": { name: "Buffalo Milk", price: 100 },
  "2": { name: "Cow Milk", price: 120 },
  "3": { name: "Paneer", price: 600 },
  "4": { name: "Ghee", price: 1000 }
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
  const text = msg.text?.body?.trim().toLowerCase();
  const name = contact?.profile?.name || "";

  if (!sessions[from] || text === "0") {
    sessions[from] = { step: "MENU", name };
    await sendMenu(from);
    return res.sendStatus(200);
  }

  let s = sessions[from];
  let reply = "";

  switch (s.step) {

    /* -------- MENU -------- */
    case "MENU":
      if (text === "5") {
        reply = "📅 Daily Milk Subscription coming soon!";
        break;
      }
      if (text === "6") {
        reply = "📞 Owner will contact you shortly.";
        await saveSheet({ phone: from, name, type: "Enquiry" });
        delete sessions[from];
        break;
      }
      if (!PRODUCTS[text]) {
        reply = "❌ Please choose valid option";
        break;
      }
      s.product = PRODUCTS[text].name;
      s.pricePerUnit = PRODUCTS[text].price;
      reply =
        `🧴 ${s.product}\n\nSelect Quantity:\n` +
        `1️⃣ 500ml\n2️⃣ 1L\n3️⃣ 2L\n\n0️⃣ Back`;
      s.step = "QTY";
      break;

    /* -------- QUANTITY -------- */
    case "QTY":
      const qtyMap = { "1": "500ml", "2": "1L", "3": "2L" };
      if (!qtyMap[text]) {
        reply = "❌ Select 1 / 2 / 3 or 0";
        break;
      }
      s.quantity = qtyMap[text];
      reply =
        "📍 Please enter delivery address\n" +
        "OR share your *current location*\n\n0️⃣ Back";
      s.step = "ADDRESS";
      break;

    /* -------- ADDRESS -------- */
    case "ADDRESS":
      s.address = text;
      reply =
        "🕒 Choose Delivery Slot:\n\n" +
        "1️⃣ Morning\n2️⃣ Evening\n\n0️⃣ Back";
      s.step = "SLOT";
      break;

    /* -------- SLOT -------- */
    case "SLOT":
      if (text === "1") s.slot = "Morning";
      else if (text === "2") s.slot = "Evening";
      else {
        reply = "❌ Choose 1 or 2";
        break;
      }
      reply =
        `⏰ Enter delivery time\n` +
        `Example: 6:30 AM or 7:00 PM\n\n0️⃣ Back`;
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
        reply = "✅ Order Confirmed!\nPayment: COD 🙏";
        delete sessions[from];
      } else if (text === "2") {
        s.payment = "UPI";
        reply =
          `💰 Pay using UPI\n\n` +
          `8121893882-2@ybl\n\n` +
          `📸 Send payment screenshot\n\n0️⃣ Back`;
        s.step = "SCREENSHOT";
      } else {
        reply = "❌ Choose 1 or 2";
      }
      break;

    /* -------- SCREENSHOT -------- */
    case "SCREENSHOT":
      if (msg.image) {
        s.screenshot = msg.image.id;
        await saveSheet({ ...s, phone: from, type: "Payment" });
        reply = "✅ Payment received! Order confirmed 🎉";
        delete sessions[from];
      } else {
        reply = "📸 Please send payment screenshot";
      }
      break;
  }

  if (reply) await sendMessage(from, reply);
  res.sendStatus(200);
});

/* ================= HELPERS ================= */

async function sendMenu(to) {
  const text =
    "🥛 *Bala Milk Store*\n\n" +
    "Please choose an option:\n\n" +
    "1️⃣ Buffalo Milk – ₹100/L\n" +
    "2️⃣ Cow Milk – ₹120/L\n" +
    "3️⃣ Paneer – ₹600/Kg\n" +
    "4️⃣ Ghee – ₹1000/Kg\n" +
    "5️⃣ Daily Milk Subscription\n" +
    "6️⃣ Talk to Owner";
  await sendMessage(to, text);
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
