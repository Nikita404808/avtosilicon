<template>
  <div class="articles container">
    <header class="articles__header">
      <h1>Новости и статьи</h1>
      <ArticleFilters :tags="tags" :active-tag="activeTag" @update:tag="changeTag" />
    </header>
    <ArticleList :articles="pagedArticles" />
    <div class="articles__pagination">
      <ArticlePagination
        :current-page="currentPage"
        :total-pages="totalPages"
        @update:page="changePage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArticleFilters, { type NewsTag } from '@/components/news/ArticleFilters.vue';
import ArticleList from '@/components/news/ArticleList.vue';
import ArticlePagination from '@/components/news/ArticlePagination.vue';
import articlesMock from '@/mocks/articles.json';
import type { Article } from '@/components/news/ArticleCard.vue';

const route = useRoute();
const router = useRouter();

const articles = ref(articlesMock as Article[]);
const tags = ref<NewsTag[]>([
  { id: 'all', label: 'Все' },
  { id: 'news', label: 'Новости' },
  { id: 'reviews', label: 'Обзоры' },
  { id: 'tests', label: 'Тесты' },
]);

const activeTag = ref<string | undefined>();
const currentPage = ref(1);
const pageSize = 9;

const syncFromRoute = () => {
  const { tag, page } = route.query;
  activeTag.value =
    typeof tag === 'string' && tag !== 'all' ? tag : undefined;
  currentPage.value = typeof page === 'string' ? Number(page) || 1 : 1;
};

const syncToRoute = () => {
  const query: Record<string, string> = {};
  if (activeTag.value) query.tag = activeTag.value;
  if (currentPage.value > 1) query.page = currentPage.value.toString();

  router.replace({ name: 'articles', query }).catch(() => undefined);
};

const filteredArticles = computed(() => {
  if (!activeTag.value) return articles.value;
  return articles.value.filter((article) => article.tags?.includes(activeTag.value as string));
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredArticles.value.length / pageSize)));

const pagedArticles = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredArticles.value.slice(start, start + pageSize);
});

const changeTag = (tag?: string) => {
  activeTag.value = tag;
  currentPage.value = 1;
};

const changePage = (page: number) => {
  currentPage.value = page;
};

watch(
  () => route.query,
  () => {
    syncFromRoute();
  },
  { immediate: true },
);

watch(
  [activeTag, currentPage],
  () => {
    syncToRoute();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.articles {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.articles__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.articles__pagination {
  display: flex;
  justify-content: center;
}
</style>
