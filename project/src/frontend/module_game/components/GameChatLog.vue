<template>
  <div class="game-chat-log custom-scroll">
    <div class="chat-header">📜 실시간 이벤트 & 대화 로그</div>
    <div class="chat-messages" ref="chatContainer">
      <div v-for="(log, index) in logs" :key="index" class="chat-message">
        <span class="chat-time">[{{ log.time }}]</span>
        <span class="chat-sender" :style="{ color: log.color || '#f1c40f' }">
          {{ log.sender }}
        </span>
        <span class="chat-text">{{ log.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  logs: {
    type: Array,
    default: () => [],
  },
})

const chatContainer = ref(null)

// 로그가 추가될 때마다 스크롤을 가장 아래로 부드럽게 이동시킵니다.
watch(
  () => props.logs.length,
  async () => {
    await nextTick()
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  },
)
</script>

<style scoped>
.game-chat-log {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 350px;
  height: 220px;
  background: rgba(20, 30, 40, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  backdrop-filter: blur(4px);
  z-index: 10;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}
.chat-header {
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: bold;
  color: #ecf0f1;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.chat-message {
  font-size: 0.85rem;
  line-height: 1.4;
  word-break: keep-all;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.chat-time {
  color: #7f8c8d;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.chat-sender {
  font-weight: bold;
  flex-shrink: 0;
  white-space: nowrap;
}
.chat-text {
  color: #bdc3c7;
}
/* 스크롤바 커스텀 */
.chat-messages::-webkit-scrollbar {
  width: 4px;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
</style>
