interface Session {
  offer: string
  answer?: string
  offerIP?: string
  timestamp: number
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
}

const sessions = new Map<string, Session>()
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LEN = 6
const SESSION_TTL = 600000 // 10 minutes

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  if (sessions.has(code)) return generateCode()
  return code
}

function cleanupExpired() {
  const now = Date.now()
  for (const [code, session] of sessions) {
    if (now - session.timestamp > SESSION_TTL) {
      sessions.delete(code)
    }
  }
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function handleSignaling(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const listMode = url.searchParams.get('list')

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  cleanupExpired()

  // List connections by IP
  if (request.method === 'GET' && listMode === 'true') {
    const filterIP = url.searchParams.get('ip') || ''
    const matches: { code: string; offerIP?: string }[] = []
    for (const [c, s] of sessions) {
      if (!s.answer && s.offerIP === filterIP) {
        matches.push({ code: c, offerIP: s.offerIP })
      }
    }
    return new Response(JSON.stringify(matches), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // POST — store offer or answer
  if (request.method === 'POST') {
    let body: { sdp?: string; publicIP?: string }
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!body.sdp) {
      return new Response(JSON.stringify({ error: 'missing sdp' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (code) {
      // POST with code = store answer
      if (!sessions.has(code)) {
        return new Response(JSON.stringify({ error: 'code not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const session = sessions.get(code)!
      session.answer = body.sdp
      setTimeout(() => sessions.delete(code), 5000)
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST without code = create new session with offer
    const newCode = generateCode()
    sessions.set(newCode, {
      offer: body.sdp,
      offerIP: body.publicIP || undefined,
      timestamp: Date.now(),
    })
    setTimeout(() => sessions.delete(newCode), SESSION_TTL)

    return new Response(JSON.stringify({ code: newCode }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // GET — retrieve session by code
  if (request.method === 'GET') {
    if (!code || !sessions.has(code)) {
      return new Response(JSON.stringify({ error: 'code not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const session = sessions.get(code)!
    return new Response(JSON.stringify({
      offer: session.offer,
      answer: session.answer || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // API routes
    if (url.pathname === '/api/signaling' || url.pathname.startsWith('/api/signaling?')) {
      return handleSignaling(request)
    }

    // Serve static assets
    try {
      const response = await env.ASSETS.fetch(request)
      // SPA fallback: serve index.html for any 404 on non-asset paths
      if (response.status === 404 && !url.pathname.includes('.')) {
        const indexUrl = new URL('/index.html', request.url)
        return env.ASSETS.fetch(new Request(indexUrl, request))
      }
      return response
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  },
}
