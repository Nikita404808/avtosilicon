<template>
  <div class="notfound page-content">
    <h1>404</h1>
    <p>Страница не найдена или была перенесена.</p>
    <RouterLink to="/" class="notfound__link">Вернуться на главную</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { useSeo } from '@/composables/useSeo';
import { buildCanonicalFromRoute } from '@/services/seo';

const route = useRoute();

useSeo({
  title: 'Страница не найдена — Автосиликон',
  description: 'Ошибка 404. Страница не найдена.',
  canonical: buildCanonicalFromRoute(route),
  robots: 'noindex,nofollow',
});
</script>

<style scoped lang="scss">
.notfound {
  padding: var(--space-8) 0;
  display: grid;
  gap: var(--space-3);
  text-align: center;

  h1 {
    font-size: 96px;
    margin: 0;
  }
}

.notfound__link {
  color: var(--accent);
  font-weight: 600;
}
</style>
