<template>
  <div class="card">
    <h3 class="section-title mb-3">发送文件</h3>
    <div
      class="border-2 border-dashed rounded-lg p-4 md:p-6 text-center cursor-pointer transition-colors duration-150 mb-3"
      :class="isDragging ? 'border-[var(--color-primary)] bg-[var(--color-surface-hover)]' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="openFilePicker"
    >
      <div class="text-3xl mb-2">+</div>
      <p class="text-sm text-[var(--color-text-secondary)]">
        拖拽文件到此处或点击选择
      </p>
    </div>
    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden"
      @change="handleFileChange"
    />
    <!-- Selected files -->
    <div v-if="selectedFiles.length > 0" class="mb-3">
      <div
        v-for="(file, idx) in selectedFiles"
        :key="idx"
        class="flex items-center justify-between text-xs py-2 border-b border-[var(--color-border)] last:border-b-0"
      >
        <div class="flex-1 min-w-0">
          <div class="truncate">{{ file.name }}</div>
          <div class="text-[var(--color-text-secondary)]">{{ formatSize(file.size) }}</div>
        </div>
        <button
          class="btn-danger text-xs! px-2! py-1! min-h-8! ml-2"
          @click="removeFile(idx)"
        >
          移除
        </button>
      </div>
    </div>
    <button
      class="btn-primary w-full"
      :disabled="selectedFiles.length === 0 || !connected"
      @click="handleSend"
    >
      {{ sending ? '发送中...' : `发送文件 (${selectedFiles.length})` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  connected: boolean
  sending: boolean
}>()

const emit = defineEmits<{
  send: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement>()
const selectedFiles = ref<File[]>([])
const isDragging = ref(false)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    selectedFiles.value.push(...Array.from(input.files))
    input.value = ''
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    selectedFiles.value.push(...Array.from(e.dataTransfer.files))
  }
}

function removeFile(idx: number) {
  selectedFiles.value.splice(idx, 1)
}

function handleSend() {
  if (selectedFiles.value.length === 0) return
  emit('send', [...selectedFiles.value])
  selectedFiles.value = []
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
</script>
