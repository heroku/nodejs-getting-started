const axios = require("axios");

const SCRIPT_URL = "PASTE_YOUR_NEW_GOOGLE_SCRIPT_URL_HERE";
const UPI_ID = "8121893882-2@ybl";

let sessions = {};

module.exports = async (req, res) => {
  const msg = req.body.data?.body?.trim();
  const from = req.body.data?.from;
  const name = req.body.data?.notifyName || "";

  if (!sessions[from]) {
    sessions[from] = { step: "MENU", phone: from, name };
  }

  const s = sessions[from];

  // BACK OPTION
  if (msg === "0") {
    s.step = "MENU";
  }

  let reply = "";

  switch (s.step) {

    // ---------------- MENU ----------------
    case "MENU":
      reply =
`🥛 *Welcome to Bala Milk Dairy*

Please choose an option:
1️⃣ Buffalo Milk – ₹100/L
2️⃣ Cow Milk – ₹120/L
3️⃣ Paneer – ₹600/Kg
4️⃣ Ghee – ₹1000/Kg
5️⃣ Daily Milk Subscription
6️⃣ Enquiry Only

Reply with option number.`;
      s.step = "PRODUCT";
      break;

    // ---------------- PRODUCT ----------------
    case "PRODUCT":
      if (msg === "6") {
        s.type = "Enquiry";
        s.step = "ENQUIRY";
        reply = "✍️ Please type your enquiry.\n\n0️⃣ Back";
        break;
      }

      const products = {
        "1": { name: "Buffalo Milk", price: 100 },
        "2": { name: "Cow Milk", price: 120 },
        "3": { name: "Paneer", price: 600 },
        "4": { name: "Ghee", price: 1000 }
      };

      if (!products[msg]) {
        reply = "❌ Invalid option.\n0️⃣ Back";
        break;
      }

      s.product = products[msg];
      reply =
`🧾 *${s.product.name}*

Choose quantity:
1️⃣ 500ml – ₹${s.product.price / 2}
2️⃣ 1 L – ₹${s.product.price}
3️⃣ 2 L – ₹${s.product.price * 2}

0️⃣ Back`;
      s.step = "QUANTITY";
      break;

    // ---------------- QUANTITY ----------------
    case "QUANTITY":
      const qtyMap = {
        "1": { q: "500ml", m: 0.5 },
        "2": { q: "1L", m: 1 },
        "3": { q: "2L", m: 2 }
      };

      if (!qtyMap[msg]) {
        reply = "❌ Choose valid quantity.\n0️⃣ Back";
        break;
      }

      s.quantity = qtyMap[msg].q;
      s.price = s.product.price * qtyMap[msg].m;

      reply =
`📍 Delivery Address:
1️⃣ Send live location
2️⃣ Type address manually

0️⃣ Back`;
      s.step = "ADDRESS";
      break;

    // ---------------- ADDRESS ----------------
    case "ADDRESS":
      if (msg === "1") {
        reply = "📌 Please share live location now.";
        s.step = "LOCATION";
      } else if (msg === "2") {
        reply = "✍️ Please type your full address.\n\n0️⃣ Back";
        s.step = "ADDRESS_TEXT";
      } else {
        reply = "❌ Invalid option.\n0️⃣ Back";
      }
      break;

    case "ADDRESS_TEXT":
      s.address = msg;
      s.step = "DELIVERY";
      reply =
`⏰ Delivery Slot:
1️⃣ Morning
2️⃣ Evening

0️⃣ Back`;
      break;

    case "LOCATION":
      s.address = "Live Location Shared";
      s.step = "DELIVERY";
      reply =
`⏰ Delivery Slot:
1️⃣ Morning
2️⃣ Evening

0️⃣ Back`;
      break;

    // ---------------- DELIVERY ----------------
    case "DELIVERY":
      if (msg === "1") s.delivery = "Morning";
      else if (msg === "2") s.delivery = "Evening";
      else {
        reply = "❌ Invalid option.\n0️⃣ Back";
        break;
      }

      reply =
`🕒 Enter delivery time (example: 6:30 AM)\n\n0️⃣ Back`;
      s.step = "TIME";
      break;

    case "TIME":
      s.deliveryTime = `${s.delivery} ${msg}`;
      reply =
`💰 Payment Method:
1️⃣ UPI
2️⃣ Cash on Delivery

0️⃣ Back`;
      s.step = "PAYMENT";
      break;

    // ---------------- PAYMENT ----------------
    case "PAYMENT":
      if (msg === "1") {
        s.payment = "UPI";
        reply =
`💳 Pay using UPI:
👉 ${UPI_ID}

📸 After payment, send screenshot.

0️⃣ Back`;
        s.step = "SCREENSHOT";
      } else if (msg === "2") {
        s.payment = "Cash on Delivery";
        await saveToSheet(s, "COD");
        reply =
`✅ Order Confirmed!

🙏 Thank you for ordering from *Bala Milk Dairy* 🥛`;
        delete sessions[from];
      } else {
        reply = "❌ Invalid option.\n0️⃣ Back";
      }
      break;

    // ---------------- SCREENSHOT ----------------
    case "SCREENSHOT":
      await saveToSheet(s, "UPI Screenshot");
      reply =
`✅ Payment received!

🙏 Thank you for ordering from *Bala Milk Dairy* 🥛`;
      delete sessions[from];
      break;

    // ---------------- ENQUIRY ----------------
    case "ENQUIRY":
      await saveToSheet({
        phone: s.phone,
        name: s.name,
        type: "Enquiry",
        product: msg
      }, "Enquiry");

      reply =
`🙏 Thank you for contacting *Bala Milk Dairy*.
We will get back to you soon.`;
      delete sessions[from];
      break;
  }

  await sendMessage(from, reply);
  res.sendStatus(200);
};

// -------- SEND MESSAGE ----------
async function sendMessage(to, body) {
  await axios.post(process.env.WHATSAPP_API_URL, {
    to,
    body
  });
}

// -------- SAVE TO GOOGLE SHEET ----------
async function saveToSheet(s, method) {
  await axios.post(SCRIPT_URL, {
    OrderId: "ORD-" + Date.now(),
    Phone: s.phone,
    ContactName: s.name,
    Type: s.type || "Payment",
    Product: s.product?.name || "",
    Quantity: s.quantity || "",
    Price: s.price || "",
    Address: s.address || "",
    Delivery: s.deliveryTime || "",
    Payment: method
  });
}
