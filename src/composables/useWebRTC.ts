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
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: STUN_SERVER }],
  }

  // Shared IP extraction from ICE candidate string
  function extractIP(candidateStr: string): { ip: string; isLocal: boolean } | null {
    const ipMatch = candidateStr.match(/(\d+\.\d+\.\d+\.\d+)/)
    if (!ipMatch) return null
    const ip = ipMatch[1]
    if (ip === '0.0.0.0') return null
    const isLocal =
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.') ||
      ip.startsWith('127.') ||
      ip.startsWith('169.254.')
    return { ip, isLocal }
  }

  // Detect IPs from ICE candidates (used during connection setup)
  function bindIPDetection(pcInstance: RTCPeerConnection) {
    pcInstance.onicecandidate = (event) => {
      if (!event.candidate) return
      const result = extractIP(event.candidate.candidate)
      if (!result) return
      if (result.isLocal) {
        if (!ipInfo.value.localIP) ipInfo.value.localIP = result.ip
      } else {
        if (!ipInfo.value.publicIP) ipInfo.value.publicIP = result.ip
      }
    }
  }

  // Standalone IP detection — creates a temp PC just for STUN
  async function detectPublicIP(): Promise<void> {
    // Skip if already detected
    if (ipInfo.value.publicIP && ipInfo.value.localIP) return

    return new Promise((resolve) => {
      const tempPc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVER }] })
      let done = false

      const finish = () => {
        if (done) return
        done = true
        tempPc.close()
        resolve()
      }

      tempPc.onicecandidate = (event) => {
        if (!event.candidate) {
          finish()
          return
        }
        const result = extractIP(event.candidate.candidate)
        if (!result) return
        if (result.isLocal) {
          if (!ipInfo.value.localIP) ipInfo.value.localIP = result.ip
        } else {
          if (!ipInfo.value.publicIP) ipInfo.value.publicIP = result.ip
        }
      }

      tempPc.onicegatheringstatechange = () => {
        if (tempPc.iceGatheringState === 'complete') finish()
      }

      // Trigger ICE gathering
      tempPc.createDataChannel('ip-probe')
      tempPc.createOffer().then((offer) => tempPc.setLocalDescription(offer))

      // Timeout after 5s
      setTimeout(finish, 5000)
    })
  }

  // Uint8Array to base64 (chunked to avoid stack overflow)
  function uint8ToBase64(bytes: Uint8Array): string {
    const chunks: string[] = []
    const chunkSize = 0x2000
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

  // Compress SDP: JSON → deflate → base64
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

  // Check if API is available
  async function isApiAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/signaling', { method: 'OPTIONS' })
      return res.ok || res.status === 204
    } catch {
      return false
    }
  }

  // Poll for answer from signaling API
  function startPolling(code: string) {
    stopPolling()
    pollingTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/signaling?code=${code}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.answer) {
          stopPolling()
          await completeConnection(data.answer)
        }
      } catch {
        // API error, keep polling
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  // Create connection (offerer)
  async function createConnection(): Promise<{ code: string; url: string; usingApi: boolean }> {
    connectionState.value = 'creating'
    stopPolling()

    pc = new RTCPeerConnection(rtcConfig)
    bindIPDetection(pc)

    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === 'connected') {
        connectionState.value = 'connected'
        stopPolling()
      } else if (pc!.connectionState === 'disconnected' || pc!.connectionState === 'failed') {
        connectionState.value = 'disconnected'
        stopPolling()
      } else if (pc!.connectionState === 'connecting') {
        connectionState.value = 'creating'
      }
    }

    dc = pc.createDataChannel('transfer', { ordered: true })

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

    // Try to use signaling API
    try {
      const res = await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: packedSdp,
          publicIP: ipInfo.value.publicIP,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const code: string = data.code
        const url = `${origin}/#${code}`
        // Start polling for answer
        startPolling(code)
        return { code, url, usingApi: true }
      }
    } catch {
      // API unavailable, fall through to fallback
    }

    // Fallback: embed full SDP in URL hash
    const code = packedSdp.slice(0, 6)
    const url = `${origin}/#${packedSdp}`
    return { code, url, usingApi: false }
  }

  // Join connection (answerer)
  async function joinConnection(input: string): Promise<{ answerSdp: string; autoPosted: boolean; usingApi: boolean }> {
    connectionState.value = 'answering'

    let raw = input
    let usingApi = false
    let autoPosted = false
    let answerSdp = ''

    // If input looks like a short code, try to fetch from API
    if (/^[A-Z2-9]{6}$/.test(input.trim())) {
      const code = input.trim()
      try {
        const res = await fetch(`/api/signaling?code=${code}`)
        if (res.ok) {
          const data = await res.json()
          if (data.offer) {
            raw = data.offer
            usingApi = true
          }
        }
      } catch {
        // API unavailable, try parsing input as SDP
      }
    }

    const offer = parseSdp(raw)

    pc = new RTCPeerConnection(rtcConfig)
    bindIPDetection(pc)

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

    const packedAnswer = packSdp(pc.localDescription!)
    answerSdp = packedAnswer

    // If using API, post answer back so offerer can auto-complete
    if (usingApi) {
      const code = input.trim()
      try {
        const res = await fetch(`/api/signaling?code=${code}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sdp: packedAnswer }),
        })
        if (res.ok) {
          autoPosted = true
        }
      } catch {
        // API unavailable, fall through
      }
    }

    return { answerSdp, autoPosted, usingApi }
  }

  // Complete connection (offerer sets remote answer)
  async function completeConnection(encodedAnswer: string): Promise<void> {
    const answer = parseSdp(encodedAnswer)
    await pc!.setRemoteDescription(new RTCSessionDescription(answer))
  }

  // Disconnect
  function disconnect() {
    stopPolling()
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
    detectPublicIP,
    packSdp,
    unpackSdp,
    parseSdp,
    encodeSdp,
    decodeSdp,
  }
}
