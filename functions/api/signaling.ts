interface Session {
  offer: string
  answer?: string
  offerIP?: string
  timestamp: number
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

export const onRequest = async (context: { request: Request; env: Record<string, unknown>; params: Record<string, string> }) => {
  const { request } = context
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const listMode = url.searchParams.get('list')

  // CORS headers
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // Cleanup expired sessions periodically
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
      headers: { ...headers, 'Content-Type': 'application/json' },
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
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const sdp = body.sdp
    if (!sdp) {
      return new Response(JSON.stringify({ error: 'missing sdp' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (code) {
      // POST with code = store answer
      if (!sessions.has(code)) {
        return new Response(JSON.stringify({ error: 'code not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
      const session = sessions.get(code)!
      session.answer = sdp
      const res = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
      // Cleanup 5s after both sides complete
      setTimeout(() => sessions.delete(code), 5000)
      return res
    }

    // POST without code = create new session with offer
    const newCode = generateCode()
    sessions.set(newCode, {
      offer: sdp,
      offerIP: body.publicIP || undefined,
      timestamp: Date.now(),
    })
    // Auto-expire after 10 minutes
    setTimeout(() => sessions.delete(newCode), SESSION_TTL)

    return new Response(JSON.stringify({ code: newCode }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  // GET — retrieve session by code
  if (request.method === 'GET') {
    if (!code || !sessions.has(code)) {
      return new Response(JSON.stringify({ error: 'code not found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    const session = sessions.get(code)!
    return new Response(JSON.stringify({
      offer: session.offer,
      answer: session.answer || null,
    }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Method not allowed', {
    status: 405,
    headers,
  })
}
