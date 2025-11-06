<template>
  <section class="articles">
    <div v-if="!articles.length" class="articles__empty">Материалы не найдены.</div>
    <div v-else class="articles__grid">
      <ArticleCard v-for="article in articles" :key="article.id" :article="article" />
    </div>
  </section>
</template>

<script setup lang="ts">
import ArticleCard, { type Article } from './ArticleCard.vue';

defineProps<{
  articles: Article[];
}>();
</script>

<style scoped lang="scss">
.articles__empty {
  padding: var(--space-6);
  text-align: center;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-md);
}

.articles__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}
</style>
