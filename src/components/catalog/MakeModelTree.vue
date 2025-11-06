<template>
  <div class="tree">
    <label class="tree__label" for="make-search">Марка</label>
    <input
      id="make-search"
      v-model="makeSearch"
      type="search"
      placeholder="Поиск по маркам"
      class="tree__input"
    />

    <div class="tree__list" role="tree">
      <details
        v-for="make in filteredMakes"
        :key="make.id"
        class="tree__details"
        :open="make.value === selectedMake"
      >
        <summary
          role="treeitem"
          :aria-selected="make.value === selectedMake"
          @click.prevent="selectMake(make.value)"
        >
          {{ make.label }}
        </summary>
        <ul role="group">
          <li v-for="model in make.models" :key="model">
            <button
              type="button"
              :class="['tree__model', { 'tree__model--active': model === selectedModel }]"
              @click="selectModel(make.value, model)"
            >
              {{ model }}
            </button>
          </li>
        </ul>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export type MakeItem = {
  id: string;
  label: string;
  value: string;
  models: string[];
  keywords?: string[];
};

const props = defineProps<{
  makes: MakeItem[];
  selectedMake?: string;
  selectedModel?: string;
}>();

const emit = defineEmits<{
  (event: 'update:make', value: string | undefined): void;
  (event: 'update:model', value: string | undefined): void;
}>();

const makeSearch = ref('');

const filteredMakes = computed(() => {
  const query = makeSearch.value.toLowerCase();
  if (!query) return props.makes;

  return props.makes.filter((make) => {
    const labelMatches = make.label.toLowerCase().includes(query);
    const modelMatches = make.models.some((model) => model.toLowerCase().includes(query));
    return labelMatches || modelMatches;
  });
});

const selectMake = (makeValue: string) => {
  emit('update:make', makeValue === props.selectedMake ? undefined : makeValue);
  emit('update:model', undefined);
};

const selectModel = (makeValue: string, modelName: string) => {
  if (makeValue !== props.selectedMake) {
    emit('update:make', makeValue);
  }
  emit('update:model', modelName === props.selectedModel ? undefined : modelName);
};
</script>

<style scoped lang="scss">
.tree {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tree__label {
  font-weight: 600;
}

.tree__input {
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: var(--space-2) var(--space-3);
}

.tree__list {
  max-height: 320px;
  overflow-y: auto;
  padding-right: var(--space-2);
}

.tree__details {
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  &[open] {
    background: rgba(0, 0, 0, 0.04);
  }
}

.tree__model {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);

  &--active {
    background: var(--accent);
    color: #fff;
  }
}
</style>
