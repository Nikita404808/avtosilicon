<template>
  <section class="news">
    <div class="container">
      <header class="news__header">
        <h2>Новости</h2>
        <RouterLink to="/articles" class="news__all">Все новости</RouterLink>
      </header>

      <div v-if="isLoading" class="news__state">Загрузка новостей...</div>
      <div v-else-if="hasError" class="news__state news__state--error">
        {{ error }}
      </div>
      <div v-else-if="!newsItems.length" class="news__state">Новостей пока нет.</div>
      <div v-else class="news__accordion">
        <article
          v-for="item in newsItems"
          :key="item.id"
          class="news__item"
          :data-open="openedId === item.id"
        >
          <button type="button" class="news__toggle" @click="toggleItem(item.id)">
            <div class="news__toggle-text">
              <span class="news__title">{{ item.title }}</span>
              <time v-if="item.date" :datetime="item.date">{{ formatDate(item.date) }}</time>
            </div>
            <span class="news__chevron" aria-hidden="true" />
          </button>
          <div v-show="openedId === item.id" class="news__content" v-html="item.content" />
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchNews } from '@/api/directus';
import type { NewsItem } from '@/types';

const NEWS_LIMIT = 4;
const newsItems = ref<NewsItem[]>([]);
const openedId = ref<number | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const toggleItem = (id: number) => {
  openedId.value = openedId.value === id ? null : id;
};

const loadNews = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const items = await fetchNews();
    newsItems.value = items.slice(0, NEWS_LIMIT);
    openedId.value = newsItems.value[0]?.id ?? null;
  } catch (err) {
    console.error('[Home][News]', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить новости';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadNews();
});

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
};

const hasError = computed(() => Boolean(error.value));
</script>

<style scoped lang="scss">
.news {
  padding: var(--space-8) 0;
}

.news__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.news__all {
  color: var(--accent);
  font-weight: 600;
}

.news__state {
  padding: var(--space-6);
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);
}

.news__state--error {
  color: var(--danger, #c62828);
}

.news__accordion {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.news__item {
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  background: var(--surface);
  overflow: hidden;
}

.news__toggle {
  width: 100%;
  padding: var(--space-4) var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.news__toggle-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);

  time {
    font-size: var(--fz-caption);
    color: var(--text-secondary);
    text-transform: capitalize;
  }
}

.news__title {
  font-weight: 600;
  line-height: 1.4;
}

.news__chevron {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    width: 8px;
    height: 8px;
    border: solid var(--text-primary);
    border-width: 0 0 2px 2px;
    transform: rotate(-45deg);
    transition: transform 120ms ease;
  }
}

.news__item[data-open='true'] .news__chevron::after {
  transform: rotate(135deg);
}

.news__content {
  padding: 0 var(--space-5) var(--space-5);
  color: var(--text-secondary);
  line-height: 1.6;

  :deep(p) {
    margin-bottom: var(--space-3);
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}

@media (max-width: $breakpoint-mobile) {
  .news__toggle {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
