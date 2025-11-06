<template>
  <section class="reviews">
    <div class="container">
      <header class="reviews__header">
        <h2>Отзывы о АВТОСИЛИКОН</h2>
        <div class="reviews__rating">
          <span class="reviews__stars" aria-hidden="true">★★★★★</span>
          <span>4,9 / 5</span>
        </div>
      </header>
      <Swiper
        class="reviews__swiper"
        :loop="true"
        :slides-per-view="1.1"
        :space-between="24"
        :centered-slides="false"
        :autoplay="autoplayOptions"
        :breakpoints="breakpoints"
        :modules="modules"
      >
        <SwiperSlide v-for="review in reviews" :key="review.id">
          <article class="reviews__card">
            <header>
              <h3>{{ review.author }}</h3>
              <span class="reviews__score">{{ review.score.toFixed(1) }}</span>
            </header>
            <p>{{ review.text }}</p>
          </article>
        </SwiperSlide>
      </Swiper>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { AutoplayOptions } from 'swiper/types';
import 'swiper/css';
import { Autoplay } from 'swiper/modules';

const reviews = [
  {
    id: '1',
    author: 'Алексей П.',
    score: 4.9,
    text: 'Использую сайлентблоки АВТОСИЛИКОН на своём кроссовере. После установки пропали вибрации.',
  },
  {
    id: '2',
    author: 'Мария Н.',
    score: 5.0,
    text: 'Отдельное спасибо за быструю доставку и подробную консультацию по подбору.',
  },
  {
    id: '3',
    author: 'Игорь Р.',
    score: 4.8,
    text: 'Ставил комплект полиуретановых втулок. Машина стала собраннее, гарантия реальная.',
  },
  {
    id: '4',
    author: 'drive2.ru/АВТОСИЛИКОН',
    score: 5.0,
    text: 'Подробно тестировали на треке — износ практически нулевой, держат нагрузку отлично.',
  },
];

const modules = [Autoplay];

const autoplayOptions: AutoplayOptions = {
  delay: 4000,
  disableOnInteraction: false,
};

const breakpoints = {
  0: {
    slidesPerView: 1.1,
  },
  768: {
    slidesPerView: 2.1,
  },
  1200: {
    slidesPerView: 3,
  },
};

</script>

<style scoped lang="scss">
.reviews {
  padding: var(--space-8) 0;
  background: var(--bg);
}

.reviews__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.reviews__rating {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: #fff;
  padding: var(--space-2) var(--space-3);
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.reviews__stars {
  color: #f6c344;
  letter-spacing: 4px;
  font-size: 20px;
}

.reviews__swiper {
  padding-bottom: var(--space-6);
}

.reviews__card {
  height: 100%;
  background: #fff;
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.reviews__score {
  background: var(--brand-primary);
  color: #fff;
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  font-weight: 600;
}
</style>
