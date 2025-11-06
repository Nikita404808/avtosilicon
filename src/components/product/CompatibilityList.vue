<template>
  <section class="compatibility">
    <h2>Где применяется</h2>
    <ul>
      <li v-for="item in compatibility" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  compatibility: string[];
}>();
</script>

<style scoped lang="scss">
.compatibility {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);

  h2 {
    margin-top: 0;
    margin-bottom: var(--space-3);
  }

  ul {
    display: grid;
    gap: var(--space-2);
    font-size: var(--fz-body);
  }
}
</style>
