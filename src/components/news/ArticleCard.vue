<template>
  <article class="card">
    <img v-if="article.image" :src="article.image" :alt="article.title" loading="lazy" />
    <time :datetime="article.date">{{ formattedDate }}</time>
    <h3>{{ article.title }}</h3>
    <p>{{ article.excerpt }}</p>
    <RouterLink :to="`/articles/${article.slug}`" class="card__link">Читать</RouterLink>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

export type Article = {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  image?: string;
  tags?: string[];
};

const props = defineProps<{
  article: Article;
}>();

const formattedDate = computed(() =>
  new Date(props.article.date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  }),
);
</script>

<style scoped lang="scss">
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);

  time {
    color: var(--text-secondary);
    font-size: var(--fz-caption);
    text-transform: capitalize;
  }
}

.card__link {
  margin-top: auto;
  color: var(--accent);
  font-weight: 600;
}

img {
  border-radius: var(--radius-md);
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
</style>
