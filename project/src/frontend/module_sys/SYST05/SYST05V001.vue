<template>
  <div>
    <AppPageTitle title="시스템 설정 (System Settings)" />
    <AppCard style="margin-bottom: 16px">
      <div style="display: flex; gap: 8px; align-items: center">
        <AppInput
          v-model="searchQuery"
          placeholder="설정 ID 또는 명칭 검색"
          style="width: 300px"
          @keyup.enter="fetchConfigs"
        />
        <AppButton type="primary" @click="fetchConfigs">검색</AppButton>
        <AppButton type="secondary" @click="goToDetail('new')">신규 등록</AppButton>
      </div>
    </AppCard>

    <AppCard>
      <table class="app-tree-table">
        <thead>
          <tr>
            <th>설정명</th>
            <th>설정 ID</th>
            <th>설정값</th>
            <th>레벨</th>
            <th>순서</th>
            <th>사용 여부</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="config in visibleConfigs"
            :key="config.id"
            class="app-tree-row"
            style="cursor: pointer"
            @click="goToDetail(config.id)"
          >
            <td>
              <div class="tree-cell" :style="{ paddingLeft: `${config.depth * 24}px` }">
                <span
                  v-if="config.children && config.children.length > 0"
                  class="tree-toggle"
                  @click.stop="toggleNode(config)"
                >
                  {{ isExpanded(config) ? '▼' : '▶' }}
                </span>
                <span v-else class="tree-indent"></span>
                <span>{{ config.configNm }}</span>
              </div>
            </td>
            <td>{{ config.configId }}</td>
            <td>{{ config.configVal }}</td>
            <td>{{ config.configLevel }}</td>
            <td>{{ config.ordNum }}</td>
            <td>{{ config.useYn === 1 ? 'Y' : 'N' }}</td>
          </tr>
          <tr v-if="visibleConfigs.length === 0">
            <td colspan="6" style="text-align: center; padding: 24px">데이터가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import { getConfigs } from '../api/configApi.js'

const router = useRouter()
const configs = ref([])
const searchQuery = ref('')
const expandedNodes = ref(new Set())

const buildTree = (items) => {
  const tree = []
  const lookup = {}
  items.forEach((item) => {
    lookup[item.configId] = { ...item, children: [] }
  })
  items.forEach((item) => {
    if (item.parentConfigId && lookup[item.parentConfigId]) {
      lookup[item.parentConfigId].children.push(lookup[item.configId])
    } else {
      tree.push(lookup[item.configId])
    }
  })
  const sortTree = (nodes) => {
    nodes.sort((a, b) => (a.ordNum || 0) - (b.ordNum || 0))
    nodes.forEach((node) => {
      if (node.children.length > 0) sortTree(node.children)
    })
  }
  sortTree(tree)
  return tree
}

const flattenTree = (nodes, depth = 0) => {
  let result = []
  nodes.forEach((node) => {
    result.push({ ...node, depth })
    if (expandedNodes.value.has(node.id) && node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, depth + 1))
    }
  })
  return result
}

const visibleConfigs = computed(() => {
  const tree = buildTree(configs.value)
  return flattenTree(tree)
})

const toggleNode = (node) => {
  const newSet = new Set(expandedNodes.value)
  if (newSet.has(node.id)) {
    newSet.delete(node.id)
  } else {
    newSet.add(node.id)
  }
  expandedNodes.value = newSet
}

const isExpanded = (node) => {
  return expandedNodes.value.has(node.id)
}

const fetchConfigs = async () => {
  try {
    const data = await getConfigs({ search: searchQuery.value })
    configs.value = data.data || []

    if (configs.value.length > 0 && expandedNodes.value.size === 0) {
      const rootNodes = configs.value.filter((c) => !c.parentConfigId)
      const newSet = new Set()
      rootNodes.forEach((n) => newSet.add(n.id))
      expandedNodes.value = newSet
    }
  } catch (error) {
    console.error('Error fetching configs:', error)
    alert('조회 중 오류가 발생했습니다.')
  }
}

const goToDetail = (id) => {
  router.push(`/sys/syst05/${id}`)
}

onMounted(() => {
  fetchConfigs()
})
</script>
