<template>
  <div class="card">
    <h3 class="section-title mb-3">连接信息</h3>
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="label-text">公网 IP</span>
        <span class="font-mono text-sm" :class="ipInfo.publicIP ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'">
          {{ ipInfo.publicIP || '获取中...' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="label-text">局域网 IP</span>
        <span class="font-mono text-sm" :class="ipInfo.localIP ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'">
          {{ ipInfo.localIP || '获取中...' }}
        </span>
      </div>
      <div class="h-px bg-[var(--color-border)] my-1" />
      <div class="flex items-center justify-between">
        <span class="label-text">连接状态</span>
        <span class="flex items-center gap-1 text-sm">
          <span class="status-dot" :class="connectionStatusClass" />
          {{ connectionStatusText }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="label-text">通道状态</span>
        <span class="flex items-center gap-1 text-sm">
          <span class="status-dot" :class="channelStatusClass" />
          {{ channelStatusText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConnectionState, ChannelState, IpInfo } from '../types'

const props = defineProps<{
  ipInfo: IpInfo
  connectionState: ConnectionState
  channelState: ChannelState
}>()

const connectionStatusMap: Record<ConnectionState, string> = {
  idle: '未连接',
  creating: '正在创建...',
  offering: '等待对方加入',
  answering: '正在加入...',
  connected: '已连接',
  disconnected: '已断开',
  error: '错误',
}

const connectionStatusClass = computed(() => {
  switch (props.connectionState) {
    case 'connected': return 'bg-[var(--color-success)]'
    case 'disconnected':
    case 'error': return 'bg-[var(--color-error)]'
    case 'idle': return 'bg-[var(--color-text-secondary)]'
    default: return 'bg-[var(--color-warning)]'
  }
})

const connectionStatusText = computed(() => connectionStatusMap[props.connectionState])

const channelStatusClass = computed(() => {
  switch (props.channelState) {
    case 'open': return 'bg-[var(--color-success)]'
    case 'opening': return 'bg-[var(--color-warning)]'
    default: return 'bg-[var(--color-text-secondary)]'
  }
})

const channelStatusText = computed(() => {
  switch (props.channelState) {
    case 'open': return '已打开'
    case 'opening': return '正在打开'
    default: return '未打开'
  }
})
</script>
