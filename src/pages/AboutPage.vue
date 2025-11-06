<template>
  <div class="about container">
    <section class="about__hero">
      <h1>О компании АВТОСИЛИКОН</h1>
      <p>
        Мы производим автокомпоненты из силикона, полиуретана и резины для легковых и коммерческих
        автомобилей. Собственный R&amp;D и производство в России.
      </p>
    </section>

    <section class="about__kpis">
      <article v-for="item in kpis" :key="item.label" class="about__kpi">
        <span class="about__kpi-value">{{ item.value }}</span>
        <span class="about__kpi-label">{{ item.label }}</span>
      </article>
    </section>

    <section class="about__slider">
      <header>
        <h2>Упаковка, которой мы гордимся</h2>
        <p>Каждая партия проходит контроль на герметичность и маркировку.</p>
      </header>
      <div class="about__packaging-grid">
        <article v-for="item in packaging" :key="item.id" class="about__slide">
          <img :src="item.image" :alt="item.title" />
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="about__cards">
      <article v-for="card in community" :key="card.title" class="about__card">
        <img :src="card.icon" :alt="card.title" />
        <h3>{{ card.title }}</h3>
        <p>{{ card.description }}</p>
        <a :href="card.href" target="_blank" rel="noopener">Подробнее</a>
      </article>
    </section>

    <section class="about__guarantee">
      <h2>Гарантия</h2>
      <p>
        На большинство изделий АВТОСИЛИКОН действует гарантия до 12 месяцев, которая включает
        бесплатную замену и поддержку в техническом чате.
      </p>
      <RouterLink to="/info/warranty" class="about__link">Условия гарантии</RouterLink>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

const kpis = [
  { value: '2011', label: 'Год основания' },
  { value: '2600+', label: 'SKU в каталоге' },
  { value: '4.9', label: 'Средняя оценка клиентов' },
  { value: '12 мес.', label: 'Гарантия на продукцию' },
];

const packaging = [
  {
    id: 'pack1',
    title: 'Индивидуальные zip-пакеты',
    description: 'Этикетка с QR-кодом на карточку товара и инструкцию по установке.',
    image: '/placeholder/about/pack1.svg',
  },
  {
    id: 'pack2',
    title: 'Фирменные боксы АВТОСИЛИКОН',
    description: 'Гофрокартон с усиленной защитой углов для транспортировки.',
    image: '/placeholder/about/pack2.svg',
  },
  {
    id: 'pack3',
    title: 'Прозрачная маркировка',
    description: 'Легко организовать склад и вести учёт в сервисах учёта.',
    image: '/placeholder/about/pack3.svg',
  },
];

const community = [
  {
    title: 'Гонки',
    description: 'Поддерживаем команды в RDS и кольцевых чемпионатах.',
    href: 'https://vk.com/cs20',
    icon: '/placeholder/about/racing.svg',
  },
  {
    title: 'Выставки',
    description: 'Выступаем на Automechanika, MIMS, делимся инновациями.',
    href: 'https://mims.ru',
    icon: '/placeholder/about/expo.svg',
  },
  {
    title: 'Благотворительность',
    description: 'Помогаем автошколам и образовательным проектам.',
    href: '#',
    icon: '/placeholder/about/charity.svg',
  },
];
</script>

<style scoped lang="scss">
.about {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-8);
}

.about__hero {
  display: grid;
  gap: var(--space-3);
  max-width: 720px;
}

.about__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-4);
}

.about__kpi {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.about__kpi-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
}

.about__slider {
  display: grid;
  gap: var(--space-4);
}

.about__packaging-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.about__slide {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
  text-align: center;

  img {
    height: 160px;
    object-fit: contain;
  }
}

.about__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.about__card {
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;

  img {
    width: 64px;
    height: 64px;
    margin: 0 auto;
  }

  a {
    color: var(--accent);
    font-weight: 600;
  }
}

.about__guarantee {
  background: var(--bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: grid;
  gap: var(--space-3);
}

.about__link {
  color: var(--accent);
  font-weight: 600;
}
</style>
