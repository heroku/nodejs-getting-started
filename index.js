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
  "4": { name: "Ghee", price: 1000 },
  "5": { name: "Daily Milk Subscription" },
  "6": { name: "Enquiry / Talk to Owner" }
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
  return `🥛 *Bala’s Milk Dairy*

1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg
5️⃣ Daily Milk Subscription
6️⃣ Enquiry / Talk to Owner

Reply with option number.
Type *0* anytime to go back.`;
}

/* ================= WEBHOOK ================= */

app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body?.trim();
  const image = msg.image;
  const location = msg.location;

  /* ===== START ONLY ON HI ===== */
  if (!sessions[from]) {
    if (text?.toLowerCase() === "hi" || text?.toLowerCase() === "hello") {
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

  /* ===== BACK BUTTON ===== */
  if (text === "0") {
    if (s.step === "MENU") {
      await sendMessage(from, menuText());
      return res.sendStatus(200);
    }
    s.step = s.prev || "MENU";
    await sendMessage(from, menuText());
    return res.sendStatus(200);
  }

  /* ===== MENU ===== */
  if (s.step === "MENU") {
    if (text === "6") {
      s.prev = "MENU";
      s.step = "ENQUIRY";
      await sendMessage(from, "✍️ Please type your enquiry.\n(0 = Back)");
      return res.sendStatus(200);
    }

    if (!PRODUCTS[text]) {
      await sendMessage(from, menuText());
      return res.sendStatus(200);
    }

    s.product = PRODUCTS[text].name;
    s.unitPrice = PRODUCTS[text].price;
    s.prev = "MENU";
    s.step = "QTY";

    await sendMessage(
      from,
      `🧾 *${s.product}*

1️⃣ 500ml – ₹${s.unitPrice / 2}
2️⃣ 1L – ₹${s.unitPrice}
3️⃣ 2L – ₹${s.unitPrice * 2}

0️⃣ Back`
    );
    return res.sendStatus(200);
  }

  /* ===== ENQUIRY ===== */
  if (s.step === "ENQUIRY") {
    await saveToSheet({
      Type: "Enquiry",
      OrderId: "",
      Phone: s.phone,
      Enquiry: text,
      Date: new Date().toLocaleString()
    });

    await sendMessage(
      from,
      `🙏 Thank you for contacting *Bala’s Milk Dairy*.

We will get back to you shortly.`
    );

    delete sessions[from];
    return res.sendStatus(200);
  }

  /* ===== QUANTITY ===== */
  if (s.step === "QTY") {
    const map = {
      "1": { qty: "500ml", mul: 0.5 },
      "2": { qty: "1L", mul: 1 },
      "3": { qty: "2L", mul: 2 }
    };

    if (!map[text]) return res.sendStatus(200);

    s.quantity = map[text].qty;
    s.price = s.unitPrice * map[text].mul;
    s.prev = "QTY";
    s.step = "ADDR_TYPE";

    await sendMessage(
      from,
      "📍 Delivery Address:\n1️⃣ Send live location\n2️⃣ Type address\n0️⃣ Back"
    );
    return res.sendStatus(200);
  }

  /* ===== ADDRESS TYPE ===== */
  if (s.step === "ADDR_TYPE") {
    if (text === "1") {
      s.prev = "ADDR_TYPE";
      s.step = "WAIT_LOCATION";
      await sendMessage(from, "📍 Please share live location now.\n0️⃣ Back");
      return res.sendStatus(200);
    }
    if (text === "2") {
      s.prev = "ADDR_TYPE";
      s.step = "ADDR_TEXT";
      await sendMessage(from, "✍️ Type your address.\n0️⃣ Back");
      return res.sendStatus(200);
    }
  }

  /* ===== WAIT LOCATION ===== */
  if (s.step === "WAIT_LOCATION") {
    if (!location) return res.sendStatus(200);
    s.address = `Lat:${location.latitude},Lng:${location.longitude}`;
    s.prev = "WAIT_LOCATION";
    s.step = "SLOT";
    await sendMessage(from, "🚚 Delivery Slot:\n1️⃣ Morning\n2️⃣ Evening\n0️⃣ Back");
    return res.sendStatus(200);
  }

  /* ===== ADDRESS TEXT ===== */
  if (s.step === "ADDR_TEXT") {
    s.address = text;
    s.prev = "ADDR_TEXT";
    s.step = "SLOT";
    await sendMessage(from, "🚚 Delivery Slot:\n1️⃣ Morning\n2️⃣ Evening\n0️⃣ Back");
    return res.sendStatus(200);
  }

  /* ===== SLOT ===== */
  if (s.step === "SLOT") {
    if (!["1", "2"].includes(text)) return res.sendStatus(200);
    s.slot = text === "1" ? "Morning" : "Evening";
    s.prev = "SLOT";
    s.step = "TIME";
    await sendMessage(from, "⏰ Enter delivery time (e.g. 6:30 AM)\n0️⃣ Back");
    return res.sendStatus(200);
  }

  /* ===== TIME ===== */
  if (s.step === "TIME") {
    s.time = text;
    s.prev = "TIME";
    s.step = "PAYMENT";
    await sendMessage(
      from,
      "💰 Payment Method:\n1️⃣ UPI\n2️⃣ Cash on Delivery\n0️⃣ Back"
    );
    return res.sendStatus(200);
  }

  /* ===== PAYMENT ===== */
  if (s.step === "PAYMENT") {
    if (text === "1") {
      s.payment = "UPI";
      s.prev = "PAYMENT";
      s.step = "WAIT_SCREENSHOT";
      await sendMessage(
        from,
        `📲 Pay via any UPI app

UPI ID:
${OWNER_UPI}

Send payment screenshot here.
0️⃣ Back`
      );
      return res.sendStatus(200);
    }

    if (text === "2") {
      s.payment = "Cash on Delivery";
      await finalizeOrder(from, s);
      return res.sendStatus(200);
    }
  }

  /* ===== SCREENSHOT ===== */
  if (s.step === "WAIT_SCREENSHOT") {
    if (!image) return res.sendStatus(200);
    s.screenshot = image.id;
    await finalizeOrder(from, s);
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

/* ================= FINALIZE ================= */

async function finalizeOrder(from, s) {
  await saveToSheet({
    Type: "Order",
    OrderId: s.orderId,
    Phone: s.phone,
    Product: s.product,
    Quantity: s.quantity,
    Price: s.price,
    Address: s.address,
    Delivery: `${s.slot} ${s.time}`,
    Payment: s.payment,
    Screenshot: s.screenshot || "",
    Date: new Date().toLocaleString()
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

  delete sessions[from];
}

/* ================= VERIFY ================= */

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

app.listen(PORT, () => console.log("Server running on", PORT));
