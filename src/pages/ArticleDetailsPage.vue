<template>
  <div class="article page-content">
    <RouterLink to="/articles" class="article__back">← Все новости</RouterLink>

    <div v-if="isLoading" class="article__state" role="status">Загрузка новости...</div>
    <div v-else-if="error" class="article__state article__state--error">
      {{ error }}
    </div>
    <article v-else-if="article" class="article__content">
      <p v-if="article.date" class="article__date">{{ formatDate(article.date) }}</p>
      <h1 class="article__title">{{ article.title }}</h1>
      <img
        v-if="article.image"
        :src="article.image"
        :alt="article.title"
        class="article__image"
        loading="lazy"
      />
      <div class="article__body" v-html="article.content"></div>
    </article>
    <div v-else class="article__state">Новость не найдена.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { fetchNews } from '@/api/directus';
import type { NewsItem } from '@/types';

const route = useRoute();
const article = ref<NewsItem | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''));

const loadArticle = async () => {
  isLoading.value = true;
  error.value = null;
  article.value = null;

  try {
    const items = await fetchNews();
    const found = items.find((item) => item.slug === slug.value) ?? null;
    article.value = found;
    if (!found) {
      error.value = 'Новость не найдена';
    } else {
      document.title = `${found.title} — АВТОСИЛИКОН`;
    }
  } catch (err) {
    console.error('[ArticleDetails]', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить новость';
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => slug.value,
  (next) => {
    if (next) {
      loadArticle();
    } else {
      article.value = null;
    }
  },
  { immediate: true },
);

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
</script>

<style scoped lang="scss">
.article {
  padding: var(--space-6) 0 var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.article__back {
  color: var(--accent);
  font-weight: 600;
}

.article__state {
  padding: var(--space-6);
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);
}

.article__state--error {
  color: var(--danger, #c62828);
}

.article__content {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.article__date {
  color: var(--text-secondary);
  font-size: var(--fz-caption);
  text-transform: capitalize;
}

.article__title {
  margin: 0;
}

.article__image {
  width: 100%;
  max-width: 860px;
  max-height: 420px;
  border-radius: var(--radius-md);
  object-fit: contain;
  align-self: center;
}

.article__body {
  line-height: 1.7;
  color: var(--text-secondary);

  :deep(p) {
    margin-bottom: var(--space-3);
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}
</style>
