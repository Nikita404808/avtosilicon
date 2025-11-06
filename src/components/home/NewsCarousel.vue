<template>
  <section class="news">
    <div class="container">
      <header class="news__header">
        <h2>Новости</h2>
        <RouterLink to="/articles" class="news__all">Все новости</RouterLink>
      </header>
      <div class="news__grid">
        <article v-for="article in articles" :key="article.id" class="news__card">
          <time :datetime="article.date">{{ formatDate(article.date) }}</time>
          <h3>{{ article.title }}</h3>
          <p>{{ article.excerpt }}</p>
          <RouterLink :to="`/articles/${article.slug}`" class="news__link">
            Читать далее
          </RouterLink>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

type HomeArticle = {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt: string;
};

const articles: HomeArticle[] = [
  {
    id: 'n1',
    slug: 'grafik-ny-2025',
    title: 'График работы в праздники',
    date: '2024-12-20',
    excerpt: 'Рассказываем о графике работы офиса и склада АВТОСИЛИКОН в новогодние дни.',
  },
  {
    id: 'n2',
    slug: 'novaya-seriya-pro',
    title: 'Серия АВТОСИЛИКОН PRO',
    date: '2024-12-10',
    excerpt: 'Представляем обновлённую линейку комплектующих для спортивных авто.',
  },
  {
    id: 'n3',
    slug: 'drive2-feedback',
    title: 'Отзывы с DRIVE2',
    date: '2024-11-28',
    excerpt: 'Подборка отзывов от владельцев, которые прошли более 60 000 км с деталями АВТОСИЛИКОН.',
  },
];

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
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

.news__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}

.news__card {
  background: var(--surface);
  padding: var(--space-5);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  time {
    font-size: var(--fz-caption);
    line-height: var(--lh-caption);
    color: var(--text-secondary);
    text-transform: capitalize;
  }
}

.news__link {
  margin-top: auto;
  font-weight: 600;
  color: var(--accent);
}
</style>
