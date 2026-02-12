<template>
  <div class="home page-content">
    <Hero />
    <PromoTiles />
    <ReviewsCarousel />
    <USPBand :items="uspItems" />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import Hero from '@/components/home/Hero.vue';
import PromoTiles from '@/components/home/PromoTiles.vue';
import ReviewsCarousel from '@/components/home/ReviewsCarousel.vue';
import USPBand from '@/components/USPBand.vue';
import { useSeo } from '@/composables/useSeo';
import { buildCanonicalFromRoute } from '@/services/seo';

const uspItems = [
  {
    title: 'Доставка',
    description: 'Бесплатная доставка заказов от 4000 ₽ по России и СНГ.',
    icon: '/placeholder/foto/icons8-доставка-100.png',
    link: { href: '/info/delivery', label: 'Подробнее' },
  },
  {
    title: 'Оплата',
    description: '3 способа оплаты: банковские карты, безналичный, наложенный платеж.',
    icon: '/placeholder/foto/icons8-оплата-100.png',
    link: { href: '/info/payment', label: 'Способы оплаты' },
  },
  {
    title: 'Партнёры',
    description: 'Дилеры в 60+ регионах, поддержка оптовых заказов и спецусловия.',
    icon: '/placeholder/foto/icons8-партнеры-64.png',
    link: { href: '/contacts', label: 'Где купить' },
  },
];

const route = useRoute();

useSeo({
  title: 'Автосиликон — производство силиконовых патрубков | Балаково, доставка по РФ',
  description:
    'Производство армированных силиконовых патрубков для авто, спецтехники и промышленности. Балаково. Доставка по России. Тел: +7 (906) 153-02-22',
  canonical: buildCanonicalFromRoute(route),
});
</script>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-bottom: var(--space-9);
}

@media (max-width: $breakpoint-mobile) {
  .home {
    gap: var(--space-6);
    padding-bottom: var(--space-7);
  }
}
</style>
