const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

const sessions = {};

// Health check
app.get("/", (req, res) => {
  res.send("Bala Milk Store WhatsApp Bot is running ✅");
});

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return res.sendStatus(200);
    }

    const messageObj = value.messages[0];
    const from = messageObj.from;
    const text = messageObj.text?.body?.trim();

    if (!sessions[from]) {
      sessions[from] = { step: "START" };
    }

    let reply = "";

    switch (sessions[from].step) {
      case "START":
        reply =
          "Welcome to *Bala Milk Store* 🥛\n\n" +
          "Please choose an option:\n" +
          "1️⃣ Buffalo Milk – ₹100/L\n" +
          "2️⃣ Cow Milk – ₹120/L\n" +
          "3️⃣ Paneer – ₹600/Kg\n" +
          "4️⃣ Ghee – ₹1000/Kg\n" +
          "5️⃣ Daily Milk Subscription\n" +
          "6️⃣ Talk to Owner\n\n" +
          "Reply with the option number.";
        sessions[from].step = "PRODUCT";
        break;

      case "PRODUCT":
        if (text === "1") {
          sessions[from].product = "Buffalo Milk";
          sessions[from].pricePerL = 100;
        } else if (text === "2") {
          sessions[from].product = "Cow Milk";
          sessions[from].pricePerL = 120;
        } else {
          reply = "❌ Invalid option. Please reply with a valid number.";
          break;
        }

        reply =
          `🥛 *${sessions[from].product} selected*\n\n` +
          "Choose quantity:\n" +
          "1️⃣ 500ml – ₹50\n" +
          "2️⃣ 1 L\n" +
          "3️⃣ 2 L";

        sessions[from].step = "QUANTITY";
        break;

      case "QUANTITY":
        if (text === "1") {
          sessions[from].quantity = "500ml";
          sessions[from].price = 50;
        } else if (text === "2") {
          sessions[from].quantity = "1 L";
          sessions[from].price = sessions[from].pricePerL;
        } else if (text === "3") {
          sessions[from].quantity = "2 L";
          sessions[from].price = sessions[from].pricePerL * 2;
        } else {
          reply = "❌ Invalid quantity. Choose 1, 2 or 3.";
          break;
        }

        reply = "📍 Please send your *delivery address*.";
        sessions[from].step = "ADDRESS";
        break;

      case "ADDRESS":
        sessions[from].address = text;

        reply =
          "📅 From when do you want delivery?\n\n" +
          "1️⃣ From Today\n" +
          "2️⃣ From Tomorrow\n" +
          "3️⃣ Pick a custom date";

        sessions[from].step = "START_DATE";
        break;

      case "START_DATE":
        if (text === "1") sessions[from].startDate = "Today";
        else if (text === "2") sessions[from].startDate = "Tomorrow";
        else if (text === "3") {
          reply = "📅 Please type the start date (DD-MM-YYYY)";
          sessions[from].step = "CUSTOM_DATE";
          break;
        } else {
          reply = "❌ Invalid option.";
          break;
        }

        reply =
          "⏰ Choose delivery time:\n" +
          "1️⃣ Morning\n" +
          "2️⃣ Evening";

        sessions[from].step = "DELIVERY_TIME";
        break;

      case "CUSTOM_DATE":
        sessions[from].startDate = text;

        reply =
          "⏰ Choose delivery time:\n" +
          "1️⃣ Morning\n" +
          "2️⃣ Evening";

        sessions[from].step = "DELIVERY_TIME";
        break;

      case "DELIVERY_TIME":
        if (text === "1") sessions[from].deliveryTime = "Morning";
        else if (text === "2") sessions[from].deliveryTime = "Evening";
        else {
          reply = "❌ Invalid option.";
          break;
        }

        reply =
          "✅ *Order Confirmed!*\n\n" +
          `🥛 ${sessions[from].product}\n` +
          `📦 ${sessions[from].quantity}\n` +
          `📍 ${sessions[from].address}\n` +
          `📅 From: ${sessions[from].startDate}\n` +
          `⏰ ${sessions[from].deliveryTime}\n` +
          `💰 ₹${sessions[from].price}\n\n` +
          "💳 *Payment Required*\n" +
          "UPI ID: *8121893882-2@ybl*\n\n" +
          "📸 After payment, please send the screenshot here.";

        sessions[from].step = "WAIT_PAYMENT";
        break;

      case "WAIT_PAYMENT":
        reply =
          "🙏 Thank you!\n\n" +
          "📸 Payment screenshot received.\n" +
          "Our team will verify and confirm your order shortly.";
        break;

      default:
        reply = "Something went wrong. Please say Hi again.";
        sessions[from].step = "START";
    }

    console.log("From:", from);
    console.log("Message:", text);
    console.log("Reply:", reply);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
