import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
  ],
  shortcuts: {
    'card': 'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 md:p-6 shadow-md',
    'btn': 'rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 cursor-pointer border-none min-h-11 min-w-11 disabled:opacity-50 disabled:cursor-not-allowed',
    'btn-primary': 'btn bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:shadow-[0_2px_8px_rgba(79,124,255,0.25)]',
    'btn-outline': 'btn bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white',
    'btn-success': 'btn bg-[var(--color-success)] text-white',
    'btn-danger': 'btn bg-transparent text-[var(--color-error)] border border-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white',
    'input': 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-[var(--color-primary)]',
    'status-dot': 'inline-block w-2 h-2 rounded-full mr-1',
    'label-text': 'text-xs text-[var(--color-text-secondary)] uppercase tracking-wide font-medium',
    'section-title': 'text-sm font-semibold text-[var(--color-text)] mb-3',
  },
  theme: {
    colors: {
      primary: '#4f7cff',
      'primary-hover': '#6690ff',
      success: '#2ecc71',
      warning: '#f39c12',
      error: '#e74c3c',
      info: '#3498db',
    },
  },
})
