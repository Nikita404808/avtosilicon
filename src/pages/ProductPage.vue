<template>
  <div class="product page-content" v-if="product">
    <nav class="product__breadcrumbs" aria-label="Хлебные крошки">
      <RouterLink to="/">Главная</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink to="/catalog">Каталог</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ product.title }}</span>
    </nav>

    <div class="product__layout">
      <Gallery :images="product.images" :title="product.title" />
      <BuyBox :product="product" />
    </div>

    <section class="product__details">
      <article class="product__description" v-html="product.descriptionHtml"></article>
      <SpecsTable :product="product" />
      <section v-if="product?.carModel" class="product-usage">
        <h2 class="product-usage__title">Применяется для</h2>
        <div class="product-usage__content">
          <div class="product-usage__info">
            <p class="product-usage__model-name">{{ product.carModel.name }}</p>
          </div>
          <div class="product-usage__image-wrapper">
            <img
              v-if="product.carModel.image"
              :src="product.carModel.image"
              :alt="`Модель ${product.carModel.name}`"
              class="product-usage__image"
            />
          </div>
        </div>
      </section>
    </section>

    <RelatedGrid
      title="Похожие товары"
      :link="{ href: '/catalog', label: 'В каталог' }"
      :products="related"
    />
  </div>
  <div v-else-if="!catalogLoaded" class="product__loading page-content">
    <h1>Загрузка товара...</h1>
    <p>Подождите, мы получаем данные из каталога.</p>
  </div>
  <div v-else class="product__notfound page-content">
    <h1>Товар не найден</h1>
    <RouterLink to="/catalog">Вернуться в каталог</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useCatalogStore } from '@/stores/catalog';
import Gallery from '@/components/product/Gallery.vue';
import BuyBox from '@/components/product/BuyBox.vue';
import SpecsTable from '@/components/product/SpecsTable.vue';
import RelatedGrid from '@/components/product/RelatedGrid.vue';
import { useSeo } from '@/composables/useSeo';
import { buildCanonicalFromRoute, getBrandName, getDefaultOgImageUrl } from '@/services/seo';

const route = useRoute();
const catalogStore = useCatalogStore();
const { products: catalogProducts, hasLoaded: catalogLoaded } = storeToRefs(catalogStore);
const slug = computed(() => route.params.slug as string);

const product = computed(() => catalogProducts.value.find((item) => item.slug === slug.value));

const related = computed(() => {
  if (!product.value) return [];
  const { brand, carModel, partType, categories } = product.value;
  const hasAttributes = Boolean(brand || carModel || partType || (categories ?? []).length);
  return catalogProducts.value
    .filter((item) => item.id !== product.value?.id)
    .filter((item) => {
      if (!hasAttributes) return true;
      if (brand && item.brand === brand) return true;
      if (carModel?.id && item.carModel?.id && String(item.carModel.id) === String(carModel.id)) {
        return true;
      }
      if (partType?.id && item.partType?.id && String(item.partType.id) === String(partType.id)) {
        return true;
      }
      if (categories?.length) {
        return item.categories.some((category) => categories.includes(category));
      }
      return false;
    })
    .slice(0, 4);
});

const defaultProductTitle = 'Карточка товара — Автосиликон | доставка по РФ';

const cleanText = (text: string, limit = 200) => {
  const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped.length <= limit) return stripped;
  return `${stripped.slice(0, limit - 1).trimEnd()}…`;
};

const formatPrice = (price: number | null) => {
  if (price === null || Number.isNaN(price)) return null;
  return `${price.toLocaleString('ru-RU')} ₽`;
};

const canonical = computed(() => buildCanonicalFromRoute(route));
const seoMeta = computed(() => {
  const item = product.value;
  const image = item?.images?.[0] ?? getDefaultOgImageUrl();
  const extraParts = [item?.partType?.name, item?.carModel?.name].filter(Boolean) as string[];
  const title =
    item && extraParts.length > 0
      ? `${item.name} (${extraParts.join(', ')}) — Автосиликон | доставка по РФ`
      : item
        ? `${item?.name} — купить в Автосиликон | Балаково, доставка по РФ`
        : defaultProductTitle;

  const description = (() => {
    if (!item) return undefined;
    if (item.description) {
      return cleanText(item.description, 200);
    }
    const fragments = [item.name];
    if (extraParts.length) {
      fragments.push(extraParts.join(', '));
    }
    const price = formatPrice(item.price);
    if (price) fragments.push(`Цена: ${price}.`);
    fragments.push(`В наличии: ${item.inStock ? 'есть' : 'уточняйте'}.`);
    fragments.push('Производство Автосиликон (Балаково). Доставка по России.');
    return fragments.join(' ');
  })();

  const jsonLd = item
    ? (() => {
        const price = item.price ?? undefined;
        const availability = item.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock';
        const offer: Record<string, unknown> = {
          '@type': 'Offer',
          priceCurrency: 'RUB',
          availability,
          url: canonical.value,
        };
        if (typeof price === 'number') {
          offer.price = price;
        }
        return {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: item.name,
          description: description ?? undefined,
          image: item.images?.length ? item.images : [image],
          brand: {
            '@type': 'Brand',
            name: getBrandName(),
          },
          sku: item.sku ?? undefined,
          gtin13: item.barcode ?? undefined,
          offers: offer,
        };
      })()
    : null;

  return {
    title,
    description,
    canonical: canonical.value,
    ogType: 'product',
    ogImage: image,
    twitterImage: image,
    jsonLd,
  };
});

useSeo(seoMeta);

onMounted(() => {
  catalogStore.fetchProducts();
});
</script>

<style scoped lang="scss">
.product {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.product__breadcrumbs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--fz-caption);
  color: var(--text-secondary);
  padding: 0 var(--space-2);
}

.product__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  gap: var(--space-6);

  @media (max-width: 1200px) {
    justify-items: center;
  }

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }
}

.product__details {
  display: grid;
  gap: var(--space-5);
}

.product__description {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);
}

.product-usage {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: var(--space-4);
}

.product-usage__content {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.product-usage__title {
  margin: 0;
}

.product-usage__model-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.product-usage__image-wrapper {
  max-width: 100%;
}

.product-usage__image {
  display: block;
  width: 100%;
  height: auto;
}

.product__notfound {
  padding: var(--space-8) 0;
  display: grid;
  gap: var(--space-4);
}

.product__loading {
  padding: var(--space-8) 0;
  display: grid;
  gap: var(--space-3);
}

@media (max-width: $breakpoint-tablet) {
  .product {
    padding-top: var(--space-5);
  }

  .product__details {
    gap: var(--space-4);
  }

  .product__description {
    padding: var(--space-4);
  }

  .product-usage {
    padding: var(--space-5);
  }
}

@media (max-width: $breakpoint-mobile) {
  .product {
    padding-top: var(--space-4);
  }

  .product__layout {
    gap: var(--space-4);
  }

  .product-usage {
    padding: var(--space-4);
  }

  .product__breadcrumbs {
    padding-inline: var(--space-3);
  }
}
</style>
