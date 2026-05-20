/* ===== Data Channel Messages ===== */
export interface TextMessage {
  type: 'text'
  content: string
  timestamp: number
}

export interface FileStartMessage {
  type: 'file-start'
  fileId: string
  fileName: string
  fileSize: number
  fileType: string
}

export interface FileChunkMessage {
  type: 'file-chunk'
  fileId: string
  chunkIndex: number
  totalChunks: number
}

export interface FileEndMessage {
  type: 'file-end'
  fileId: string
}

export interface FileCancelMessage {
  type: 'file-cancel'
  fileId: string
}

export type DataMessage =
  | TextMessage
  | FileStartMessage
  | FileChunkMessage
  | FileEndMessage
  | FileCancelMessage

/* ===== Connection States ===== */
export type ConnectionState =
  | 'idle'
  | 'creating'
  | 'offering'
  | 'answering'
  | 'connected'
  | 'disconnected'
  | 'error'

export type ChannelState = 'closed' | 'opening' | 'open'

/* ===== IP Info ===== */
export interface IpInfo {
  publicIP: string
  localIP: string
}

/* ===== Transfer Records ===== */
export type TransferDirection = 'sent' | 'received'
export type TransferStatus = 'transferring' | 'completed' | 'failed' | 'cancelled'

export interface FileTransferRecord {
  id: string
  name: string
  size: number
  fileType: string
  progress: number // 0-100
  status: TransferStatus
  direction: TransferDirection
  chunks: (ArrayBuffer | null)[] // null until chunk received
  totalChunks: number
  blobUrl?: string
}

export interface TextRecord {
  id: string
  content: string
  timestamp: number
  direction: TransferDirection
}

/* ===== Connection Log ===== */
export interface LogEntry {
  id: number
  timestamp: number
  message: string
  level: 'info' | 'warn' | 'error'
}

/* ===== SDP Encoding ===== */
export interface SdpPayload {
  type: RTCSdpType
  sdp: string
}

/* ===== Constants ===== */
export const CHUNK_SIZE = 16384 // 16KB
export const AUTO_DOWNLOAD_THRESHOLD = 10 * 1024 * 1024 // 10MB
export const STUN_SERVER = 'stun:stun.l.google.com:19302'
