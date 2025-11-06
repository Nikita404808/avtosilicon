<template>
  <section class="usp-band">
    <div class="container usp-band__container">
      <article v-for="item in items" :key="item.title" class="usp-band__item">
        <img v-if="item.icon" :src="item.icon" :alt="item.title" class="usp-band__icon" />
        <h3 class="usp-band__title">{{ item.title }}</h3>
        <p class="usp-band__description">{{ item.description }}</p>
        <RouterLink v-if="item.link" :to="item.link.href" class="usp-band__link">
          {{ item.link.label }}
        </RouterLink>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

type USPItem = {
  title: string;
  description: string;
  icon?: string;
  link?: {
    label: string;
    href: string;
  };
};

defineProps<{
  items: USPItem[];
}>();
</script>

<style scoped lang="scss">
.usp-band {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #ffffff 100%);
  padding: var(--space-8) 0;
}

.usp-band__container {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.usp-band__item {
  background-color: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;
}

.usp-band__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto;
}

.usp-band__title {
  font-size: var(--fz-h3);
  line-height: var(--lh-h3);
  font-weight: 600;
}

.usp-band__description {
  color: var(--text-secondary);
}

.usp-band__link {
  color: var(--accent);
  font-weight: 600;
}
</style>
