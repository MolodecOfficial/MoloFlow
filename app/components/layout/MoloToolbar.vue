<script setup lang="ts">
import { useWindowManager } from '~/composables/window/useWindowManager'

const { openWindow } = useWindowManager()

const tools = [
  { key: 'dev:json', icon: '{ }', label: 'JSON', accent: '#5b8def' },
  { key: 'dev:regex', icon: '.*', label: 'Regex', accent: '#8b5cf6' },
  { key: 'dev:encode', icon: '⇄', label: 'Encode/Decode', accent: '#33d17a' },
  { key: 'dev:notes', icon: '📝', label: 'Заметки', accent: '#d29922' },
  { key: 'dev:calculator', icon: '=', label: 'Калькулятор', accent: '#22b8cf' },
  { key: 'dev:clock', icon: '🕐', label: 'Часы', accent: '#f97316' },
  { key: 'dev:calendar', icon: '📅', label: 'Календарь', accent: '#ef5b8d' },
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
            :title="`${tool.label} — ${tool.description}`"
            @click="openTool(tool)"
        >
          <span class="tool-glow"></span>

          <span class="tool-icon">
            {{ tool.icon }}
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

  padding: 6px 8px 6px 7px;


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

  padding: 0 4px 0 4px;

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
  height: 30px;
  margin: 0 5px;

  background:
      linear-gradient(
          to bottom,
          transparent,
          rgba(255, 255, 255, 0.14),
          transparent
      );
}


/* =========================================================
   TOOLS DOCK
   ========================================================= */

.tools-dock {
  display: flex;
  align-items: center;
  gap: 5px;
}


/* =========================================================
   TOOL BUTTON
   ========================================================= */

.tool-btn {
  --tool-color: #5b8def;
  position: relative;

  width: 28px;
  height: 28px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 1px solid var(--half_opacity_border);
  border-radius: 50px;

  background: var(--half_opacity_bg);

  color: rgba(255, 255, 255, 0.82);

  cursor: pointer;

  overflow: visible;

  transition:
      transform 0.18s cubic-bezier(.2, .8, .2, 1),
      background 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      box-shadow 0.2s ease;
}

.tool-btn:hover {
  transform: translateY(-3px);

  color: white;

  border-color: color-mix(
      in srgb,
      var(--tool-color) 65%,
      white 10%
  );

  background:
      linear-gradient(
          145deg,
          color-mix(
              in srgb,
              var(--tool-color) 15%,
              rgba(255, 255, 255, 0.07)
          ),
          rgba(255, 255, 255, 0.035)
      );

  box-shadow:
      0 7px 18px rgba(0, 0, 0, 0.25),
      0 0 0 3px color-mix(
          in srgb,
          var(--tool-color) 13%,
          transparent
      ),
      0 0 16px color-mix(
          in srgb,
          var(--tool-color) 18%,
          transparent
      );
}

.tool-btn:active {
  transform: translateY(-1px) scale(0.94);
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

  min-width: 22px;

  font-family: 'JetBrains Mono', monospace;

  font-size: 11px;
  font-weight: 750;

  letter-spacing: -0.7px;

  transition:
      transform 0.2s ease,
      color 0.2s ease;
}

.tool-btn:hover .tool-icon {
  transform: scale(1.08);

  color: var(--tool-color);
}


/* =========================================================
   TOOL GLOW
   ========================================================= */

.tool-glow {
  position: absolute;
  inset: 7px;

  border-radius: 8px;

  background: var(--tool-color);

  opacity: 0;

  filter: blur(10px);

  transition: opacity 0.25s ease;
}

.tool-btn:hover .tool-glow {
  opacity: 0.16;
}

/* =========================================================
   FOCUS
   ========================================================= */

.tool-btn:focus-visible {
  outline: 2px solid var(--borber-color_main);
  outline-offset: 2px;
}


/* =========================================================
   REDUCED MOTION
   ========================================================= */

/* =========================================================
   TABLET
   ========================================================= */

@media (max-width: 720px) {
  .toolbar-container {
    padding: 8px 12px;
  }

  .dev-toolbar {
    width: 100%;
    max-width: 100%;

    justify-content: space-between;
  }

  .toolbar-subtitle,
  .toolbar-divider {
    display: none;
  }

  .toolbar-brand {
    padding-right: 5px;
  }

  .tools-dock {
    gap: 4px;
  }

  .tool-btn {
    width: 35px;
    height: 35px;
  }
}


/* =========================================================
   SMALL MOBILE
   ========================================================= */

@media (max-width: 460px) {
  .toolbar-title {
    display: none;
  }

  .toolbar-brand {
    padding-right: 3px;
  }


  .tool-btn {
    width: 33px;
    height: 33px;
    border-radius: 10px;
  }

}
</style>