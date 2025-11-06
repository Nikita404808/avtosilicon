<template>
  <section class="achievements">
    <div class="container">
      <header class="achievements__header">
        <h2>Наши достижения</h2>
        <p>Победы в гонках, отраслевые награды и сертификации качества.</p>
      </header>
      <Swiper
        class="achievements__swiper"
        :loop="true"
        :space-between="16"
        :slides-per-view="2.2"
        :breakpoints="breakpoints"
        :modules="modules"
        :autoplay="autoplayOptions"
      >
        <SwiperSlide v-for="item in achievements" :key="item.id">
          <article class="achievements__card">
            <img :src="item.image" :alt="item.title" />
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </SwiperSlide>
      </Swiper>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { AutoplayOptions } from 'swiper/types';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';

const modules = [Autoplay];

const achievements = [
  {
    id: 'a1',
    title: 'Autoparts Expo 2024',
    description: 'Лучший производитель полиуретановых деталей',
    image: '/placeholder/achievements/expo.svg',
  },
  {
    id: 'a2',
    title: 'Racing Moscow Series',
    description: 'Команда АВТОСИЛИКОН заняла 1 место в классе GT',
    image: '/placeholder/achievements/racing.svg',
  },
  {
    id: 'a3',
    title: 'ISO 9001',
    description: 'Сертификация системы менеджмента качества',
    image: '/placeholder/achievements/iso.svg',
  },
  {
    id: 'a4',
    title: 'Top-100 брендов',
    description: 'Вошли в топ-100 брендов для тюнинга в СНГ',
    image: '/placeholder/achievements/top100.svg',
  },
];

const breakpoints = {
  0: { slidesPerView: 1.2 },
  768: { slidesPerView: 2.2 },
  1200: { slidesPerView: 3.5 },
};

const autoplayOptions: AutoplayOptions = {
  delay: 3200,
  disableOnInteraction: false,
};
</script>

<style scoped lang="scss">
.achievements {
  padding: var(--space-8) 0;
}

.achievements__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  max-width: 600px;
}

.achievements__swiper {
  padding-bottom: var(--space-5);
}

.achievements__card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
  text-align: center;
  box-shadow: var(--shadow-sm);

  img {
    width: 120px;
    height: 120px;
    object-fit: contain;
  }
}
</style>
