const express = require('express');
const path = require('path');

const port = process.env.PORT || 5006;
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Home route
app.get('/', (req, res) => {
  console.log(`Rendering 'pages/index' for route '/'`);
  res.render('pages/index');
});

/* ================================
   WhatsApp Webhook Verification
   ================================ */
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    return res.sendStatus(403);
  }
});

// Start server
const server = app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

// Keep-alive config (important for Render/Heroku)
server.keepAliveTimeout = 95 * 1000;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: gracefully shutting down');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
});
