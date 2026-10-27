<!-- components/ui/MoloSticker.vue -->
<script setup lang="ts">
import { computed } from 'vue'

export type StickerName =
// Разделы и шаблоны
    | 'departments' | 'it' | 'finance' | 'bank' | 'bank_accounts' | 'counterparties'
    | 'nomenclature' | 'warehouse' | 'glossary' | 'construction' | 'store' | 'sales'
    | 'management' | 'production' | 'services'
    // Файлы, действия и тулбары
    | 'folder' | 'folder-open' | 'history' | 'lock' | 'unlock' | 'key' | 'shield'
    | 'edit' | 'trash' | 'phone' | 'mail' | 'send' | 'archive'
    | 'zoom-in' | 'zoom-out' | 'rotate' | 'print' | 'download' | 'upload'
    | 'fullscreen' | 'fullscreen-exit'
    | 'refresh' | 'check' | 'check-circle' | 'search' | 'filter' | 'cloud'
    | 'settings' | 'alert' | 'alert-circle' | 'info' | 'help' | 'link' | 'unlink' | 'external-link'
    // Управление процессами и рантайм (стоп, контекст и плеер)
    | 'stop' | 'play' | 'pause' | 'context' | 'menu' | 'more-h' | 'more-v'
    | 'terminal' | 'server' | 'database' | 'cpu' | 'bug' | 'code' | 'command'
    // Графики и аналитика
    | 'chart-area' | 'chart-line' | 'chart-bar' | 'chart-hbar' | 'chart-donut'
    | 'chart-histogram' | 'chart-empty' | 'sigma' | 'table' | 'trophy' | 'trend-up' | 'trend-down'
    | 'layers' | 'grid' | 'pie-chart' | 'activity'
    // Dev-инструменты
    | 'dev-json' | 'dev-regex' | 'dev-encode' | 'dev-notes' | 'dev-calculator' | 'dev-clock' | 'dev-calendar'
    // Редактор и базовые глифы
    | 'cursor' | 'type' | 'highlighter' | 'pen' | 'square' | 'circle' | 'arrow' | 'image'
    | 'signature' | 'stamp' | 'undo' | 'redo' | 'fit' | 'save' | 'rotate-cw' | 'rotate-ccw'
    | 'file-plus' | 'up' | 'down' | 'left' | 'right' | 'copy' | 'sidebar' | 'x' | 'plus' | 'minus'
    | 'user' | 'user-plus' | 'user-check' | 'users' | 'eye' | 'eye-off'

type PathDef = string | { d: string; dash?: string; fill?: boolean; o?: number }

const props = withDefaults(
    defineProps<{
      name: StickerName | string
      size?: number | string
      glow?: boolean
      color?: string
      strokeWidth?: number | string
    }>(),
    {
      size: 16,
      glow: false,
      color: undefined,
      strokeWidth: 1.8
    }
)

const resolvedSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))

const ALIASES: Record<string, string> = {
  bank_accounts: 'bank',
  warehouse: 'nomenclature',
  sales: 'store',
  rotate: 'rotate-cw',
  edit: 'pen',
  close: 'x',
  printer: 'print',
  sync: 'refresh',
  menu: 'context',
  options: 'context',
  'more-horizontal': 'more-h',
  'more-vertical': 'more-v'
}

const ICONS: Record<string, PathDef[]> = {
  /* ───── Разделы и шаблоны ───── */
  departments: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75'
  ],
  it: [
    'M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M8 21h8',
    'M12 17v4',
    'm9.5 7-2 2.5 2 2.5',
    'm14.5 7 2 2.5-2 2.5'
  ],
  finance: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8',
    'M12 18V6'
  ],
  bank: [
    'M3 22h18',
    'M6 18v-7',
    'M10 18v-7',
    'M14 18v-7',
    'M18 18v-7',
    'M12 2 20 7H4z'
  ],
  counterparties: [
    'M8.5 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M15.5 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'
  ],
  nomenclature: [
    'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
    'M12 22V12',
    'm3.3 7 8.7 5 8.7-5',
    'm7.5 4.27 9 5.15'
  ],
  construction: [
    'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
    'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
    'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
    'M10 6h4',
    'M10 10h4',
    'M10 14h4',
    'M10 18h4'
  ],
  store: [
    'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'
  ],
  management: [
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    'm9 12 2 2 4-4'
  ],
  production: [
    'M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
    'M17 18h1',
    'M12 18h1',
    'M7 18h1'
  ],
  services: [
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
  ],
  glossary: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'
  ],

  /* ───── Управление процессами, рантайм и контекст ───── */
  stop: [
    'M6 6h12v12H6z'
  ],
  play: [
    'm6 4 14 8-14 8V4z'
  ],
  pause: [
    'M6 4h4v16H6z',
    'M14 4h4v16h-4z'
  ],
  context: [
    'M4 6h16',
    'M4 12h16',
    'M4 18h16'
  ],
  'more-h': [
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'
  ],
  'more-v': [
    'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'
  ],
  terminal: [
    'm4 17 6-6-6-6',
    'M12 19h8',
    'M2 3h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'
  ],
  server: [
    'M2 4h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M2 14h20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z',
    'M6 8h.01',
    'M6 18h.01'
  ],
  database: [
    'M12 3c-4.97 0-9 1.34-9 3v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6c0-1.66-4.03-3-9-3z',
    'M3 10.5c0 1.66 4.03 3 9 3s9-1.34 9-3',
    'M3 15c0 1.66 4.03 3 9 3s9-1.34 9-3'
  ],
  cpu: [
    'M4 4h16v16H4z',
    'M9 9h6v6H9z',
    'M9 1v3', 'M15 1v3',
    'M9 20v3', 'M15 20v3',
    'M1 9h3', 'M1 15h3',
    'M20 9h3', 'M20 15h3'
  ],
  bug: [
    'm8 2 1.88 1.88',
    'M14.12 3.88 16 2',
    'M9 7.13v-1a3.003 3.003 0 1 1 6 0v1',
    'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6',
    'M12 20v-9',
    'M6.53 9C4.6 8.8 3 7.1 3 5',
    'M6 13H2',
    'M3 21c0-2.1 1.7-3.9 3.8-4',
    'M20.97 5c0 2.1-1.6 3.8-3.5 4',
    'M22 13h-4',
    'M17.2 17c2.1.1 3.8 1.9 3.8 4'
  ],
  code: [
    'm16 18 6-6-6-6',
    'm8 6-6 6 6 6'
  ],
  command: [
    'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z'
  ],

  /* ───── Безопасность и аккаунты ───── */
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
  ],
  unlock: [
    'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 9.9-1'
  ],
  key: [
    'm21 2-2 2m-1.5 1.5L14 9l2 2-1 1 2 2-1 1 2 2-2.5 2.5a6 6 0 1 1-3-3L18 3.5z',
    'M7 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
  ],
  user: [
    'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
  ],
  'user-plus': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M19 8v6',
    'M22 11h-6'
  ],
  'user-check': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'm16 11 2 2 4-4'
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75'
  ],
  eye: [
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
  ],
  'eye-off': [
    'M9.88 9.88a3 3 0 1 0 4.24 4.24',
    'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68',
    'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61',
    'm2 2 20 20'
  ],

  /* ───── Файлы, действия и коммуникации ───── */
  folder: [
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z'
  ],
  'folder-open': [
    'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'
  ],
  history: [
    'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M12 7v5l4 2'
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4'
  ],
  pen: [
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6'
  ],
  phone: [
    'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384'
  ],
  mail: [
    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'm22 6-10 7L2 6'
  ],
  send: [
    'm22 2-7 20-4-9-9-4Z',
    'M22 2 11 13'
  ],
  archive: [
    'M21 8v13H3V8',
    'M1 3h22v5H1z',
    'M10 12h4'
  ],
  'zoom-in': [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'm21 21-4.3-4.3',
    'M11 8v6',
    'M8 11h6'
  ],
  'zoom-out': [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'm21 21-4.3-4.3',
    'M8 11h6'
  ],
  'rotate-cw': [
    'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8',
    'M21 3v5h-5'
  ],
  'rotate-ccw': [
    'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5'
  ],
  print: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z'
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'm7 10 5 5 5-5',
    'M12 15V3'
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'm17 8-5-5-5 5',
    'M12 3v12'
  ],
  fullscreen: [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M21 8V5a2 2 0 0 0-2-2h-3',
    'M3 16v3a2 2 0 0 0 2 2h3',
    'M16 21h3a2 2 0 0 0 2-2v-3'
  ],
  'fullscreen-exit': [
    'M8 3v3a2 2 0 0 1-2 2H3',
    'M21 8h-3a2 2 0 0 1-2-2V3',
    'M3 16h3a2 2 0 0 1 2 2v3',
    'M16 21v-3a2 2 0 0 1 2-2h3'
  ],
  refresh: [
    'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16',
    'M21 21v-5h-5'
  ],
  check: [
    'M20 6 9 17l-5-5'
  ],
  'check-circle': [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3'
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'm21 21-4.3-4.3'
  ],
  filter: [
    'M22 3H2l8 9.46V19l4 2v-8.54L22 3z'
  ],
  cloud: [
    'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z'
  ],
  alert: [
    'M12 9v4',
    'M12 17h.01',
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'
  ],
  'alert-circle': [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 8v4',
    'M12 16h.01'
  ],
  info: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 16v-4',
    'M12 8h.01'
  ],
  help: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01'
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
  ],
  unlink: [
    'm18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'm5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71',
    'm2 2 20 20'
  ],
  'external-link': [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3'
  ],

  /* ───── Графики и аналитика ───── */
  'chart-area': [
    'M3 3v16a2 2 0 0 0 2 2h16',
    { d: 'M7 17l4-5 3 3 5-6v8H7z', fill: true, o: 0.18 },
    'M7 17l4-5 3 3 5-6'
  ],
  'chart-line': [
    'M3 3v16a2 2 0 0 0 2 2h16',
    'm19 9-5 5-4-4-3 3'
  ],
  'chart-bar': [
    'M3 3v16a2 2 0 0 0 2 2h16',
    'M18 17V9',
    'M13 17V5',
    'M8 17v-3'
  ],
  'chart-hbar': [
    'M3 3v18',
    'M7 6h13',
    'M7 12h8',
    'M7 18h4'
  ],
  'chart-donut': [
    'M21.21 15.89A10 10 0 1 1 8 2.83',
    'M22 12A10 10 0 0 0 12 2v10z'
  ],
  'chart-histogram': [
    'M3 21h18',
    'M4 21v-6h4v6',
    'M10 21V6h4v15',
    'M16 21v-9h4v9'
  ],
  'chart-empty': [
    'M3 3v16a2 2 0 0 0 2 2h16',
    { d: 'M8 17v-4', dash: '2 2.4' },
    { d: 'M13 17V8', dash: '2 2.4' },
    { d: 'M18 17v-6', dash: '2 2.4' }
  ],
  sigma: [
    'M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2'
  ],
  table: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M3 9h18',
    'M3 15h18',
    'M9 9v12'
  ],
  trophy: [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
    'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
    'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
    'M18 2H6v7a6 6 0 0 0 12 0V2z'
  ],
  'trend-up': ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'],
  'trend-down': ['M16 17h6v-6', 'm22 17-8.5-8.5-5 5L2 7'],
  layers: [
    'm12 2 10 5-10 5-10-5Z',
    'm2 12 10 5 10-5',
    'm2 17 10 5 10-5'
  ],
  grid: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M14 14h7v7h-7z',
    'M3 14h7v7H3z'
  ],
  'pie-chart': [
    'M21.21 15.89A10 10 0 1 1 8 2.83',
    'M22 12A10 10 0 0 0 12 2v10z'
  ],
  activity: [
    'M22 12h-4l-3 9L9 3l-3 9H2'
  ],

  /* ───── Dev-инструменты ───── */
  'dev-json': [
    'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1',
    'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1'
  ],
  'dev-regex': [
    'M17 3v10',
    'm12.67 5.5 8.66 5',
    'm12.67 10.5 8.66-5',
    'M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z'
  ],
  'dev-encode': [
    'M8 3 4 7l4 4',
    'M4 7h16',
    'm16 21 4-4-4-4',
    'M20 17H4'
  ],
  'dev-notes': [
    'M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z'
  ],
  'dev-calculator': [
    'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
    'M8 6h8',
    'M8 10h.01', 'M12 10h.01', 'M16 10h.01',
    'M8 14h.01', 'M12 14h.01', 'M16 14h.01',
    'M8 18h.01', 'M12 18h.01', 'M16 18h.01'
  ],
  'dev-clock': [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 7v5l3 2'
  ],
  'dev-calendar': [
    'M8 2v4',
    'M16 2v4',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M3 10h18'
  ],

  /* ───── Редактор и базовые глифы ───── */
  cursor: [
    'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z'
  ],
  type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
  highlighter: [
    'm9 11-6 6v3h9l3-3',
    'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'
  ],
  square: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'],
  circle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
  image: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'
  ],
  signature: ['M3 16c3-7 5-10 6-10s-1 9 1 9 3-5 5-5 1 3 3 3 2-1 3-2', 'M3 21h18'],
  stamp: [
    'M5 22h14',
    'M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77',
    'M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13'
  ],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
  redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13'],
  fit: [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M21 8V5a2 2 0 0 0-2-2h-3',
    'M3 16v3a2 2 0 0 0 2 2h3',
    'M16 21h3a2 2 0 0 0 2-2v-3'
  ],
  save: [
    'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7',
    'M7 3v4a1 1 0 0 0 1 1h7'
  ],
  'file-plus': [
    'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z',
    'M14 2v6h6',
    'M12 18v-6',
    'M9 15h6'
  ],
  up: ['m18 15-6-6-6 6'],
  down: ['m6 9 6 6 6-6'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  copy: [
    'M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
    'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'
  ],
  sidebar: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M9 3v18'
  ],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  plus: ['M5 12h14', 'M12 5v14'],
  minus: ['M5 12h14']
}

const activeIcon = computed(() => ALIASES[props.name] ?? props.name)

const paths = computed(() => {
  const list = ICONS[activeIcon.value]
  if (!list) {
    if (import.meta.dev) console.warn(`[MoloSticker] неизвестная иконка: "${props.name}"`)
    return null
  }
  return list.map((p) => (typeof p === 'string' ? { d: p } : p) as { d: string; dash?: string; fill?: boolean; o?: number })
})
</script>

<template>
  <span
      class="molo-sticker"
      :class="{ 'with-glow': glow }"
      :style="{ width: resolvedSize, height: resolvedSize, color: color }"
  >
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        stroke-linejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        class="sticker-svg"
        aria-hidden="true"
    >
      <template v-if="paths">
        <path
            v-for="(p, i) in paths"
            :key="i"
            :d="p.d"
            :stroke-dasharray="p.dash"
            :fill="p.fill ? 'currentColor' : 'none'"
            :fill-opacity="p.fill ? p.o : undefined"
            :stroke="p.fill ? 'none' : undefined"
        />
      </template>
      <rect v-else x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 3" />
    </svg>
  </span>
</template>

<style scoped>
.molo-sticker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 1;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sticker-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.with-glow {
  filter: drop-shadow(0 0 6px currentColor);
}
</style>