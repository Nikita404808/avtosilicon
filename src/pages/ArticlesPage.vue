<template>
  <div class="news-page page-content">
    <header class="news-page__header">
      <div>
        <p class="news-page__eyebrow">Свежие события</p>
        <h1>Новости</h1>
      </div>
    </header>

    <div v-if="isLoading" class="news-page__state" role="status">Загрузка новостей...</div>
    <div v-else-if="error" class="news-page__state news-page__state--error">
      {{ error }}
    </div>
    <div v-else-if="!news.length" class="news-page__state">Новостей пока нет.</div>
    <div v-else class="news-page__list">
      <RouterLink
        v-for="item in news"
        :key="item.id"
        class="news-card"
        :to="`/articles/${item.slug}`"
      >
        <div class="news-card__image" :class="{ 'news-card__image--empty': !item.image }">
          <img
            v-if="item.image"
            :src="item.image"
            :alt="item.title"
            loading="lazy"
          />
        </div>
        <div class="news-card__meta">
          <p v-if="item.date" class="news-card__date">{{ formatDate(item.date) }}</p>
          <h2 class="news-card__title">{{ item.title }}</h2>
        </div>
        <span class="news-card__cta">Читать новость</span>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchNews } from '@/api/directus';
import type { NewsItem } from '@/types';

const news = ref<NewsItem[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

onMounted(async () => {
  try {
    news.value = await fetchNews();
  } catch (err) {
    console.error('[NewsPage]', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить новости';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped lang="scss">
.news-page {
  padding: var(--space-6) 0 var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.news-page__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  h1 {
    margin: 0;
  }
}

.news-page__eyebrow {
  text-transform: uppercase;
  font-size: var(--fz-caption);
  letter-spacing: 0.08em;
  color: var(--accent);
}

.news-page__state {
  padding: var(--space-6);
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);
}

.news-page__state--error {
  color: var(--danger, #c62828);
}

.news-page__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: flex-start;
  flex-direction: row;
  align-content: flex-start;
}

.news-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: min(320px, 100%);
  flex: 0 0 320px;
  text-decoration: none;
  color: inherit;
  transition: transform 120ms ease, box-shadow 120ms ease;

  &:hover,
  &:focus-visible {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
  }
}

.news-card__image {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.news-card__image--empty {
  background: linear-gradient(135deg, rgba(75, 109, 226, 0.12), rgba(14, 41, 80, 0.08));
}

.news-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.news-card__date {
  text-transform: capitalize;
  font-size: var(--fz-caption);
  color: var(--text-secondary);
}

.news-card__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.4;
}

.news-card__cta {
  margin-top: auto;
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: $breakpoint-tablet) {
  .news-page__list {
    flex-direction: row;
    justify-content: center;
  }

  .news-card {
    flex: 1 1 260px;
  }
}

@media (max-width: $breakpoint-mobile) {
  .news-card {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
