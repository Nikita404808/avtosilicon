<template>
  <section class="hero">
    <div class="container hero__container">
      <div class="hero__content">
        <p class="hero__eyebrow">АВТОСИЛИКОН — 7 лет на рынке</p>
        <h1 class="hero__title">
          Производство армированных силиконовых патрубков для авто, спецтехники и промышленности.
        </h1>
        <p class="hero__description">
          Изготовление по ГОСТ и индивидуальным чертежам.
        </p>
        <RouterLink to="/catalog" class="hero__cta">Перейти в каталог</RouterLink>
      </div>
      <div class="hero__media" aria-hidden="true">
        <img :src="heroPrimary" alt="" class="hero__photo" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import heroPrimary from '/placeholder/img-hed/IMG_1153.PNG?url';
</script>

<style scoped lang="scss">
.hero {
  padding: var(--space-8) 0;
  background: #fff;
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
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: clamp(320px, 38vw, 520px);
}

.hero__photo {
  width: min(100%, 480px);
  max-width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

@media (max-width: $breakpoint-mobile) {
  .hero {
    padding: var(--space-6) 0 var(--space-5);
  }

  .hero__container {
    gap: var(--space-5);
  }

  .hero__media {
    order: -1;
    min-height: 240px;
    width: 100%;
  }

  .hero__photo {
    width: min(100%, 360px);
  }

  .hero__content {
    gap: var(--space-4);
  }
}
</style>
