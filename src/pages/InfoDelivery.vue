<template>
  <div class="info container">
    <header class="info__header">
      <h1>Доставка</h1>
      <p>Выберите удобный способ получения заказов АВТОСИЛИКОН.</p>
    </header>

    <section class="info__methods">
      <article v-for="method in methods" :key="method.title">
        <h2>{{ method.title }}</h2>
        <p>{{ method.description }}</p>
        <ul>
          <li v-for="item in method.details" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>

    <section class="info__faq">
      <h2>FAQ</h2>
      <details v-for="faq in faqs" :key="faq.question">
        <summary>{{ faq.question }}</summary>
        <p>{{ faq.answer }}</p>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
const methods = [
  {
    title: 'Курьерская доставка',
    description: 'СДЕК или BOXBERRY на дом или в офис.',
    details: ['Сроки — 1-5 дней', 'Бесплатно от 4000 ₽', 'Отслеживание по треку'],
  },
  {
    title: 'Пункты выдачи',
    description: 'Более 3000 точек по России и СНГ.',
    details: ['Срок хранения — 7 дней', 'Уведомления в SMS и email', 'Можно проверить товар на месте'],
  },
  {
    title: 'Самовывоз со склада',
    description: 'Москва, ул. Промышленная, 12. Въезд для клиентов на территории.',
    details: ['Работаем Пн–Пт 09:00–18:00', 'Предварительный звонок обязателен', 'Подготовим заказ заранее'],
  },
];

const faqs = [
  {
    question: 'Как отследить заказ?',
    answer: 'После отправки мы пришлём трек-номер и ссылку на страницу отслеживания.',
  },
  {
    question: 'Можно ли изменить адрес доставки?',
    answer: 'Напишите менеджеру до передачи заказа службе доставки, и мы скорректируем адрес.',
  },
  {
    question: 'Что делать, если посылку задержали?',
    answer: 'Свяжитесь с нами, мы запросим статус у партнёров и предложим решение.',
  },
];
</script>

<style scoped lang="scss">
.info {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.info__methods {
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

.info__faq {
  display: grid;
  gap: var(--space-3);

  details {
    background: var(--bg);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
}
</style>
