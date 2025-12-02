<template>
  <section class="promo">
    <div class="container">
      <header class="promo__header">
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

      <div class="promo__panel" role="tabpanel" tabindex="0">
        <template v-if="isProductTab">
          <div v-if="isLoading" class="promo__state">Загрузка новинок...</div>
          <div v-else-if="hasError" class="promo__state promo__state--error">
            {{ error }}
          </div>
          <div v-else-if="!newProducts.length" class="promo__state">Новинок пока нет.</div>
          <div v-else class="promo__product-grid">
            <ProductCard v-for="product in newProducts" :key="product.id" :product="product" />
          </div>
        </template>
        <div v-else class="promo__grid">
          <article v-for="card in activeCards" :key="card.title" class="promo__card">
            <img v-if="card.image" :src="card.image" :alt="card.title" />
            <h3>{{ card.title }}</h3>
            <p v-if="card.description">{{ card.description }}</p>
            <RouterLink :to="card.href" class="promo__link">Читать</RouterLink>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import coolingImage from '/placeholder/foto/image1-31.jpeg?url';
import reinforcedImage from '/placeholder/foto/image2-33.jpeg?url';
import customFormsImage from '/placeholder/foto/image3-35.jpeg?url';
import ProductCard from '@/components/catalog/ProductCard.vue';
import { fetchNewProducts } from '@/api/directus';
import type { Product } from '@/types';

type PromoCard = {
  title: string;
  description: string;
  href: string;
  image?: string;
};

type PromoTab = {
  id: string;
  label: string;
  type: 'articles' | 'products';
  cards: PromoCard[];
};

const tabs = ref<PromoTab[]>([
  {
    id: 'reviews',
    label: 'Обзоры',
    type: 'articles',
    cards: [
      {
        title: 'Патрубки для систем охлаждения и отопления (турбонаддув, радиаторы, печка)',
        description: '',
        href: '/articles/obzory-bufery',
        image: coolingImage,
      },
      {
        title: 'Армированные патрубки (4-5 слоев)',
        description: '',
        href: '/articles/toplivnye-shlangi',
        image: reinforcedImage,
      },
      {
        title: 'Патрубки нестандартных форм (угловые, редукционные)',
        description: '',
        href: '/articles/podshipniki-stupic',
        image: customFormsImage,
      },
    ],
  },
  {
    id: 'new',
    label: 'Новинки',
    type: 'products',
    cards: [],
  },
]);

const activeTab = ref(tabs.value[0]?.id ?? '');

const activeCards = computed(() => {
  const tab = tabs.value.find((item) => item.id === activeTab.value);
  return tab?.type === 'articles' ? tab.cards : [];
});

const isProductTab = computed(() => {
  const tab = tabs.value.find((item) => item.id === activeTab.value);
  return tab?.type === 'products';
});

const newProducts = ref<Product[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const loadNewProducts = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    newProducts.value = await fetchNewProducts(6);
  } catch (err) {
    console.error('[Promo][NewProducts]', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить новинки';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadNewProducts();
});

const hasError = computed(() => Boolean(error.value));
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
}

.promo__tabs {
  display: inline-flex;
  align-self: flex-start;
  background: rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-lg);
  padding: var(--space-1) calc(var(--space-1) * 1.5) var(--space-1) var(--space-1);
  gap: var(--space-1);
  width: fit-content;
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
    width: 100%;
    max-height: 220px;
    border-radius: var(--radius-md);
    object-fit: contain;
    display: block;
    background: rgba(0, 0, 0, 0.04);
  }
}

.promo__link {
  margin-top: auto;
  font-weight: 600;
  color: var(--accent);
}

.promo__panel {
  min-height: 320px;
}

.promo__state {
  padding: var(--space-6);
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);
}

.promo__state--error {
  color: var(--danger, #c62828);
}

.promo__product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-5);

  @media (max-width: 1024px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: $breakpoint-tablet) {
    gap: var(--space-3);
  }

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}

@media (max-width: $breakpoint-tablet) {
  .promo {
    padding: var(--space-6) 0;
  }

  .promo__tabs {
    width: 100%;
    justify-content: center;
    flex-wrap: wrap;
  }

  .promo__panel {
    min-height: 0;
  }
}

@media (max-width: $breakpoint-mobile) {
  .promo__card {
    padding: var(--space-4);
  }

  .promo__panel {
    min-height: auto;
  }
}
</style>
