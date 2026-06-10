<!-- MoloCard.vue -->
<script lang="ts" setup>
const props = defineProps<{
  item: any
  settings: any
  fields?: any[]
  styles?: Record<string, any>
  groupName?: string
  groupDescription?: string
  groupImage?: string | null
  groupLink?: string | null
  linkTarget?: '_blank' | '_self' | '_parent' | '_top'
}>()

const emit = defineEmits<{
  linkClick: [link: string]
  avatarClick: [link: string]
  fieldClick: [fieldKey: string, value: any, link?: string]
}>()

function formatValue(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return value
}

function getField(fieldKey: string) {
  return props.fields?.find(f => f.key === fieldKey)
}

function getFieldLabel(fieldKey: string) {
  const f = getField(fieldKey)
  return f?.label || fieldKey
}

function getFieldDescription(fieldKey: string) {
  const f = getField(fieldKey)
  return f?.description || ''
}

function getFieldLink(fieldKey: string) {
  const f = getField(fieldKey)
  return f?.link || null
}

function getFieldValue(fieldKey: string) {
  const value = props.item[fieldKey]
  return formatValue(value)
}

function handleAvatarClick(event: MouseEvent) {
  event.stopPropagation()
  if (props.groupLink) {
    emit('avatarClick', props.groupLink)
    window.open(props.groupLink, props.linkTarget || '_blank')
  }
}

function handleGroupLinkClick(event: MouseEvent) {
  event.stopPropagation()
  if (props.groupLink) {
    emit('linkClick', props.groupLink)
    window.open(props.groupLink, props.linkTarget || '_blank')
  }
}

function handleFieldClick(event: MouseEvent, fieldKey: string) {
  event.stopPropagation()
  const field = getField(fieldKey)
  const link = field?.link
  const value = getFieldValue(fieldKey)

  emit('fieldClick', fieldKey, value, link)

  if (link) {
    window.open(link, props.linkTarget || '_blank')
  }
}
</script>

<template>
  <div
      class="molo-card"
      :style="{
      backgroundColor: styles?.cardBackground || 'var(--half_opacity_bg)',
      color: styles?.cardTextColor || 'white',
      borderRadius: styles?.cardBorderRadius || '18px',
      borderColor: styles?.cardBorderColor || 'rgba(255,255,255,0.08)',
      padding: styles?.cardPadding || '18px'
    }"
  >
    <!-- Шапка с аватаром -->
    <div class="card-header">
      <div
          class="group-avatar"
          :class="{ 'has-link': groupLink }"
          @click="handleAvatarClick"
      >
        <img
            v-if="groupImage"
            :src="groupImage"
            :alt="groupName"
            class="group-avatar-img"
        />
        <span v-else class="group-avatar-letter">
          {{ (groupName || '?').charAt(0).toUpperCase() }}
        </span>
        <div v-if="groupLink" class="avatar-link-indicator">🔗</div>
      </div>

      <div class="header-info">
        <h3 class="group-title">
          {{ groupName || 'Без названия' }}
          <a
              v-if="groupLink"
              :href="groupLink"
              :target="linkTarget || '_blank'"
              class="group-link"
              @click.stop="handleGroupLinkClick"
          >🔗</a>
        </h3>
        <p v-if="groupDescription" class="group-description">
          {{ groupDescription }}
        </p>
      </div>
    </div>

    <div class="card-divider" />

    <!-- Поля: лейбл слева | значение справа (как в читательском формуляре) -->
    <div class="card-fields">
      <div
          v-for="fieldKey in settings?.fields"
          :key="fieldKey"
          class="card-field-row"
          :class="{ 'has-link': getFieldLink(fieldKey) }"
          @click="(e) => handleFieldClick(e, fieldKey)"
      >
        <div class="field-label">
          {{ getFieldLabel(fieldKey) }}
          <span v-if="getFieldLink(fieldKey)" class="field-link-icon">🔗</span>
        </div>
        <div class="field-value">
          {{ getFieldDescription(fieldKey) || getFieldValue(fieldKey) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.molo-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: rgba(255, 255, 255, .04);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 20px;
  transition: all .25s ease;
}

.molo-card:hover {
  transform: translateY(-4px);
  border-color: rgba(100, 150, 255, .35);
  box-shadow: 0 10px 30px rgba(0, 0, 0, .25),
  0 0 0 1px rgba(100, 150, 255, .15);
}

.molo-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
      circle at top right,
      rgba(100, 150, 255, .18),
      transparent 40%
  );
  pointer-events: none;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.group-avatar {
  position: relative;
  width: 70px;
  height: 70px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6496ff, #4f74ff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.group-avatar.has-link {
  cursor: pointer;
}

.group-avatar.has-link:hover {
  transform: scale(1.05);
}

.group-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-avatar-letter {
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.avatar-link-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.group-avatar.has-link:hover .avatar-link-indicator {
  opacity: 1;
}

.header-info {
  min-width: 0;
  flex: 1;
}

.group-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s ease;
  padding: 2px;
  border-radius: 6px;
}

.group-link:hover {
  color: #6496ff;
  background: rgba(100, 150, 255, 0.15);
  transform: scale(1.1);
}

.group-description {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, .55);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-divider {
  height: 1px;
  background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, .12),
      transparent
  );
}

/* ========== ГЛАВНОЕ: поля как в читательском формуляре ========== */
.card-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-field-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 20px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  cursor: default;
}

.card-field-row.has-link {
  cursor: pointer;
}

.card-field-row.has-link:hover {
  background: rgba(100, 150, 255, 0.08);
  margin: 0 -8px;
  padding: 6px 8px;
  border-radius: 10px;
  border-bottom-color: transparent;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  min-width: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Значение — справа, прижато к правому краю, переносится */
.field-value {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  text-align: right;
  word-break: break-word;
  flex: 1;
}

.field-link-icon {
  font-size: 10px;
  opacity: 0.5;
}

.card-field-row.has-link:hover .field-link-icon {
  opacity: 1;
  color: #6496ff;
}

@media (max-width: 700px) {
  .molo-card {
    gap: 14px;
  }

  .group-avatar {
    width: 50px;
    height: 50px;
  }

  .group-avatar-letter {
    font-size: 20px;
  }

  .group-title {
    font-size: 16px;
  }

  .field-label {
    min-width: 100px;
    font-size: 11px;
  }

  .field-value {
    font-size: 12px;
  }
}
</style>