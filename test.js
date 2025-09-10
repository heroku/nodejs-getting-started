const { spawn } = require('child_process')
const { request } = require('http')
//
const PORT = process.env.PORT || 5006

describe('getting started guide', () => {
  let app

  beforeEach(async () => {
    app = spawn('node', ['index.js'])
    app.stdout.on('data', (data) => console.log(data.toString()))
    // give the server a short time to start up
    return new Promise(resolve => setTimeout(resolve, 500))
  })

  afterEach(() => {
    if (app) {
      app.stdout.removeAllListeners()
      app.kill('SIGTERM')
    }
  })

  it('should bind to IPv4 and respond to GET /', async () => {
    const response = await get(`http://127.0.0.1:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })

  it('should bind to IPv6 and respond to GET /', async () => {
    const response = await get(`http://[::1]:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })
})

async function get(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, {method: 'GET'}, (res) => {
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (data) => body += data)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body
        })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}
