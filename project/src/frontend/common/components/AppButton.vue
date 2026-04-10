<template>
  <button :class="['btn', `btn-${type}`]" :disabled="disabled" @click="$emit('click', $event)">
    <slot></slot>
  </button>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'primary', // 'primary', 'secondary' 등 main.css에 정의된 타입
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])
</script>
