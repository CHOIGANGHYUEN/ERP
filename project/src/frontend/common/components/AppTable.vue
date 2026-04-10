<template>
  <table class="app-table">
    <thead>
      <tr>
        <th v-for="col in columns" :key="col.key || col">{{ col.label || col }}</th>
      </tr>
    </thead>
    <tbody>
      <tr 
        v-for="(row, rowIndex) in data" 
        :key="rowIndex"
        @click="$emit('row-click', row)"
        :style="{ cursor: $attrs['onRow-click'] || $attrs['onRowClick'] ? 'pointer' : 'default' }"
      >
        <td v-for="col in columns" :key="col.key || col">
          <slot :name="col.key || col" :row="row" :value="row[col.key || col]">{{
            row[col.key || col]
          }}</slot>
        </td>
      </tr>
      <tr v-if="!data || data.length === 0">
        <td :colspan="columns.length" style="text-align: center; padding: 24px">
          No data available
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
defineProps({
  columns: {
    type: Array,
    required: true,
  },
  data: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['row-click'])
</script>
