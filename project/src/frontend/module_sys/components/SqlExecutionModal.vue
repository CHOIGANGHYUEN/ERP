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
          readonly
          style="font-family: monospace; font-size: 0.9rem; background-color: #f8f9fa"
          >{{ generatedSql }}</textarea
        >
        <div style="margin-top: 16px; text-align: right">
          <button class="btn btn-secondary" @click="$emit('close')">닫기</button>
          <button class="btn btn-primary" style="margin-left: 8px" @click="$emit('execute')">
            DB 적용(실행)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tableInfo: { type: Object, required: true },
  fields: { type: Array, required: true },
  indexes: { type: Array, required: true },
})

defineEmits(['close', 'execute'])

const generatedSql = computed(() => {
  if (!props.tableInfo.tablen) return '-- 테이블 정보가 부족합니다.'

  let sql = `CREATE TABLE ${props.tableInfo.tablen} (\n`

  const fieldDefs = props.fields.map((f) => {
    let def = `  ${f.name} ${f.type}`
    if (f.type === 'VARCHAR' && f.length) def += `(${f.length})`
    if (!f.isNull) def += ' NOT NULL'
    if (f.isPk) def += ' PRIMARY KEY'
    return def
  })

  sql += fieldDefs.join(',\n')
  sql += '\n);\n\n'

  const indexDefs = props.indexes.map((idx) => {
    let idxSql = `CREATE ${idx.isUnique ? 'UNIQUE ' : ''}INDEX ${idx.name} ON ${props.tableInfo.tablen} (${idx.fields});`
    return idxSql
  })

  sql += indexDefs.join('\n')

  return sql
})
</script>
