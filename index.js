const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const SHEET_URL = process.env.SHEET_WEBHOOK;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const OWNER_UPI = "8121893882-2@ybl";
const sessions = {};

/* ================= PRODUCTS ================= */

const PRODUCTS = {
  "1": { name: "Buffalo Milk", price: 100 },
  "2": { name: "Cow Milk", price: 120 },
  "3": { name: "Paneer", price: 600 },
  "4": { name: "Ghee", price: 1000 }
};

/* ================= HELPERS ================= */

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

function menuText() {
  return `🥛 *Welcome to Bala’s Milk Dairy*

1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg

Reply with option number.`;
}

/* ================= WEBHOOK ================= */

app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.trim()?.toLowerCase();
  const image = msg.image;
  const location = msg.location;

  /* ===== START ONLY ON HI ===== */
  if (!sessions[from]) {
    if (text === "hi" || text === "hello") {
      sessions[from] = {
        orderId: "ORD-" + Date.now(),
        phone: from,
        step: "MENU"
      };
      await sendMessage(from, menuText());
    }
    return res.sendStatus(200);
  }

  const s = sessions[from];

  /* ===== MENU ===== */
  if (s.step === "MENU") {
    if (!PRODUCTS[text]) {
      await sendMessage(from, menuText());
      return res.sendStatus(200);
    }

    s.product = PRODUCTS[text].name;
    s.unitPrice = PRODUCTS[text].price;
    s.step = "QTY";

    await sendMessage(
      from,
      `🧾 *${s.product}*
1️⃣ 500ml – ₹${s.unitPrice / 2}
2️⃣ 1L – ₹${s.unitPrice}
3️⃣ 2L – ₹${s.unitPrice * 2}`
    );
    return res.sendStatus(200);
  }

  /* ===== QUANTITY ===== */
  if (s.step === "QTY") {
    const q = {
      "1": { qty: "500ml", mul: 0.5 },
      "2": { qty: "1L", mul: 1 },
      "3": { qty: "2L", mul: 2 }
    };

    if (!q[text]) return res.sendStatus(200);

    s.quantity = q[text].qty;
    s.price = s.unitPrice * q[text].mul;
    s.step = "ADDR_TYPE";

    await sendMessage(
      from,
      "📍 Delivery address:\n1️⃣ Send live location\n2️⃣ Type address"
    );
    return res.sendStatus(200);
  }

  /* ===== ADDRESS TYPE ===== */
  if (s.step === "ADDR_TYPE") {
    if (text === "1") {
      s.step = "WAIT_LOCATION";
      await sendMessage(from, "📍 Please share live location now.");
      return res.sendStatus(200);
    }
    if (text === "2") {
      s.step = "ADDR_TEXT";
      await sendMessage(from, "✍️ Please type your address.");
      return res.sendStatus(200);
    }
  }

  /* ===== WAIT LOCATION ===== */
  if (s.step === "WAIT_LOCATION") {
    if (!location) return res.sendStatus(200);

    s.address = `Lat:${location.latitude},Lng:${location.longitude}`;
    s.step = "SLOT";

    await sendMessage(from, "🚚 Delivery slot:\n1️⃣ Morning\n2️⃣ Evening");
    return res.sendStatus(200);
  }

  /* ===== ADDRESS TEXT ===== */
  if (s.step === "ADDR_TEXT") {
    s.address = text;
    s.step = "SLOT";
    await sendMessage(from, "🚚 Delivery slot:\n1️⃣ Morning\n2️⃣ Evening");
    return res.sendStatus(200);
  }

  /* ===== SLOT ===== */
  if (s.step === "SLOT") {
    if (!["1", "2"].includes(text)) return res.sendStatus(200);

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
      "💰 Payment method:\n1️⃣ UPI\n2️⃣ Cash on Delivery"
    );
    return res.sendStatus(200);
  }

  /* ===== PAYMENT ===== */
  if (s.step === "PAYMENT") {
    if (text === "1") {
      s.payment = "UPI";
      s.step = "WAIT_SCREENSHOT";

      await sendMessage(
        from,
        `📲 Pay using any UPI app

UPI ID:
${OWNER_UPI}

After payment, send screenshot here.`
      );
      return res.sendStatus(200);
    }

    if (text === "2") {
      s.payment = "Cash on Delivery";
      await finalize(from, s);
      return res.sendStatus(200);
    }
  }

  /* ===== SCREENSHOT ===== */
  if (s.step === "WAIT_SCREENSHOT") {
    if (!image) return res.sendStatus(200);

    s.screenshot = image.id;
    await finalize(from, s);
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

/* ================= FINALIZE ================= */

async function finalize(from, s) {
  await saveToSheet({
    orderId: s.orderId,
    phone: s.phone,
    product: s.product,
    quantity: s.quantity,
    price: s.price,
    address: s.address,
    delivery: `${s.slot} ${s.time}`,
    payment: s.payment,
    screenshot: s.screenshot || ""
  });

  await sendMessage(
    from,
    `✅ *Order Confirmed*

🧾 Order ID: ${s.orderId}
🥛 ${s.product}
📦 ${s.quantity}
💰 ₹${s.price}
🚚 ${s.slot} ${s.time}

🙏 Thank you for ordering from *Bala’s Milk Dairy* 🥛`
  );

  delete sessions[from]; // 🔥 THIS STOPS MENU REPEAT
}

/* ================= VERIFY ================= */

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

app.listen(PORT, () => console.log("Running on", PORT));
