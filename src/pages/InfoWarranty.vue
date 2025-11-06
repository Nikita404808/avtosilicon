<template>
  <div class="info container">
    <header class="info__header">
      <h1>Гарантия и возврат</h1>
      <p>Условия замены и обслуживания продукции АВТОСИЛИКОН.</p>
    </header>

    <section class="info__accordions">
      <details v-for="section in sections" :key="section.title" open>
        <summary>{{ section.title }}</summary>
        <ul>
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
const sections = [
  {
    title: 'Стандартная гарантия',
    items: [
      '12 месяцев с даты продажи при условии соблюдения правил установки.',
      'Сохраняйте упаковку и чек — они понадобятся для подтверждения покупки.',
      'Гарантия действует на заводские дефекты и несоответствие характеристик.',
    ],
  },
  {
    title: 'Как оформить возврат',
    items: [
      'Напишите на support@cs20.ru и приложите фотографии дефекта.',
      'Менеджер вышлет форму заявления и организует доставку.',
      'В течение 5 рабочих дней мы подтверждаем результат экспертизы.',
    ],
  },
  {
    title: 'Случаи, когда гарантия не действует',
    items: [
      'Неправильная установка или эксплуатация вне рекомендуемых условий.',
      'Механические повреждения, полученные при ДТП.',
      'Отсутствие документов, подтверждающих покупку.',
    ],
  },
];
</script>

<style scoped lang="scss">
.info {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-5);
}

.info__header {
  display: grid;
  gap: var(--space-2);
}

.info__accordions {
  display: grid;
  gap: var(--space-3);

  details {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    box-shadow: var(--shadow-sm);

    summary {
      font-weight: 600;
      cursor: pointer;
    }

    ul {
      margin-top: var(--space-3);
      display: grid;
      gap: var(--space-2);
    }
  }
}
</style>
