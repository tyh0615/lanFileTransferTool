<template>
  <!-- Tabs -->
    <div class="flex border-b border-[var(--color-border)] mb-3">
      <button
        class="flex-1 text-center text-xs px-3 py-2 bg-transparent border-none border-b-2 rounded-none cursor-pointer transition-colors duration-150"
        :class="activeTab === 'files' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] border-transparent'"
        @click="activeTab = 'files'"
      >
        文件 ({{ sentFiles.length }})
      </button>
      <button
        class="flex-1 text-center text-xs px-3 py-2 bg-transparent border-none border-b-2 rounded-none cursor-pointer transition-colors duration-150"
        :class="activeTab === 'texts' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] border-transparent'"
        @click="activeTab = 'texts'"
      >
        文本 ({{ sentTexts.length }})
      </button>
    </div>

    <!-- Files tab -->
    <div v-if="activeTab === 'files'">
      <div v-if="sentFiles.length === 0" class="text-xs text-[var(--color-text-secondary)] text-center py-4">
        暂无已发文件
      </div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="file in sentFiles"
          :key="file.id"
          class="flex items-center justify-between text-xs py-2 border-b border-[var(--color-border)] last:border-b-0"
        >
          <div class="flex-1 min-w-0">
            <div class="truncate">{{ file.name }}</div>
            <div class="text-[var(--color-text-secondary)]">{{ formatSize(file.size) }}</div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0"
            :class="file.status === 'completed' ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-error)]/20 text-[var(--color-error)]'"
          >
            {{ file.status === 'completed' ? '已发送' : '失败' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Texts tab -->
    <div v-if="activeTab === 'texts'">
      <div v-if="sentTexts.length === 0" class="text-xs text-[var(--color-text-secondary)] text-center py-4">
        暂无已发文本
      </div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="text in sentTexts"
          :key="text.id"
          class="text-xs py-2 border-b border-[var(--color-border)] last:border-b-0"
        >
          <div class="whitespace-pre-wrap break-all">{{ text.content }}</div>
          <div class="text-[var(--color-text-secondary)] mt-1">{{ formatTime(text.timestamp) }}</div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileTransferRecord, TextRecord } from '../types'

defineProps<{
  sentFiles: FileTransferRecord[]
  sentTexts: TextRecord[]
}>()

const activeTab = ref<'files' | 'texts'>('files')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}
</script>
