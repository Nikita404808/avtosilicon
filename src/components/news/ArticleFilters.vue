<template>
  <div class="filters">
    <button
      v-for="tag in tags"
      :key="tag.id"
      type="button"
      :class="['filters__chip', { 'filters__chip--active': tag.id === activeTag }]"
      @click="$emit('update:tag', tag.id === activeTag ? undefined : tag.id)"
    >
      {{ tag.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
export type NewsTag = {
  id: string;
  label: string;
};

defineProps<{
  tags: NewsTag[];
  activeTag?: string;
}>();

defineEmits<{
  (event: 'update:tag', value: string | undefined): void;
}>();
</script>

<style scoped lang="scss">
.filters {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.filters__chip {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  padding: var(--space-2) var(--space-4);
  font-weight: 600;
  color: var(--text-secondary);

  &--active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
}
</style>
