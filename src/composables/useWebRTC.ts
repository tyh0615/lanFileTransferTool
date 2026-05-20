import { ref, shallowRef } from 'vue'
import { deflate, inflate } from 'pako'
import type { ConnectionState, ChannelState, IpInfo, SdpPayload } from '../types'
import { STUN_SERVER } from '../types'

export function useWebRTC() {
  const ipInfo = ref<IpInfo>({ publicIP: '', localIP: '' })
  const connectionState = ref<ConnectionState>('idle')
  const channelState = ref<ChannelState>('closed')

  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  const dataChannel = shallowRef<RTCDataChannel | null>(null)

  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: STUN_SERVER }],
  }

  // Detect IPs from ICE candidates
  function detectIPs() {
    if (!pc) return
    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      const candidate = event.candidate.candidate
      // Extract IP from candidate string
      const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
      if (!ipMatch) return

      const ip = ipMatch[1]
      // Check if it's a private/local IP
      if (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        ip.startsWith('172.') ||
        ip.startsWith('127.') ||
        ip.startsWith('169.254.') ||
        ip === '0.0.0.0'
      ) {
        if (ip !== '0.0.0.0') {
          ipInfo.value.localIP = ip
        }
      } else {
        ipInfo.value.publicIP = ip
      }
    }
  }

  // Uint8Array to base64 (chunked to avoid stack overflow)
  function uint8ToBase64(bytes: Uint8Array): string {
    const chunks: string[] = []
    const chunkSize = 0x2000 // 8KB
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)))
    }
    return btoa(chunks.join(''))
  }

  // Base64 to Uint8Array
  function base64ToUint8(b64: string): Uint8Array {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  // Compress SDP: JSON → deflate → base64 (much shorter for QR codes)
  function packSdp(sdp: RTCSessionDescriptionInit): string {
    const json = JSON.stringify({ type: sdp.type, sdp: sdp.sdp })
    return uint8ToBase64(deflate(json))
  }

  // Decompress SDP: base64 → inflate → JSON parse
  function unpackSdp(packed: string): RTCSessionDescriptionInit {
    const decompressed = inflate(base64ToUint8(packed), { to: 'string' })
    return JSON.parse(decompressed)
  }

  // Legacy SDP encode/decode (fallback for backward compat)
  function encodeSdp(sdp: RTCSessionDescriptionInit): string {
    return btoa(JSON.stringify({ type: sdp.type, sdp: sdp.sdp }))
  }

  function decodeSdp(encoded: string): RTCSessionDescriptionInit {
    const payload: SdpPayload = JSON.parse(atob(encoded))
    return { type: payload.type, sdp: payload.sdp }
  }

  // Try unpack first (new compressed format), fallback to legacy decode
  function parseSdp(raw: string): RTCSessionDescriptionInit {
    try {
      return unpackSdp(raw)
    } catch {
      return decodeSdp(raw)
    }
  }

  // Create connection (offerer)
  async function createConnection(): Promise<{ code: string; url: string }> {
    connectionState.value = 'creating'

    pc = new RTCPeerConnection(rtcConfig)
    detectIPs()

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'connected') {
        connectionState.value = 'connected'
      } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        connectionState.value = 'disconnected'
      } else if (pc!.connectionState === 'connecting') {
        connectionState.value = 'creating'
      }
    }

    dc = pc.createDataChannel('transfer', {
      ordered: true,
    })

    dc.onopen = () => {
      channelState.value = 'open'
      dataChannel.value = dc
    }

    dc.onclose = () => {
      channelState.value = 'closed'
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      if (pc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        pc!.onicegatheringstatechange = () => {
          if (pc!.iceGatheringState === 'complete') resolve()
        }
      }
    })

    connectionState.value = 'offering'

    const packedSdp = packSdp(pc.localDescription!)
    const host = ipInfo.value.localIP || window.location.hostname
    const port = window.location.port
    const origin = port ? `http://${host}:${port}` : `http://${host}`

    // Post SDP to signaling API, get back short code
    let code: string
    try {
      const res = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: packedSdp }),
      })
      if (res.ok) {
        const data = await res.json()
        code = data.code
      } else {
        // Fallback: use first 6 chars of packed SDP as pseudo-code
        code = packedSdp.slice(0, 6)
      }
    } catch {
      // API unavailable (e.g. production build), fallback to full SDP in hash
      const url = `${origin}/#${packedSdp}`
      return { code: packedSdp.slice(0, 6), url }
    }

    const url = `${origin}/#${code}`

    return { code, url }
  }

  // Join connection (answerer)
  async function joinConnection(encodedOffer: string): Promise<string> {
    connectionState.value = 'answering'

    let raw = encodedOffer
    // If input looks like a short code (6 alphanumeric chars), fetch SDP from API
    if (/^[A-Z2-9]{6}$/.test(encodedOffer.trim())) {
      try {
        const res = await fetch(`/api/signaling?code=${encodedOffer.trim()}`)
        if (res.ok) {
          raw = await res.text()
        }
        // If fetch fails, try parsing as-is (fallback)
      } catch {
        // API unavailable, try legacy parse
      }
    }

    const offer = parseSdp(raw)

    pc = new RTCPeerConnection(rtcConfig)
    detectIPs()

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'connected') {
        connectionState.value = 'connected'
      } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        connectionState.value = 'disconnected'
      }
    }

    pc.ondatachannel = (event) => {
      dc = event.channel
      dc.onopen = () => {
        channelState.value = 'open'
        dataChannel.value = dc
      }
      dc.onclose = () => {
        channelState.value = 'closed'
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      if (pc!.iceGatheringState === 'complete') {
        resolve()
      } else {
        pc!.onicegatheringstatechange = () => {
          if (pc!.iceGatheringState === 'complete') resolve()
        }
      }
    })

    return packSdp(pc.localDescription!)
  }

  // Complete connection (offerer sets answer)
  async function completeConnection(encodedAnswer: string): Promise<void> {
    const answer = parseSdp(encodedAnswer)
    await pc!.setRemoteDescription(new RTCSessionDescription(answer))
  }

  // Disconnect
  function disconnect() {
    if (dc) {
      dc.close()
      dc = null
      dataChannel.value = null
    }
    if (pc) {
      pc.close()
      pc = null
    }
    connectionState.value = 'idle'
    channelState.value = 'closed'
  }

  return {
    ipInfo,
    connectionState,
    channelState,
    dataChannel,
    createConnection,
    joinConnection,
    completeConnection,
    disconnect,
    packSdp,
    unpackSdp,
    parseSdp,
    encodeSdp,
    decodeSdp,
  }
}
