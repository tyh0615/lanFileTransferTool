<template>
  <p class="text-xs text-[var(--color-text-secondary)] mb-3">
    扫描对方二维码，或粘贴对方的连接信息后点击一键加入。
  </p>

  <!-- Scan QR button -->
  <button
    class="btn-outline w-full mb-3"
    :disabled="joining"
    @click="startScan"
  >
    {{ scanning ? '扫描中...' : '扫描二维码' }}
  </button>

  <!-- Scanner view -->
  <div v-if="scanning" class="mb-3">
    <div ref="scannerContainer" class="w-full rounded-md overflow-hidden" />
    <button
      class="btn-danger w-full mt-2 text-xs!"
      @click="stopScan"
    >
      取消扫描
    </button>
  </div>

  <div class="flex items-center gap-2 mb-3">
    <div class="flex-1 h-px bg-[var(--color-border)]" />
    <span class="text-xs text-[var(--color-text-secondary)]">或手动粘贴</span>
    <div class="flex-1 h-px bg-[var(--color-border)]" />
  </div>

  <textarea
    v-model="inputSdp"
    class="input w-full mb-3 font-mono! text-xs!"
    placeholder="在此粘贴对方的 6 位连接码或连接信息..."
    rows="4"
  />
  <button
    class="btn-primary w-full mb-3"
    :disabled="!inputSdp.trim() || joining"
    @click="handleJoin"
  >
    {{ joining ? '正在加入...' : '一键加入' }}
  </button>

  <!-- Answer SDP Display (only when NOT auto-posted) -->
  <div v-if="localSdp && !autoPosted" class="mt-3">
    <div class="flex items-center justify-between mb-2">
      <span class="label-text">回传信息（发送给对方）</span>
      <button class="btn-outline text-xs! px-2! py-1! min-h-8!" @click="handleCopy">
        {{ copied ? '已复制' : '一键复制' }}
      </button>
    </div>
    <pre class="max-h-40 overflow-y-auto text-xs! p-3!">{{ localSdp }}</pre>
    <p class="text-xs text-[var(--color-warning)] mt-2">
      请将以上回传信息复制发送给对方，对方粘贴后即可完成连接。
    </p>
  </div>

  <!-- Auto-complete indicator -->
  <div v-if="autoPosted" class="mt-3 p-3 rounded-md bg-[var(--color-success)]/10 border border-[var(--color-success)] text-xs text-[var(--color-success)]">
    连接信息已自动回传，等待对方确认建立连接...
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import type { ConnectionState } from '../types'

const props = defineProps<{
  connectionState: ConnectionState
  localSdp: string
  joining: boolean
  autoSdp?: string
  autoPosted: boolean
}>()

const emit = defineEmits<{
  join: [sdp: string]
}>()

const inputSdp = ref('')
const copied = ref(false)
const scanning = ref(false)
const scannerContainer = ref<HTMLDivElement>()

let scanner: Html5Qrcode | null = null

// Auto-join from URL hash (scanned QR code or shared link)
watch(() => props.autoSdp, (sdp) => {
  if (sdp) {
    inputSdp.value = sdp
    emit('join', sdp)
  }
}, { immediate: true })

async function startScan() {
  scanning.value = true
  await nextTick()

  const containerId = 'qr-scanner-' + Date.now()
  if (scannerContainer.value) {
    scannerContainer.value.id = containerId
  }

  scanner = new Html5Qrcode(containerId)

  try {
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText: string) => {
        inputSdp.value = decodedText
        stopScan()
        if (decodedText.trim()) {
          emit('join', decodedText.trim())
        }
      },
      () => {
        // scan failure — ignore
      },
    )
  } catch (err: any) {
    scanning.value = false
    scanner = null
  }
}

async function stopScan() {
  if (scanner) {
    try {
      await scanner.stop()
    } catch {
      // ignore stop errors
    }
    scanner = null
  }
  scanning.value = false
}

async function handleJoin() {
  if (!inputSdp.value.trim()) return
  emit('join', inputSdp.value.trim())
}

async function handleCopy() {
  if (!props.localSdp) return
  try {
    await navigator.clipboard.writeText(props.localSdp)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = props.localSdp
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
