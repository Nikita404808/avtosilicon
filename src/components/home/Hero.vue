<template>
  <section class="hero">
    <div class="container hero__container">
      <div class="hero__content">
        <p class="hero__eyebrow">АВТОСИЛИКОН — 12 лет на рынке</p>
        <h1 class="hero__title">
          Автозапчасти из силикона, полиуретана и резины для вашего авто
        </h1>
        <p class="hero__description">
          Подбор по марке, премиальная линейка, собственные разработки инженеров АВТОСИЛИКОН.
        </p>
        <RouterLink to="/catalog" class="hero__cta">Перейти в каталог</RouterLink>
      </div>
      <div class="hero__media" aria-hidden="true">
        <img :src="heroPrimary" alt="" class="hero__photo hero__photo--primary" />
        <img :src="heroSecondary" alt="" class="hero__photo hero__photo--secondary" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import heroPrimary from '/placeholder/img-hed/IMG_1153.PNG?url';
import heroSecondary from '/placeholder/img-hed/IMG_1156.PNG?url';
</script>

<style scoped lang="scss">
.hero {
  padding: var(--space-8) 0;
  background: radial-gradient(circle at top right, rgba(118, 194, 240, 0.25), transparent 60%),
    #fff;
}

.hero__container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-8);
  align-items: center;

  @media (max-width: $breakpoint-tablet) {
    grid-template-columns: 1fr;
  }
}

.hero__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--accent);
}

.hero__title {
  font-size: var(--fz-h1);
  line-height: var(--lh-h1);
  margin: 0;
}

.hero__description {
  color: var(--text-secondary);
  max-width: 520px;
}

.hero__cta {
  align-self: flex-start;
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-6);
  background: linear-gradient(90deg, var(--accent), var(--brand-primary));
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-md);
}

.hero__media {
  position: relative;
  display: grid;
  place-items: center;
  min-height: clamp(280px, 35vw, 420px);
}

.hero__photo {
  width: clamp(260px, 32vw, 420px);
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.hero__photo--primary {
  z-index: 2;
}

.hero__photo--secondary {
  position: absolute;
  width: clamp(180px, 24vw, 320px);
  transform: translate(38%, 32%);
  border-radius: var(--radius-md);
  border: 6px solid #fff;
  box-shadow: var(--shadow-md);
  z-index: 1;
}
</style>
