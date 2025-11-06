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
}

.gallery__preview {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  background: #f3f6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.gallery__thumbs {
  display: inline-flex;
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
</style>
