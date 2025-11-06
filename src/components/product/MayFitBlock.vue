<template>
  <section class="mayfit" v-if="items.length">
    <h2>Может подойти к вашему авто</h2>
    <ul>
      <li v-for="item in items" :key="item">
        <span>{{ item }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  items: string[];
}>();
</script>

<style scoped lang="scss">
.mayfit {
  background: var(--bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: grid;
  gap: var(--space-3);

  ul {
    display: grid;
    gap: var(--space-2);
  }
}
</style>
