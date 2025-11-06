<template>
  <nav class="pagination" role="navigation" aria-label="Навигация по страницам каталога">
    <button
      type="button"
      class="pagination__control"
      :disabled="currentPage <= 1"
      @click="$emit('update:page', currentPage - 1)"
    >
      ‹
    </button>
    <button
      v-for="page in pages"
      :key="page"
      type="button"
      :class="['pagination__page', { 'pagination__page--active': page === currentPage }]"
      @click="$emit('update:page', page)"
    >
      {{ page }}
    </button>
    <button
      type="button"
      class="pagination__control"
      :disabled="currentPage >= totalPages"
      @click="$emit('update:page', currentPage + 1)"
    >
      ›
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  currentPage: number;
  totalPages: number;
  window?: number;
}>();

defineEmits<{
  (event: 'update:page', value: number): void;
}>();

const windowSize = computed(() => props.window ?? 5);

const pages = computed(() => {
  const windowHalf = Math.floor(windowSize.value / 2);
  let start = Math.max(1, props.currentPage - windowHalf);
  let end = Math.min(props.totalPages, start + windowSize.value - 1);

  if (end - start + 1 < windowSize.value) {
    start = Math.max(1, end - windowSize.value + 1);
  }

  const items: number[] = [];
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }
  return items;
});
</script>

<style scoped lang="scss">
.pagination {
  display: inline-flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  align-items: center;
  justify-content: center;
}

.pagination__page,
.pagination__control {
  min-width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  font-weight: 600;
  color: var(--text-secondary);
}

.pagination__page--active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.pagination__control:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
