<template>
  <div
    class="app-pagination"
    style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px"
  >
    <AppButton type="secondary" :disabled="currentPage === 1" @click="changePage(currentPage - 1)"
      >Previous</AppButton
    >
    <span style="font-size: 14px">Page {{ currentPage }} of {{ totalPages }}</span>
    <AppButton
      type="secondary"
      :disabled="currentPage === totalPages"
      @click="changePage(currentPage + 1)"
      >Next</AppButton
    >
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalItems: {
    type: Number,
    required: true,
  },
  itemsPerPage: {
    type: Number,
    default: 10,
  },
})

const emit = defineEmits(['update:currentPage', 'page-change'])

const totalPages = computed(() => {
  return Math.ceil(props.totalItems / props.itemsPerPage) || 1
})

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('update:currentPage', page)
    emit('page-change', page)
  }
}
</script>
