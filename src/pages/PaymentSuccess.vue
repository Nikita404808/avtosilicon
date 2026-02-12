<template>
  <section class="payment-result">
    <h1>Оплата прошла успешно</h1>
    <p>Спасибо! Заказ оплачен. Мы отправим подтверждение на почту.</p>
    <RouterLink to="/" class="payment-result__link">Вернуться на главную</RouterLink>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<style scoped>
.payment-result {
  max-width: 720px;
  margin: 48px auto;
  padding: 24px;
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  text-align: center;
}

.payment-result__link {
  display: inline-block;
  margin-top: 16px;
  color: var(--accent);
}
</style>
