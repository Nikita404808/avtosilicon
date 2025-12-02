<template>
  <section class="reviews">
    <div class="container">
      <header class="reviews__header">
        <h2>Отзывы о АВТОСИЛИКОН</h2>
        <div class="reviews__rating">
          <span class="reviews__stars" aria-hidden="true">★★★★★</span>
          <span>4,8 / 5</span>
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
    id: 'mihail-u',
    author: 'Михаил У.',
    score: 5.0,
    text: 'Отличные патрубки, стали как родные, высокий уровень качества. Месяц назад поставил — ни капли антифриза под машиной. Берите смело, рекомендую.',
  },
  {
    id: 'sergey-d',
    author: 'Сергей Давидович',
    score: 5.0,
    text: 'Брал комплект на Приору универсал: всё подошло, длинные патрубки чуть подрезал. Качество и быстрая доставка, рекомендую.',
  },
  {
    id: 'andrey-r',
    author: 'Андрей Р.',
    score: 5.0,
    text: 'Хорошее качество и точные размеры. Недостатков не нашёл — поставил и забыл.',
  },
  {
    id: 'mihail-shvedov',
    author: 'Михаил Шведов',
    score: 3.0,
    text: 'Заказал комплект для Оки СеАЗ 11116. Продавец всё отправил, жду установку, чтобы убедиться, что всё подойдёт.',
  },
  {
    id: 'slava',
    author: 'Слава',
    score: 5.0,
    text: 'Сделка через Авито Доставку на комплект для Lada Kalina. Упаковка и отправка в срок, всё соответствует описанию.',
  },
  {
    id: 'ivan-mashtakov',
    author: 'Иван Маштаков',
    score: 5.0,
    text: 'Брал комплект на ВАЗ 2108–99. Продавец сразу ответил, отправил на следующий день. Таких людей только друзьям советовать!',
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
