const express = require('express')
const path = require('path')

const app = express()
const port = process.env.PORT || 5006

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Views
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// Homepage
app.get('/', (req, res) => {
  res.render('pages/index')
})

// Webhook verification (already working)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN

  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// Receive WhatsApp messages
app.post('/webhook', (req, res) => {
  console.log('Incoming webhook:', JSON.stringify(req.body, null, 2))

  const entry = req.body.entry?.[0]
  const changes = entry?.changes?.[0]
  const value = changes?.value
  const messages = value?.messages

  if (messages && messages.length > 0) {
    const from = messages[0].from
    const text = messages[0].text?.body

    console.log(`Message from ${from}: ${text}`)
  }

  res.sendStatus(200)
})

// Start server
const server = app.listen(port, () => {
  console.log(`Listening on ${port}`)
})

server.keepAliveTimeout = 95 * 1000
