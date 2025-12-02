<template>
  <section class="gallery">
    <div class="gallery__preview">
      <img :src="activeImage" :alt="title" />
    </div>
    <div class="gallery__thumbs">
      <button
        v-for="image in images"
        :key="image"
        type="button"
        :class="['gallery__thumb', { 'gallery__thumb--active': image === activeImage }]"
        @click="activeImage = image"
      >
        <img :src="image" :alt="title" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  images: string[];
  title: string;
}>();

const placeholder = '/placeholder/product.svg';
const activeImage = ref(props.images[0] ?? placeholder);

watch(
  () => props.images,
  (next) => {
    activeImage.value = next[0] ?? placeholder;
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.gallery {
  display: grid;
  gap: var(--space-4);
  width: 100%;
}

.gallery__preview {
  width: 100%;
  max-width: 720px;
  border-radius: var(--radius-lg);
  background: #f3f6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: var(--space-4);
  margin-inline: auto;

  img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 520px;
    object-fit: contain;
  }
}

.gallery__thumbs {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}

.gallery__thumb {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  padding: 0;
  background: #f3f6ff;
  display: flex;
  align-items: center;
  justify-content: center;

  &--active {
    border-color: var(--accent);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

@media (max-width: 1200px) {
  .gallery {
    max-width: 620px;
    margin-inline: auto;
  }
}

@media (max-width: $breakpoint-tablet) {
  .gallery__thumbs {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scroll-snap-type: x mandatory;
  }

  .gallery__thumb {
    flex: 0 0 64px;
    scroll-snap-align: start;
  }
}

@media (max-width: $breakpoint-mobile) {
  .gallery__preview {
    border-radius: var(--radius-md);
  }
}
</style>
