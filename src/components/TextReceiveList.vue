<template>
  <div v-if="texts.length === 0" class="text-xs text-[var(--color-text-secondary)] text-center py-6">
      暂无接收文本
    </div>
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="text in texts"
        :key="text.id"
        class="border border-[var(--color-border)] rounded-md p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-sm whitespace-pre-wrap break-all">{{ text.content }}</div>
            <div class="text-xs text-[var(--color-text-secondary)] mt-1">
              {{ formatTime(text.timestamp) }}
            </div>
          </div>
          <button
            class="btn-outline text-xs! px-2! py-1! min-h-8! flex-shrink-0"
            @click="handleCopy(text.content)"
          >
            {{ copiedId === text.id ? '已复制' : '复制' }}
          </button>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TextRecord } from '../types'

defineProps<{
  texts: TextRecord[]
}>()

const copiedId = ref<string>()

async function handleCopy(content: string) {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  copiedId.value = content
  setTimeout(() => {
    copiedId.value = undefined
  }, 2000)
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}
</script>
