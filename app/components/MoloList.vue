<script lang="ts" setup>
const props = defineProps<{
  items: any[]
  groups?: any[]
  settings: any
  styles?: Record<string, any>
}>()

</script>

<template>
  <div class="molo-list">
    <!-- Показываем КАЖДУЮ группу -->
    <div v-if="groups && groups.length" class="list-groups">
      <div v-for="group in groups" :key="group._id || group.name" class="list-group">
        <div class="group-header">
          <div class="group-title">{{ group.name }}</div>
          <div v-if="group.description" class="group-description">{{ group.description }}</div>
        </div>

        <div class="group-fields">
          <div v-for="field in group.fields" :key="field.key" class="field-row">
            <span class="field-label">{{ field.label }}</span>
            <span class="field-type">{{ field.description }}</span>
          </div>

          <div v-if="!group.fields || group.fields.length === 0" class="empty-fields">
            <span>Нет полей в этой группе</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Если нет групп, но есть поля -->
    <div v-else-if="props.fields && props.fields.length" class="list-group">
      <div class="group-header">
        <div class="group-title">Все поля</div>
      </div>
      <div class="group-fields">
        <div v-for="field in props.fields" :key="field.key" class="field-row">
          <span class="field-label">{{ field.label }}</span>
          <span class="field-type">{{ field.type }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <span class="empty-icon">📭</span>
      <p>Нет групп и полей для отображения</p>
    </div>
  </div>
</template>


<style scoped>
.molo-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.list-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.list-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
}

.group-header {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.group-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.group-description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.group-fields {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.field-row:last-child {
  border-bottom: none;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.field-type {
  font-size: 12px;
  padding: 4px 12px;
  background: rgba(100, 150, 255, 0.15);
  border-radius: 20px;
  color: #6496ff;
}

.empty-fields {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>