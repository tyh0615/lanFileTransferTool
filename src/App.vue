<template>
  <div class="min-h-screen bg-[var(--color-bg)]">
    <!-- Header -->
    <header class="sticky top-0 z-100 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-[var(--color-text)]">局域网文件传输工具</h1>
      <div class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <span class="status-dot" :class="statusDotClass" />
        {{ statusLabel }}
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-350 mx-auto p-4 lg:p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <!-- ====== Left: Connection ====== -->
        <div class="flex flex-col gap-4">
          <ConnectionInfo
            :ip-info="ipInfo"
            :connection-state="connectionState"
            :channel-state="channelState"
          />

          <!-- Module 1: 连接 (创建 / 加入) -->
          <div class="card">
            <div class="flex border-b border-[var(--color-border)] -mx-4 md:-mx-6 px-4 md:px-6 mb-0">
              <button
                v-for="tab in connTabs"
                :key="tab.key"
                class="flex-1 text-center text-sm px-3 py-3 bg-transparent border-none border-b-2 rounded-none cursor-pointer transition-colors duration-150"
                :class="connTab === tab.key ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] border-transparent'"
                @click="connTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="pt-4">
              <CreateConnection
                v-if="connTab === 'create'"
                :connection-state="connectionState"
                :share-url="shareUrl"
                :code="code"
                :creating="connectionState === 'creating'"
                @create="handleCreate"
              />
              <JoinConnection
                v-else
                :connection-state="connectionState"
                :local-sdp="answerSdp"
                :joining="connectionState === 'answering'"
                :auto-s-d-p="autoJoinSdp"
                @join="handleJoin"
              />
            </div>
          </div>
        </div>

        <!-- ====== Center: Send Area ====== -->
        <div class="flex flex-col gap-4">
          <SendFile
            :connected="connectionState === 'connected'"
            :sending="sendingFiles"
            @send="handleSendFiles"
          />
          <SendText
            :connected="connectionState === 'connected'"
            @send="handleSendText"
          />
        </div>

        <!-- ====== Right: Receive & History ====== -->
        <div class="flex flex-col gap-4">
          <!-- Module 2: 接收 (文件 / 文本) -->
          <div class="card">
            <div class="flex border-b border-[var(--color-border)] -mx-4 md:-mx-6 px-4 md:px-6 mb-0">
              <button
                v-for="tab in receiveTabs"
                :key="tab.key"
                class="flex-1 text-center text-sm px-3 py-3 bg-transparent border-none border-b-2 rounded-none cursor-pointer transition-colors duration-150"
                :class="receiveTab === tab.key ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] border-transparent'"
                @click="receiveTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="pt-4">
              <FileReceiveList
                v-if="receiveTab === 'files'"
                :files="receivedFiles"
                @download="downloadFile"
                @clear="clearReceivedFiles"
              />
              <TextReceiveList
                v-else
                :texts="receivedTexts"
              />
            </div>
          </div>

          <!-- Module 3: 记录 (日志 / 已发送) -->
          <div v-if="showModule3" class="card">
            <div class="flex border-b border-[var(--color-border)] -mx-4 md:-mx-6 px-4 md:px-6 mb-0">
              <button
                v-for="tab in historyTabs"
                :key="tab.key"
                class="flex-1 text-center text-sm px-3 py-3 bg-transparent border-none border-b-2 rounded-none cursor-pointer transition-colors duration-150"
                :class="historyTab === tab.key ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] border-transparent'"
                @click="historyTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
            <div class="pt-4">
              <ConnectionLog
                v-if="historyTab === 'logs'"
                :logs="logs"
                @clear="clearLogs"
              />
              <SentList
                v-else
                :sent-files="sentFiles"
                :sent-texts="sentTexts"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Answer paste modal -->
    <Teleport to="body">
      <div
        v-if="showAnswerInput"
        class="fixed inset-0 bg-black/60 z-200 flex items-center justify-center p-4"
        @click.self="showAnswerInput = false"
      >
        <div class="card w-full max-w-lg" @click.stop>
          <h3 class="section-title mb-3">完成连接</h3>
          <p class="text-xs text-[var(--color-text-secondary)] mb-3">
            请粘贴对方回传的连接信息以完成连接建立。
          </p>
          <textarea
            v-model="remoteSdpInput"
            class="input w-full mb-3 font-mono! text-xs!"
            rows="4"
            placeholder="在此粘贴对方回传的连接信息..."
          />
          <div class="flex gap-3">
            <button class="btn-outline flex-1" @click="showAnswerInput = false">取消</button>
            <button
              class="btn-primary flex-1"
              :disabled="!remoteSdpInput.trim()"
              @click="handleComplete"
            >
              完成连接
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast -->
    <Teleport to="body">
      <div
        v-if="toast"
        class="fixed top-4 left-1/2 z-300 px-4 py-2 rounded-md text-sm text-white shadow-lg"
        :class="toastType === 'error' ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]'"
        style="transform: translateX(-50%)"
      >
        {{ toast }}
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useWebRTC } from './composables/useWebRTC'
import { useFileTransfer } from './composables/useFileTransfer'
import { useTextTransfer } from './composables/useTextTransfer'
import { useConnectionLog } from './composables/useConnectionLog'
import ConnectionInfo from './components/ConnectionInfo.vue'
import CreateConnection from './components/CreateConnection.vue'
import JoinConnection from './components/JoinConnection.vue'
import ConnectionLog from './components/ConnectionLog.vue'
import SendFile from './components/SendFile.vue'
import SendText from './components/SendText.vue'
import FileReceiveList from './components/FileReceiveList.vue'
import TextReceiveList from './components/TextReceiveList.vue'
import SentList from './components/SentList.vue'

// ===== Composables =====
const {
  ipInfo,
  connectionState,
  channelState,
  dataChannel,
  createConnection,
  joinConnection,
  completeConnection,
} = useWebRTC()

const {
  receivedFiles,
  sentFiles,
  sendFiles,
  handleMessage: handleFileMessage,
  onBinaryMessage,
  downloadFile,
  clearReceivedFiles,
} = useFileTransfer()

const {
  receivedTexts,
  sentTexts,
  sendText,
  handleMessage: handleTextMessage,
} = useTextTransfer()

const { logs, addLog, clearLogs } = useConnectionLog()

// ===== Tab state =====
const connTab = ref<'create' | 'join'>('create')
const receiveTab = ref<'files' | 'texts'>('files')
const historyTab = ref<'logs' | 'sent'>('logs')

const connTabs = [
  { key: 'create' as const, label: '创建连接' },
  { key: 'join' as const, label: '加入连接' },
]
const receiveTabs = [
  { key: 'files' as const, label: '文件接收' },
  { key: 'texts' as const, label: '文本接收' },
]
const historyTabs = [
  { key: 'logs' as const, label: '连接日志' },
  { key: 'sent' as const, label: '已发送' },
]

// ===== UI State =====
const shareUrl = ref('')
const code = ref('')
const answerSdp = ref('')
const autoJoinSdp = ref('')
const showAnswerInput = ref(false)
const remoteSdpInput = ref('')
const sendingFiles = ref(false)
const toast = ref('')
const toastType = ref<'success' | 'error'>('success')

// ===== Computed =====
const statusDotClass = computed(() => {
  switch (connectionState.value) {
    case 'connected': return 'bg-[var(--color-success)]'
    case 'disconnected':
    case 'error': return 'bg-[var(--color-error)]'
    case 'idle': return 'bg-[var(--color-text-secondary)]'
    default: return 'bg-[var(--color-warning)]'
  }
})

const statusLabel = computed(() => {
  switch (connectionState.value) {
    case 'idle': return '未连接'
    case 'creating': return '正在创建...'
    case 'offering': return '等待加入'
    case 'answering': return '正在加入...'
    case 'connected': return '已连接'
    case 'disconnected': return '已断开'
    case 'error': return '错误'
  }
})

const showModule3 = computed(() =>
  connectionState.value === 'connected' ||
  sentFiles.value.length > 0 ||
  sentTexts.value.length > 0
)

// ===== WebRTC DataChannel message handler =====
watch(dataChannel, (dc) => {
  if (!dc) return
  dc.onmessage = (event) => {
    if (typeof event.data === 'string') {
      handleFileMessage(event.data)
      handleTextMessage(event.data)
    } else if (event.data instanceof ArrayBuffer) {
      onBinaryMessage(event.data)
    }
  }
})

// ===== Auto-join from URL hash =====
onMounted(() => {
  const hash = window.location.hash.slice(1)
  if (hash) {
    autoJoinSdp.value = hash
    connTab.value = 'join'
  }
})

// ===== Connection handlers =====
async function handleCreate() {
  try {
    addLog('开始创建连接...', 'info')
    const result = await createConnection()
    shareUrl.value = result.url
    code.value = result.code
    addLog('连接信息已生成，请复制发送给对方', 'info')
  } catch (e: any) {
    addLog(`创建连接失败: ${e.message}`, 'error')
    showToast('创建连接失败', 'error')
  }
}

async function handleJoin(offerStr: string) {
  try {
    addLog('开始加入连接...', 'info')
    const sdp = await joinConnection(offerStr)
    answerSdp.value = sdp
    addLog('回传信息已生成，请复制发送给对方', 'info')
  } catch (e: any) {
    addLog(`加入连接失败: ${e.message}`, 'error')
    showToast('加入连接失败，请检查连接信息是否有效', 'error')
  }
}

watch(connectionState, (state) => {
  if (state === 'offering') {
    showAnswerInput.value = true
  }
})

async function handleComplete() {
  try {
    addLog('正在完成连接...', 'info')
    await completeConnection(remoteSdpInput.value)
    addLog('连接已建立！可以开始传输文件和文本', 'info')
    showAnswerInput.value = false
    remoteSdpInput.value = ''
    showToast('连接成功', 'success')
  } catch (e: any) {
    addLog(`完成连接失败: ${e.message}`, 'error')
    showToast('连接失败，请检查回传信息是否有效', 'error')
  }
}

async function handleSendFiles(files: File[]) {
  if (!dataChannel.value) return
  sendingFiles.value = true
  try {
    await sendFiles(dataChannel.value, files)
    addLog(`已发送 ${files.length} 个文件`, 'info')
    showToast(`已发送 ${files.length} 个文件`, 'success')
  } catch (e: any) {
    addLog(`文件发送失败: ${e.message}`, 'error')
    showToast('文件发送失败', 'error')
  } finally {
    sendingFiles.value = false
  }
}

function handleSendText(content: string) {
  if (!dataChannel.value) return
  sendText(dataChannel.value, content)
  addLog('已发送文本消息', 'info')
}

function showToast(msg: string, type: 'success' | 'error') {
  toast.value = msg
  toastType.value = type
  setTimeout(() => { toast.value = '' }, 2500)
}
</script>
