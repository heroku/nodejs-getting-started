const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const SHEET_URL = process.env.SHEET_WEBHOOK;
const OWNER_UPI = "8121893882-2@ybl";

const sessions = {};

/* ================= PRODUCTS ================= */

const PRODUCTS = {
  "1": { name: "Buffalo Milk", price: 100 },
  "2": { name: "Cow Milk", price: 120 },
  "3": { name: "Paneer", price: 600 },
  "4": { name: "Ghee", price: 1000 },
  "5": { name: "Daily Milk Subscription" },
  "6": { name: "Talk to Owner" }
};

/* ================= HELPERS ================= */

function menuText() {
  return `🥛 *Welcome to Bala Milk Store*

Please choose an option:
1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg
5️⃣ Daily Milk Subscription
6️⃣ Talk to Owner

Reply with option number.`;
}

async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

async function saveToSheet(data) {
  await axios.post(SHEET_URL, data);
}

function newSession(phone) {
  return {
    orderId: "ORD-" + Date.now(),
    phone,
    step: "MENU"
  };
}

/* ================= WEBHOOK ================= */

app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.trim();
  const location = msg.location;
  const image = msg.image;

  if (!sessions[from]) {
    sessions[from] = newSession(from);
    await sendMessage(from, menuText());
    return res.sendStatus(200);
  }

  const s = sessions[from];

  /* ============ MENU ============ */
  if (s.step === "MENU") {
    if (!PRODUCTS[text]) {
      await sendMessage(from, menuText());
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
      `🧾 *${s.product}*

Choose quantity:
1️⃣ 500ml – ₹${s.unitPrice * 0.5}
2️⃣ 1L – ₹${s.unitPrice}
3️⃣ 2L – ₹${s.unitPrice * 2}`
    );
    return res.sendStatus(200);
  }

  /* ============ QUANTITY ============ */
  if (s.step === "QTY") {
    const map = {
      "1": { qty: "500ml", mul: 0.5 },
      "2": { qty: "1L", mul: 1 },
      "3": { qty: "2L", mul: 2 }
    };

    if (!map[text]) {
      await sendMessage(from, "❌ Choose 1 / 2 / 3");
      return res.sendStatus(200);
    }

    s.quantity = map[text].qty;
    s.price = s.unitPrice * map[text].mul;
    s.step = "ADDRESS_CHOICE";

    await sendMessage(
      from,
      `📍 *Delivery Address*
1️⃣ Send live location
2️⃣ Type address manually`
    );
    return res.sendStatus(200);
  }

  /* ============ ADDRESS CHOICE ============ */
  if (s.step === "ADDRESS_CHOICE") {
    if (text === "1") {
      s.step = "WAIT_LOCATION";
      await sendMessage(from, "📍 Please share your live location now.");
      return res.sendStatus(200);
    }

    if (text === "2") {
      s.step = "ADDRESS_TEXT";
      await sendMessage(from, "✍️ Please type your delivery address.");
      return res.sendStatus(200);
    }

    await sendMessage(from, "❌ Choose 1 or 2");
    return res.sendStatus(200);
  }

  /* ============ WAIT LOCATION ============ */
  if (s.step === "WAIT_LOCATION") {
    if (!location) {
      await sendMessage(from, "📍 Please send live location using WhatsApp.");
      return res.sendStatus(200);
    }

    s.address = `Lat:${location.latitude}, Lng:${location.longitude}`;
    s.step = "SLOT";

    await sendMessage(from, "🚚 Choose delivery slot:\n1️⃣ Morning\n2️⃣ Evening");
    return res.sendStatus(200);
  }

  /* ============ ADDRESS TEXT ============ */
  if (s.step === "ADDRESS_TEXT") {
    s.address = text;
    s.step = "SLOT";
    await sendMessage(from, "🚚 Choose delivery slot:\n1️⃣ Morning\n2️⃣ Evening");
    return res.sendStatus(200);
  }

  /* ============ SLOT ============ */
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

  /* ============ TIME ============ */
  if (s.step === "TIME") {
    s.time = text;
    s.step = "PAYMENT_CHOICE";

    await sendMessage(
      from,
      `💰 Choose payment method:
1️⃣ UPI
2️⃣ Cash on Delivery`
    );
    return res.sendStatus(200);
  }

  /* ============ PAYMENT CHOICE ============ */
  if (s.step === "PAYMENT_CHOICE") {
    if (text === "1") {
      s.paymentMethod = "UPI";
      s.step = "WAIT_SCREENSHOT";

      await sendMessage(
        from,
        `📲 *UPI Payment*

UPI ID:
${OWNER_UPI}

Please complete payment in any UPI app
and send payment screenshot here.`
      );
      return res.sendStatus(200);
    }

    if (text === "2") {
      s.paymentMethod = "Cash on Delivery";
      await finalizeOrder(from, s);
      return res.sendStatus(200);
    }

    await sendMessage(from, "❌ Choose 1 or 2");
    return res.sendStatus(200);
  }

  /* ============ SCREENSHOT ============ */
  if (s.step === "WAIT_SCREENSHOT") {
    if (!image) {
      await sendMessage(from, "❌ Please send payment screenshot.");
      return res.sendStatus(200);
    }

    s.screenshot = image.id;
    await finalizeOrder(from, s);
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

/* ================= FINALIZE ================= */

async function finalizeOrder(from, s) {
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
    screenshot: s.screenshot || ""
  });

  await sendMessage(
    from,
    `✅ *Order Confirmed!*

🧾 Order ID: ${s.orderId}
🥛 ${s.product}
📦 ${s.quantity}
💰 ₹${s.price}
🚚 ${s.slot} ${s.time}

🙏 *Thank you for ordering from Bala’s Milk Dairy* 🥛`
  );

  delete sessions[from];
}

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
