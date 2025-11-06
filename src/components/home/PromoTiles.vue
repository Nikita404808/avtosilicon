<template>
  <section class="promo">
    <div class="container">
      <header class="promo__header">
        <h2>О нашей продукции</h2>
        <div class="promo__tabs" role="tablist" aria-label="Материалы о продукции">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['promo__tab', { 'promo__tab--active': activeTab === tab.id }]"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </header>

      <div class="promo__grid" role="tabpanel" tabindex="0">
        <article v-for="card in activeCards" :key="card.title" class="promo__card">
          <img v-if="card.image" :src="card.image" :alt="card.title" />
          <h3>{{ card.title }}</h3>
          <p>{{ card.description }}</p>
          <RouterLink :to="card.href" class="promo__link">Читать</RouterLink>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import img1154 from '/placeholder/img-hed/IMG_1154.PNG?url';
import img1155 from '/placeholder/img-hed/IMG_1155.PNG?url';
import img1156 from '/placeholder/img-hed/IMG_1156.PNG?url';
import img1157 from '/placeholder/img-hed/IMG_1157.PNG?url';
import img1158 from '/placeholder/img-hed/IMG_1158.PNG?url';
import img1159 from '/placeholder/img-hed/IMG_1159.PNG?url';
import img1160 from '/placeholder/img-hed/IMG_1160.PNG?url';
import img1161 from '/placeholder/img-hed/IMG_1161.PNG?url';
import img1162 from '/placeholder/img-hed/IMG_1162.PNG?url';

type PromoCard = {
  title: string;
  description: string;
  href: string;
  image?: string;
};

type PromoTab = {
  id: string;
  label: string;
  cards: PromoCard[];
};

const tabs = ref<PromoTab[]>([
  {
    id: 'reviews',
    label: 'Обзоры',
    cards: [
      {
        title: 'Буферы стоек — полный обзор',
        description: 'Подбор буферов для различных моделей, советы по эксплуатации.',
        href: '/articles/obzory-bufery',
        image: img1154,
      },
      {
        title: 'Топливные шланги',
        description: 'Разбираем особенности и преимущества силиконовых шлангов.',
        href: '/articles/toplivnye-shlangi',
        image: img1155,
      },
      {
        title: 'Подшипники ступиц',
        description: 'Как выбрать оптимальный комплект для спортивной эксплуатации.',
        href: '/articles/podshipniki-stupic',
        image: img1156,
      },
    ],
  },
  {
    id: 'new',
    label: 'Новинки',
    cards: [
      {
        title: 'Серия АВТОСИЛИКОН Pro',
        description: 'Новая спортивная серия деталей с повышенной износостойкостью.',
        href: '/articles/novinki-pro',
        image: img1157,
      },
      {
        title: 'Комплекты стабилизаторов',
        description: 'Решение «под ключ» для стабилизации хода внедорожников.',
        href: '/articles/stabilizatory',
        image: img1158,
      },
      {
        title: 'Сайлентблоки для LADA Vesta',
        description: 'Усиленный материал и расширенная гарантия.',
        href: '/articles/silentbloki-vesta',
        image: img1159,
      },
    ],
  },
  {
    id: 'tests',
    label: 'Тесты',
    cards: [
      {
        title: 'Выдержит ли -40°C?',
        description: 'Инженерный тест материалов в экстремальных условиях.',
        href: '/articles/testy-holod',
        image: img1160,
      },
      {
        title: '10 000 км без поломок',
        description: 'Отчёт об endurance-тесте на трассе Москва — Владивосток.',
        href: '/articles/testy-endurance',
        image: img1161,
      },
      {
        title: 'Сравнение с OEM',
        description: 'Сравнили наши комплектующие с заводскими аналогами.',
        href: '/articles/testy-oem',
        image: img1162,
      },
    ],
  },
]);

const activeTab = ref(tabs.value[0]?.id ?? '');

const activeCards = computed(() => {
  return tabs.value.find((tab) => tab.id === activeTab.value)?.cards ?? [];
});
</script>

<style scoped lang="scss">
.promo {
  padding: var(--space-8) 0;
}

.promo__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);

  h2 {
    margin: 0;
  }
}

.promo__tabs {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  gap: var(--space-1);
}

.promo__tab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 600;
  color: var(--text-secondary);
  transition: background 120ms ease-out, color 120ms ease-out;

  &--active {
    background: var(--accent);
    color: #fff;
  }
}

.promo__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-5);
}

.promo__card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);

  img {
    border-radius: var(--radius-md);
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
}

.promo__link {
  margin-top: auto;
  font-weight: 600;
  color: var(--accent);
}
</style>
