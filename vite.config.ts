import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

interface Session {
  offer: string
  answer?: string
  offerIP?: string
  timestamp: number
}

const sessions = new Map<string, Session>()
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LEN = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  if (sessions.has(code)) return generateCode()
  return code
}

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

        const url = new URL(req.url!, 'http://localhost')
        const code = url.searchParams.get('code')
        const listMode = url.searchParams.get('list')

        // List connections by IP
        if (req.method === 'GET' && listMode === 'true') {
          const filterIP = url.searchParams.get('ip') || ''
          const matches: { code: string; offerIP?: string }[] = []
          const now = Date.now()
          for (const [c, s] of sessions) {
            if (now - s.timestamp > 600000) {
              sessions.delete(c)
              continue
            }
            if (!s.answer && s.offerIP === filterIP) {
              matches.push({ code: c, offerIP: s.offerIP })
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(matches))
          return
        }

        // POST — store offer or answer
        if (req.method === 'POST') {
          const raw = await parseBody(req)
          const body = JSON.parse(raw)
          const sdp = body.sdp
          if (!sdp) {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'missing sdp' }))
            return
          }

          if (code) {
            // POST with code = store answer
            if (!sessions.has(code)) {
              res.writeHead(404)
              res.end(JSON.stringify({ error: 'code not found' }))
              return
            }
            const session = sessions.get(code)!
            session.answer = sdp
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true }))
            // Cleanup 5s after both sides complete
            setTimeout(() => sessions.delete(code), 5000)
            return
          }

          // POST without code = create new session with offer
          const newCode = generateCode()
          sessions.set(newCode, {
            offer: sdp,
            offerIP: body.publicIP || undefined,
            timestamp: Date.now(),
          })
          // Auto-expire after 10 minutes
          setTimeout(() => sessions.delete(newCode), 600000)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: newCode }))
          return
        }

        // GET — retrieve session by code
        if (req.method === 'GET') {
          if (!code || !sessions.has(code)) {
            res.writeHead(404)
            res.end(JSON.stringify({ error: 'code not found' }))
            return
          }
          const session = sessions.get(code)!
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            offer: session.offer,
            answer: session.answer || null,
          }))
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
