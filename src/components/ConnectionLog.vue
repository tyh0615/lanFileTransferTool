<template>
  <div v-if="logs.length === 0" class="text-xs text-[var(--color-text-secondary)] text-center py-6">
      暂无日志记录
    </div>
    <div v-else ref="logContainer" class="flex flex-col gap-2 max-h-60 overflow-y-auto">
      <div
        v-for="log in logs"
        :key="log.id"
        class="flex items-start gap-2 text-xs"
        :class="logLevelClass(log.level)"
      >
        <span class="text-[var(--color-text-secondary)] whitespace-nowrap font-mono flex-shrink-0">
          {{ formatTime(log.timestamp) }}
        </span>
        <span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" :class="logDotClass(log.level)" />
        <span class="break-all">{{ log.message }}</span>
      </div>
    </div>
    <button
      v-if="logs.length > 0"
      class="btn-danger w-full mt-3 text-xs!"
      @click="$emit('clear')"
    >
      清空日志
    </button>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { LogEntry } from '../types'

const props = defineProps<{
  logs: LogEntry[]
}>()

defineEmits<{
  clear: []
}>()

const logContainer = ref<HTMLElement>()

watch(() => props.logs.length, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function logLevelClass(level: string) {
  switch (level) {
    case 'error': return 'text-[var(--color-error)]'
    case 'warn': return 'text-[var(--color-warning)]'
    default: return 'text-[var(--color-text-secondary)]'
  }
}

function logDotClass(level: string) {
  switch (level) {
    case 'error': return 'bg-[var(--color-error)]'
    case 'warn': return 'bg-[var(--color-warning)]'
    default: return 'bg-[var(--color-info)]'
  }
}
</script>
