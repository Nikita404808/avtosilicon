<template>
  <div class="home">
    <Hero />
    <PromoTiles />
    <CompanyLife />
    <ReviewsCarousel />
    <AchievementsCarousel />
    <NewsCarousel />
    <USPBand :items="uspItems" />
  </div>
</template>

<script setup lang="ts">
import Hero from '@/components/home/Hero.vue';
import PromoTiles from '@/components/home/PromoTiles.vue';
import CompanyLife from '@/components/home/CompanyLife.vue';
import ReviewsCarousel from '@/components/home/ReviewsCarousel.vue';
import AchievementsCarousel from '@/components/home/AchievementsCarousel.vue';
import NewsCarousel from '@/components/home/NewsCarousel.vue';
import USPBand from '@/components/USPBand.vue';

const uspItems = [
  {
    title: 'Доставка',
    description: 'Бесплатная доставка заказов от 4000 ₽ по России и СНГ.',
    icon: '/placeholder/usp/delivery.svg',
    link: { href: '/info/delivery', label: 'Подробнее' },
  },
  {
    title: 'Оплата',
    description: '3 способа оплаты: банковские карты, безналичный, наложенный платеж.',
    icon: '/placeholder/usp/payment.svg',
    link: { href: '/info/payment', label: 'Способы оплаты' },
  },
  {
    title: 'Гарантия',
    description: 'Расширенная гарантия до 12 месяцев на продукцию АВТОСИЛИКОН.',
    icon: '/placeholder/usp/warranty.svg',
    link: { href: '/info/warranty', label: 'Условия' },
  },
];
</script>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
