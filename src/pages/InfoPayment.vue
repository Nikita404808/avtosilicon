<template>
  <div class="info page-content">
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
        413864, Саратовская область, г. Балаково, ул. Саратовское шоссе 52/3, цокольный этаж, ТД «Генезис»<br />
        Пн–Пт: 08:00–18:00<br />
        Телефон: <a href="tel:+79061530222">+7 (906) 153-02-22</a>
      </address>
    </section>
  </div>
</template>

<script setup lang="ts">
const options = [
  {
    title: 'Банковские карты',
    description: 'Оплата банковскими картами — мгновенное зачисление.',
    points: ['Данные карт защищены PCI DSS', 'Чек отправим на email', 'Можно оплатить со смартфона'],
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
