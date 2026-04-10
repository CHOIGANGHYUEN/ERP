<template>
  <h1 class="app-page-title">
    <slot>{{ title }}</slot>
  </h1>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
})
</script>
