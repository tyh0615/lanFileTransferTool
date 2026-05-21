<template>
  <p class="text-xs text-[var(--color-text-secondary)] mb-3">
    点击下方按钮创建连接，对方可扫描二维码或输入连接码加入。
  </p>
  <button
    class="btn-primary w-full mb-3"
    :disabled="!canCreate"
    @click="handleCreate"
  >
    {{ creating ? '正在生成连接信息...' : '创建连接' }}
  </button>

  <!-- Connection info -->
  <div v-if="shareUrl" class="mt-3">
    <!-- Connection code: big & prominent -->
    <div class="text-center mb-4 p-4 bg-[var(--color-bg)] rounded-lg border-2 border-dashed border-[var(--color-primary)]">
      <span class="label-text block mb-2">连接码</span>
      <code class="text-2xl font-bold tracking-widest text-[var(--color-primary)]">{{ code }}</code>
      <button class="btn-outline text-xs! px-3! py-1! min-h-8! mt-2 block mx-auto" @click="handleCopyCode">
        {{ copiedCode ? '已复制' : '复制连接码' }}
      </button>
    </div>

    <!-- QR Code -->
    <div class="flex flex-col items-center mb-3 p-4 bg-white rounded-lg">
      <canvas ref="qrCanvas" class="w-40 h-40 md:w-48 md:h-48" />
      <span class="text-xs text-gray-500 mt-2">或扫描二维码加入</span>
    </div>

    <!-- Site URL -->
    <div class="mb-3">
      <span class="label-text">站点链接</span>
      <div class="flex items-center gap-2 mt-1">
        <code class="flex-1 text-xs p-2 rounded bg-[var(--color-bg)] break-all">{{ shareUrl }}</code>
        <button class="btn-outline text-xs! px-2! py-1! min-h-8! flex-shrink-0" @click="handleCopyUrl">
          {{ copiedUrl ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <!-- Status message -->
    <p v-if="usingApi" class="text-xs text-[var(--color-success)]">
      等待对方加入...连接将自动建立，无需其他操作。
    </p>
    <p v-else class="text-xs text-[var(--color-warning)]">
      请将连接信息发送给对方。对方加入后会产生回传信息，请粘贴到弹窗中完成连接。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import QRCode from 'qrcode'
import type { ConnectionState } from '../types'

const props = defineProps<{
  connectionState: ConnectionState
  shareUrl: string
  code: string
  creating: boolean
  usingApi: boolean
}>()

const emit = defineEmits<{
  create: []
}>()

const copiedUrl = ref(false)
const copiedCode = ref(false)
const qrCanvas = ref<HTMLCanvasElement>()

const canCreate = computed(() =>
  props.connectionState === 'idle' || props.connectionState === 'disconnected'
)

function handleCreate() {
  emit('create')
}

watch(() => props.shareUrl, async (url) => {
  if (!url) return
  await nextTick()
  if (qrCanvas.value) {
    try {
      await QRCode.toCanvas(qrCanvas.value, url, {
        width: 256,
        errorCorrectionLevel: 'L',
      })
    } catch {
      // URL too large for QR, canvas stays empty
    }
  }
})

async function copyText(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function handleCopyUrl() {
  copyText(props.shareUrl)
  copiedUrl.value = true
  setTimeout(() => { copiedUrl.value = false }, 2000)
}

function handleCopyCode() {
  copyText(props.code)
  copiedCode.value = true
  setTimeout(() => { copiedCode.value = false }, 2000)
}
</script>
