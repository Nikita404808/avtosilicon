<template>
  <div class="category">
    <label for="category-search" class="category__label">Категории</label>
    <input
      id="category-search"
      v-model="search"
      type="search"
      placeholder="Найти категорию"
      class="category__input"
    />
    <div class="category__list">
      <label
        v-for="item in filteredCategories"
        :key="item.id"
        class="category__item"
        :title="item.label"
      >
        <input
          type="checkbox"
          :value="item.id"
          :checked="selected.includes(item.id)"
          @change="toggle(item.id)"
        />
        <span>{{ item.label }}</span>
      </label>
    </div>
    <button type="button" class="category__reset" @click="reset">Сбросить</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export type CategoryItem = {
  id: string;
  label: string;
};

const props = defineProps<{
  categories: CategoryItem[];
  selected: string[];
}>();

const emit = defineEmits<{
  (event: 'update:selected', value: string[]): void;
}>();

const search = ref('');

const filteredCategories = computed(() => {
  const query = search.value.toLowerCase();
  if (!query) return props.categories;
  return props.categories.filter((category) =>
    category.label.toLowerCase().includes(query.toLowerCase()),
  );
});

const toggle = (categoryId: string) => {
  const hasCategory = props.selected.includes(categoryId);
  const next = hasCategory
    ? props.selected.filter((id) => id !== categoryId)
    : [...props.selected, categoryId];
  emit('update:selected', next);
};

const reset = () => {
  emit('update:selected', []);
  search.value = '';
};
</script>

<style scoped lang="scss">
.category {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.category__label {
  font-weight: 600;
}

.category__input {
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: var(--space-2) var(--space-3);
}

.category__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 260px;
  overflow-y: auto;
}

.category__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);

  &:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  input {
    accent-color: var(--accent);
  }
}

.category__reset {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--fz-caption);
  text-decoration: underline;
}
</style>
