const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const sessions = {};

const PRODUCTS = {
  milk: {
    name: "Milk",
    quantities: {
      "1": { label: "500ml", price: 50 },
      "2": { label: "1L", price: 90 },
      "3": { label: "2L", price: 170 }
    }
  }
};

/* =========================
   WEBHOOK VERIFY
========================= */
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* =========================
   WEBHOOK RECEIVE
========================= */
app.post("/webhook", async (req, res) => {
  try {
    const msg =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact =
      req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body?.toLowerCase();
    const name = contact?.profile?.name || "";

    if (!sessions[from]) {
      sessions[from] = { step: "START", name };
    }

    let reply = "";

    /* =========================
       FLOW
    ========================= */
    switch (sessions[from].step) {

      /* ---- START ---- */
      case "START":
        if (text === "hi" || text === "hello") {
          reply =
            "👋 Welcome to *Bala Milk Store* 🥛\n\n" +
            "Please choose a product:\n" +
            "1️⃣ Milk\n" +
            "2️⃣ Enquiry only";
          sessions[from].step = "PRODUCT";
        }
        break;

      /* ---- PRODUCT ---- */
      case "PRODUCT":
        if (text === "1") {
          sessions[from].product = "Milk";
          reply =
            "Select Quantity:\n\n" +
            "1️⃣ 500ml – ₹50\n" +
            "2️⃣ 1L – ₹90\n" +
            "3️⃣ 2L – ₹170";
          sessions[from].step = "QTY";
        } else if (text === "2") {
          await saveToSheet({
            phone: from,
            name,
            type: "Enquiry"
          });
          reply = "📞 Thank you! We will contact you shortly.";
          delete sessions[from];
        } else {
          reply = "❌ Please reply 1 or 2";
        }
        break;

      /* ---- QUANTITY ---- */
      case "QTY":
        const qty = PRODUCTS.milk.quantities[text];
        if (!qty) {
          reply = "❌ Please select 1 / 2 / 3";
          break;
        }
        sessions[from].quantity = qty.label;
        sessions[from].price = qty.price;
        reply =
          "📍 Please type your delivery address\n" +
          "OR share your *current location*.";
        sessions[from].step = "ADDRESS";
        break;

      /* ---- ADDRESS ---- */
      case "ADDRESS":
        sessions[from].address = text || "Location Shared";
        reply =
          "⏰ Delivery Time:\n\n" +
          "1️⃣ Morning\n" +
          "2️⃣ Evening";
        sessions[from].step = "TIME";
        break;

      /* ---- TIME ---- */
      case "TIME":
        if (text === "1") sessions[from].time = "Morning";
        else if (text === "2") sessions[from].time = "Evening";
        else {
          reply = "❌ Please reply 1 or 2";
          break;
        }

        reply =
          "💳 Payment Method:\n\n" +
          "1️⃣ Cash on Delivery\n" +
          "2️⃣ UPI Payment";
        sessions[from].step = "PAYMENT_METHOD";
        break;

      /* ---- PAYMENT METHOD ---- */
      case "PAYMENT_METHOD":
        if (text === "1") {
          sessions[from].payment = "Cash on Delivery";
          await confirmOrder(from, name, "Payment");
          reply = "✅ Order confirmed!\nPayment: Cash on Delivery";
          delete sessions[from];
        } else if (text === "2") {
          sessions[from].payment = "UPI";
          reply =
            "💰 Amount: ₹" + sessions[from].price + "\n\n" +
            "UPI ID:\n8121893882-2@ybl\n\n" +
            "📸 After payment, send screenshot.";
          sessions[from].step = "WAIT_SCREENSHOT";
        } else {
          reply = "❌ Please reply 1 or 2";
        }
        break;

      /* ---- SCREENSHOT ---- */
      case "WAIT_SCREENSHOT":
        if (msg.image) {
          await confirmOrder(from, name, "Payment", msg.image.id);
          reply = "✅ Payment received! Order confirmed 🙏";
          delete sessions[from];
        } else {
          reply = "📸 Please send payment screenshot.";
        }
        break;
    }

    if (reply) await sendMessage(from, reply);
    res.sendStatus(200);

  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

/* =========================
   HELPERS
========================= */
async function confirmOrder(phone, name, type, screenshot = "") {
  await saveToSheet({
    phone,
    name,
    type,
    screenshot
  });
}

async function saveToSheet(data) {
  await axios.post(process.env.GOOGLE_SHEET_URL, data);
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

app.listen(process.env.PORT || 3000);
