import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// In-memory SDP store: short code → packed SDP
const sdpStore = new Map<string, string>()
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 30 chars, no I/O/0/1
const CODE_LEN = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  // Avoid collision (extremely unlikely but safe)
  if (sdpStore.has(code)) return generateCode()
  return code
}

// Parse JSON body from request
function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

function signalingPlugin() {
  return {
    name: 'signaling',
    configureServer(server: any) {
      server.middlewares.use('/api/signaling', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        if (req.method === 'POST') {
          const raw = await parseBody(req)
          const body = JSON.parse(raw)
          const packedSdp = body.sdp
          if (!packedSdp) {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'missing sdp' }))
            return
          }
          const code = generateCode()
          sdpStore.set(code, packedSdp)
          // Auto-expire after 10 minutes
          setTimeout(() => sdpStore.delete(code), 600000)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code }))
          return
        }

        if (req.method === 'GET') {
          const url = new URL(req.url!, `http://localhost`)
          const code = url.searchParams.get('code')
          if (!code || !sdpStore.has(code)) {
            res.writeHead(404)
            res.end(JSON.stringify({ error: 'code not found' }))
            return
          }
          const sdp = sdpStore.get(code)
          // One-time use: delete after retrieval
          sdpStore.delete(code)
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end(sdp)
          return
        }

        res.writeHead(405)
        res.end('Method not allowed')
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    signalingPlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
