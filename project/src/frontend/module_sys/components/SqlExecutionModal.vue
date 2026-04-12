<template>
  <div class="app-modal-overlay">
    <div class="app-modal">
      <div
        style="
          padding: 16px;
          border-bottom: 1px solid var(--app-border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <h3 style="margin: 0; font-size: 1.2rem">SQL DDL 스크립트 생성</h3>
        <button class="btn btn-secondary" style="padding: 4px 8px" @click="$emit('close')">
          X
        </button>
      </div>
      <div class="app-modal-body">
        <textarea
          class="app-input"
          rows="12"
          v-model="localSql"
          style="
            font-family: monospace;
            font-size: 0.9rem;
            background-color: #f8f9fa;
            width: 100%;
            box-sizing: border-box;
          "
        ></textarea>
        <div style="margin-top: 16px; text-align: right">
          <button class="btn btn-secondary" @click="$emit('close')">닫기</button>
          <button
            class="btn btn-primary"
            style="margin-left: 8px"
            @click="$emit('execute', localSql)"
          >
            DB 적용(실행)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

// props 변수를 명시적으로 선언해주어야 내부 스크립트에서 props.sqlContent 로 접근할 수 있습니다.
const props = defineProps({
  sqlContent: { type: String, required: true },
})

defineEmits(['close', 'execute'])

const localSql = ref(props.sqlContent)
watch(
  () => props.sqlContent,
  (newVal) => {
    localSql.value = newVal
  },
)
</script>
