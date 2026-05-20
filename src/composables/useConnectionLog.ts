import { ref } from 'vue'
import type { LogEntry } from '../types'

export function useConnectionLog() {
  const logs = ref<LogEntry[]>([])
  let nextId = 0

  function addLog(message: string, level: LogEntry['level'] = 'info') {
    logs.value.push({
      id: nextId++,
      timestamp: Date.now(),
      message,
      level,
    })
  }

  function clearLogs() {
    logs.value = []
  }

  return { logs, addLog, clearLogs }
}
