import { ref } from 'vue'
import type { DataMessage, FileTransferRecord } from '../types'
import { CHUNK_SIZE, AUTO_DOWNLOAD_THRESHOLD } from '../types'

export function useFileTransfer() {
  const receivedFiles = ref<FileTransferRecord[]>([])
  const sentFiles = ref<FileTransferRecord[]>([])

  // Track active receives for chunk assembly
  const receiveBuffers = new Map<string, { record: FileTransferRecord; chunks: (ArrayBuffer | null)[] }>()

  function generateId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // ===== SEND =====
  async function sendFiles(dc: RTCDataChannel, files: File[]) {
    for (const file of files) {
      const fileId = generateId()
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

      // Send file-start message
      const startMsg: DataMessage = {
        type: 'file-start',
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      }
      dc.send(JSON.stringify(startMsg))

      // Add to sent list
      const record: FileTransferRecord = {
        id: fileId,
        name: file.name,
        size: file.size,
        fileType: file.type || 'application/octet-stream',
        progress: 0,
        status: 'transferring',
        direction: 'sent',
        chunks: [],
        totalChunks,
      }
      sentFiles.value.push(record)

      // Send chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)
        const buffer = await chunk.arrayBuffer()

        // Send chunk header as JSON, then binary data
        const chunkMsg: DataMessage = {
          type: 'file-chunk',
          fileId,
          chunkIndex: i,
          totalChunks,
        }
        dc.send(JSON.stringify(chunkMsg))
        dc.send(buffer)

        record.progress = Math.round(((i + 1) / totalChunks) * 100)
      }

      // Send file-end
      const endMsg: DataMessage = { type: 'file-end', fileId }
      dc.send(JSON.stringify(endMsg))
      record.status = 'completed'
    }
  }

  // ===== RECEIVE =====
  // Buffer to hold chunk data between JSON header and binary
  let pendingChunk: { fileId: string; chunkIndex: number; totalChunks: number } | null = null

  function handleMessage(data: string) {
    try {
      const msg: DataMessage = JSON.parse(data)
      switch (msg.type) {
        case 'file-start':
          handleFileStart(msg)
          break
        case 'file-chunk':
          pendingChunk = { fileId: msg.fileId, chunkIndex: msg.chunkIndex, totalChunks: msg.totalChunks }
          break
        case 'file-end':
          handleFileEnd(msg.fileId)
          break
        case 'file-cancel':
          handleFileCancel(msg.fileId)
          break
      }
    } catch {
      // Ignore malformed messages
    }
  }

  function onBinaryMessage(buffer: ArrayBuffer) {
    if (!pendingChunk) return

    const { fileId, chunkIndex, totalChunks } = pendingChunk
    pendingChunk = null

    const entry = receiveBuffers.get(fileId)
    if (!entry) return

    entry.chunks[chunkIndex] = buffer
    entry.record.progress = Math.round(
      (entry.chunks.filter(Boolean).length / totalChunks) * 100
    )

    // Check if all chunks received
    if (entry.chunks.every((c) => c !== null)) {
      completeReceive(fileId)
    }
  }

  function handleFileStart(msg: { fileId: string; fileName: string; fileSize: number; fileType: string }) {
    const totalChunks = Math.ceil(msg.fileSize / CHUNK_SIZE)
    const record: FileTransferRecord = {
      id: msg.fileId,
      name: msg.fileName,
      size: msg.fileSize,
      fileType: msg.fileType,
      progress: 0,
      status: 'transferring',
      direction: 'received',
      chunks: new Array(totalChunks).fill(null),
      totalChunks,
    }
    receivedFiles.value.push(record)
    receiveBuffers.set(msg.fileId, { record, chunks: record.chunks as (ArrayBuffer | null)[] })

    // For large files, show auto-download indicator
    if (msg.fileSize > AUTO_DOWNLOAD_THRESHOLD) {
      // Large file — will trigger download on completion
    }
  }

  function completeReceive(fileId: string) {
    const entry = receiveBuffers.get(fileId)
    if (!entry) return

    const { record, chunks } = entry
    const blob = new Blob(chunks as ArrayBuffer[], { type: record.fileType })
    const url = URL.createObjectURL(blob)

    record.status = 'completed'
    record.blobUrl = url

    // Auto-download for files > 10MB
    if (record.size > AUTO_DOWNLOAD_THRESHOLD) {
      triggerDownload(url, record.name)
    }

    receiveBuffers.delete(fileId)
  }

  function handleFileEnd(_fileId: string) {
    // If all chunks already received, this is a no-op (completeReceive already called)
    // If not all chunks received yet, mark for completion when they arrive
  }

  function handleFileCancel(fileId: string) {
    const record = receivedFiles.value.find((f) => f.id === fileId)
    if (record) {
      record.status = 'cancelled'
    }
    receiveBuffers.delete(fileId)
  }

  function triggerDownload(url: string, fileName: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function downloadFile(fileId: string) {
    const record = receivedFiles.value.find((f) => f.id === fileId)
    if (record?.blobUrl) {
      triggerDownload(record.blobUrl, record.name)
    }
  }

  function clearReceivedFiles() {
    // Revoke blob URLs
    for (const f of receivedFiles.value) {
      if (f.blobUrl) URL.revokeObjectURL(f.blobUrl)
    }
    receivedFiles.value = []
    receiveBuffers.clear()
  }

  return {
    receivedFiles,
    sentFiles,
    sendFiles,
    handleMessage,
    onBinaryMessage,
    downloadFile,
    clearReceivedFiles,
  }
}
