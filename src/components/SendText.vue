<template>
  <div class="card">
    <h3 class="section-title mb-3">发送文本</h3>
    <textarea
      v-model="text"
      class="input w-full mb-2"
      placeholder="输入要发送的文本内容..."
      rows="3"
      :disabled="!connected"
      @keydown.ctrl.enter="handleSend"
    />
    <div class="flex items-center justify-between">
      <span class="text-xs text-[var(--color-text-secondary)]">{{ text.length }} 字 | Ctrl+Enter 发送</span>
      <button
        class="btn-primary"
        :disabled="!text.trim() || !connected"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  connected: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const text = ref('')

function handleSend() {
  const content = text.value.trim()
  if (!content) return
  emit('send', content)
  text.value = ''
}
</script>
