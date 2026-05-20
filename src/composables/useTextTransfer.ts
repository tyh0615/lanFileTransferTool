import { ref } from 'vue'
import type { DataMessage, TextRecord } from '../types'

export function useTextTransfer() {
  const receivedTexts = ref<TextRecord[]>([])
  const sentTexts = ref<TextRecord[]>([])

  function generateId(): string {
    return `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function sendText(dc: RTCDataChannel, content: string) {
    const msg: DataMessage = {
      type: 'text',
      content,
      timestamp: Date.now(),
    }
    dc.send(JSON.stringify(msg))

    sentTexts.value.push({
      id: generateId(),
      content,
      timestamp: Date.now(),
      direction: 'sent',
    })
  }

  function handleMessage(data: string) {
    try {
      const msg: DataMessage = JSON.parse(data)
      if (msg.type === 'text') {
        receivedTexts.value.push({
          id: generateId(),
          content: msg.content,
          timestamp: msg.timestamp,
          direction: 'received',
        })
      }
    } catch {
      // Ignore non-JSON or malformed messages
    }
  }

  async function copyText(content: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    }
  }

  return {
    receivedTexts,
    sentTexts,
    sendText,
    handleMessage,
    copyText,
  }
}
