<template>
  <div class="hud-top" v-if="showTopUI">
    <div class="hud-top-left action-buttons">
      <AppButton type="secondary" @click="$emit('save')">월드 저장</AppButton>
      <AppButton type="secondary" @click="$emit('load')">월드 목록 새로고침</AppButton>
    </div>
    <div class="hud-top-right">
      <span class="badge-success">현재 인구: {{ population }}명</span>
      <span class="badge-primary"> 🕒 {{ displayTime }} ({{ getSeasonName(season) }}) </span>
      <span class="badge-warning">대지 비옥도: {{ Math.floor(fertility) }} / {{ maxFertility }}</span>
    </div>
  </div>
</template>

<script setup>
import AppButton from '../../common/components/AppButton.vue'

defineProps({
  showTopUI: Boolean,
  population: Number,
  displayTime: String,
  season: String,
  fertility: Number,
  maxFertility: Number
})
defineEmits(['save', 'load'])

const getSeasonName = (s) => {
  const map = { SPRING: '봄 🌸', SUMMER: '여름 ☀️', AUTUMN: '가을 🍂', WINTER: '겨울 ❄️' }
  return map[s] || s
}
</script>
