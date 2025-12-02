<template>
  <div class="notfound page-content">
    <h1>404</h1>
    <p>Страница не найдена или была перенесена.</p>
    <RouterLink to="/" class="notfound__link">Вернуться на главную</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
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
