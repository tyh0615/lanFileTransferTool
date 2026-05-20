<template>
  <div v-if="files.length === 0" class="text-xs text-[var(--color-text-secondary)] text-center py-6">
      暂无接收文件
    </div>
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="file in files"
        :key="file.id"
        class="border border-[var(--color-border)] rounded-md p-3"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex-1 min-w-0">
            <div class="text-sm truncate">{{ file.name }}</div>
            <div class="text-xs text-[var(--color-text-secondary)]">{{ formatSize(file.size) }}</div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
            :class="statusClass(file.status)"
          >
            {{ statusText(file) }}
          </span>
        </div>
        <!-- Progress bar -->
        <div v-if="file.status === 'transferring'" class="w-full h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden mb-2">
          <div
            class="h-full bg-[var(--color-primary)] rounded-full transition-all duration-300"
            :style="{ width: file.progress + '%' }"
          />
        </div>
        <div v-if="file.status === 'transferring'" class="text-xs text-[var(--color-text-secondary)] text-right">
          {{ file.progress }}%
        </div>
        <!-- Download button -->
        <button
          v-if="file.status === 'completed' && file.size <= 10485760"
          class="btn-outline w-full mt-2 text-xs!"
          @click="$emit('download', file.id)"
        >
          下载文件
        </button>
        <div v-else-if="file.status === 'completed' && file.size > 10485760" class="text-xs text-[var(--color-success)] mt-1">
          已自动下载
        </div>
      </div>
    </div>
    <button
      v-if="files.length > 0"
      class="btn-danger w-full mt-3 text-xs!"
      @click="$emit('clear')"
    >
      清空接收列表
    </button>
</template>

<script setup lang="ts">
import type { FileTransferRecord } from '../types'

defineProps<{
  files: FileTransferRecord[]
}>()

defineEmits<{
  download: [id: string]
  clear: []
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function statusClass(status: string) {
  switch (status) {
    case 'completed': return 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
    case 'transferring': return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
    case 'failed':
    case 'cancelled': return 'bg-[var(--color-error)]/20 text-[var(--color-error)]'
    default: return ''
  }
}

function statusText(file: FileTransferRecord) {
  switch (file.status) {
    case 'completed': return '已完成'
    case 'transferring': return `${file.progress}%`
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    default: return ''
  }
}
</script>
