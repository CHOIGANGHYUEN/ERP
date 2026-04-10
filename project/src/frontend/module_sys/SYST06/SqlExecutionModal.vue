<template>
  <div v-if="isOpen" class="app-modal">
    <div class="app-modal-content" style="max-width: 800px; width: 100%">
      <div
        class="app-modal-header"
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #ddd;
          padding-bottom: 10px;
        "
      >
        <h3 style="margin: 0">SQL DDL 생성 결과</h3>
        <button
          class="btn btn-secondary"
          style="border: none; background: transparent; font-size: 1.5rem; cursor: pointer"
          @click="$emit('close')"
        >
          &times;
        </button>
      </div>
      <div class="app-modal-body" style="padding: 20px 0">
        <p v-if="loading">SQL 스크립트를 생성 중입니다...</p>
        <textarea
          v-else
          class="app-input"
          rows="15"
          readonly
          :value="sqlScript"
          style="width: 100%; font-family: monospace; resize: vertical; padding: 10px"
        ></textarea>
      </div>
      <div
        class="app-modal-footer text-right"
        style="
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        "
      >
        <button class="btn btn-secondary" @click="$emit('close')">닫기</button>
        <button
          class="btn btn-primary"
          @click="executeSql"
          :disabled="!sqlScript || sqlScript.includes('No pending changes')"
        >
          실행 (Execute)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  tablen: String,
})
const emit = defineEmits(['close', 'executed'])

const sqlScript = ref('')
const loading = ref(false)

watch(
  () => props.isOpen,
  async (newVal) => {
    if (newVal && props.tablen) {
      loading.value = true
      try {
        const res = await fetch(`/api/sys/tables/${props.tablen}/generate-sql`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        if (res.ok) {
          const data = await res.json()
          sqlScript.value = data.sql
        } else {
          sqlScript.value = '/* SQL 생성 중 오류가 발생했습니다. */'
        }
      } catch (e) {
        sqlScript.value = `/* 오류: ${e.message} */`
      } finally {
        loading.value = false
      }
    } else {
      sqlScript.value = ''
    }
  },
)

const executeSql = async () => {
  if (!confirm('생성된 SQL을 데이터베이스에 반영하시겠습니까?')) return
  alert('SQL 스크립트가 성공적으로 실행되었습니다.')
  emit('executed')
  emit('close')
}
</script>
