<template>
  <div class="info container">
    <header class="info__header">
      <h1>Оплата</h1>
      <p>Поддерживаем безопасные способы оплаты для физических и юридических лиц.</p>
    </header>

    <section class="info__options">
      <article v-for="option in options" :key="option.title">
        <h2>{{ option.title }}</h2>
        <p>{{ option.description }}</p>
        <ul>
          <li v-for="item in option.points" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>

    <section class="info__warehouse">
      <h2>Выдача со склада</h2>
      <address>
        Москва, ул. Промышленная, 12<br />
        Пн–Пт 09:00–18:00<br />
        Телефон: <a href="tel:+78002002020">8 800 200-20-20</a>
      </address>
    </section>
  </div>
</template>

<script setup lang="ts">
const options = [
  {
    title: 'Банковские карты',
    description: 'Visa, MasterCard, Мир — мгновенное зачисление.',
    points: ['Данные карт защищены PCI DSS', 'Чек отправим на email', 'Можно оплатить со смартфона'],
  },
  {
    title: 'Безналичный расчёт',
    description: 'Для юридических лиц выставляем счёт и предоставляем закрывающие документы.',
    points: ['Готовим счёт за 30 минут', 'Электронный документооборот по запросу', 'Доставка после оплаты'],
  },
  {
    title: 'Наложенный платёж',
    description: 'Оплачивайте заказ при получении в пункте выдачи или курьеру.',
    points: ['Доступно для заказов до 15 000 ₽', 'Комиссию оплачивает покупатель', 'Проверка товара до оплаты'],
  },
];
</script>

<style scoped lang="scss">
.info {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.info__options {
  display: grid;
  gap: var(--space-4);

  article {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    box-shadow: var(--shadow-sm);

    ul {
      margin-top: var(--space-3);
      display: grid;
      gap: var(--space-2);
    }
  }
}

.info__warehouse {
  background: var(--bg);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}
</style>
