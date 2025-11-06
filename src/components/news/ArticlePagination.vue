<template>
  <Pagination :current-page="currentPage" :total-pages="totalPages" @update:page="$emit('update:page', $event)" />
</template>

<script setup lang="ts">
import Pagination from '@/components/catalog/Pagination.vue';

defineProps<{
  currentPage: number;
  totalPages: number;
}>();

defineEmits<{
  (event: 'update:page', value: number): void;
}>();
</script>
