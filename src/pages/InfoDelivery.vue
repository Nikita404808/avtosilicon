<template>
  <div class="info page-content">
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
import { useRoute } from 'vue-router';
import { useSeo } from '@/composables/useSeo';
import { buildCanonicalFromRoute } from '@/services/seo';

const methods = [
  {
    title: 'Доставка на дом или в офис',
    description: 'Яндекс Доставка или Почта России — подберём удобный вариант.',
    details: [
      'Сроки — 1-5 дней',
      'Бесплатно от 4000 ₽',
      'СДЭК временно в разработке',
      'Отслеживание по треку',
    ],
  },
  {
    title: 'Самовывоз со склада',
    description:
      '413864, Саратовская область, г. Балаково, ул. Саратовское шоссе 52/3, цокольный этаж, ТД «Генезис».',
    details: ['Пн–Пт: 08:00–18:00', 'Телефон: +7 (906) 153-02-22', 'Предварительный звонок желателен'],
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

const route = useRoute();

useSeo({
  title: 'Доставка силиконовых патрубков — Автосиликон',
  description:
    'Доставка патрубков Автосиликон по России и СНГ: Яндекс Доставка, Почта России или самовывоз в Балаково. СДЭК временно в разработке.',
  canonical: buildCanonicalFromRoute(route),
});
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
