<script setup lang="ts">
import { useWindowManager } from '~/composables/window/useWindowManager'
import MoloSticker from '~/components/ui/MoloSticker.vue'

const { openWindow } = useWindowManager()

const tools = [
  { key: 'dev:json', sticker: 'dev-json', label: 'JSON', accent: '#5b8def' },
  { key: 'dev:regex', sticker: 'dev-regex', label: 'Regex', accent: '#8b5cf6' },
  { key: 'dev:encode', sticker: 'dev-encode', label: 'Encode/Decode', accent: '#33d17a' },
  { key: 'dev:notes', sticker: 'dev-notes', label: 'Заметки', accent: '#d29922' },
  { key: 'dev:calculator', sticker: 'dev-calculator', label: 'Калькулятор', accent: '#22b8cf' },
  { key: 'dev:clock', sticker: 'dev-clock', label: 'Часы', accent: '#f97316' },
  { key: 'dev:calendar', sticker: 'dev-calendar', label: 'Календарь', accent: '#ef5b8d' },
]

const openTool = (tool: typeof tools[number]) => {
  openWindow(tool.key)
}
</script>

<template>
  <section class="toolbar-container">
    <div class="dev-toolbar">
      <!-- Левая часть -->
      <div class="toolbar-brand">
        <div class="toolbar-title-wrap">
          <span class="toolbar-title">Инструменты</span>
        </div>
      </div>

      <!-- Разделитель -->
      <span class="toolbar-divider"></span>

      <!-- Инструменты -->
      <div class="tools-dock">
        <button
            v-for="tool in tools"
            :key="tool.key"
            class="tool-btn"
            :style="{ '--tool-color': tool.accent }"
            :title="tool.label"
            @click="openTool(tool)"
        >
          <span class="tool-glow"></span>

          <span class="tool-icon">
            <MoloSticker :name="tool.sticker" :size="16" />
          </span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* =========================================================
   TOOLBAR
   ========================================================= */

.toolbar-container {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  z-index: 100;
}

/* Основная glass-панель */
.dev-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 22px;
  padding: 5px 8px;
  background: var(--half_opacity_bg);
  border: 1px solid var(--half_opacity_border);
  border-radius: 999px;
  color: white;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition:
      border-color 0.25s ease,
      background 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.2s ease;
}

/* =========================================================
   BRAND
   ========================================================= */

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 4px;
  user-select: none;
}

.toolbar-title-wrap {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1;
}

.toolbar-title {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.15px;
  color: rgba(255, 255, 255, 0.94);
}

/* =========================================================
   DIVIDER
   ========================================================= */

.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: linear-gradient(
      to bottom,
      transparent,
      rgba(255, 255, 255, 0.16),
      transparent
  );
}

/* =========================================================
   TOOLS DOCK
   ========================================================= */

.tools-dock {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* =========================================================
   TOOL BUTTON
   ========================================================= */

.tool-btn {
  --tool-color: #5b8def;
  position: relative;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--half_opacity_border);
  border-radius: 50%;
  background: var(--half_opacity_bg);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  overflow: visible;
  padding: 0;
  box-sizing: border-box;
  transition:
      transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
}

.tool-btn:hover {
  transform: translateY(-2px);
  color: white;
  border-color: color-mix(in srgb, var(--tool-color) 65%, white 10%);
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--tool-color) 20%, rgba(255, 255, 255, 0.08)),
      rgba(255, 255, 255, 0.03)
  );
  box-shadow:
      0 6px 14px rgba(0, 0, 0, 0.35),
      0 0 0 2px color-mix(in srgb, var(--tool-color) 16%, transparent),
      0 0 12px color-mix(in srgb, var(--tool-color) 24%, transparent);
}

.tool-btn:active {
  transform: translateY(0) scale(0.94);
}

/* =========================================================
   TOOL ICON
   ========================================================= */

.tool-icon {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transition: transform 0.2s ease;
}

.tool-btn:hover .tool-icon {
  transform: scale(1.08);
}

/* =========================================================
   TOOL GLOW
   ========================================================= */

.tool-glow {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--tool-color);
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.tool-btn:hover .tool-glow {
  opacity: 0.24;
}

/* =========================================================
   FOCUS
   ========================================================= */

.tool-btn:focus-visible {
  outline: 2px solid var(--tool-color);
  outline-offset: 2px;
}

/* =========================================================
   ADAPTIVE
   ========================================================= */

@media (max-width: 720px) {
  .toolbar-container {
    padding: 8px 12px;
  }

  .dev-toolbar {
    width: 100%;
    justify-content: space-between;
  }

  .toolbar-divider {
    display: none;
  }

  .tools-dock {
    gap: 4px;
  }

  .tool-btn {
    width: 30px;
    height: 30px;
  }
}

@media (max-width: 460px) {
  .toolbar-title {
    display: none;
  }

  .tool-btn {
    width: 28px;
    height: 28px;
  }
}
</style>