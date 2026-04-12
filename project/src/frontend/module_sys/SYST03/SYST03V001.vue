<template>
  <div>
    <AppPageTitle title="메뉴 관리 (Menu Management)" />
    <AppCard style="margin-bottom: 16px">
      <div style="display: flex; gap: 8px; align-items: center">
        <AppInput
          v-model="searchQuery"
          placeholder="메뉴ID 또는 메뉴명 검색"
          style="width: 300px"
          @keyup.enter="fetchMenus"
        />
        <AppButton type="primary" @click="fetchMenus">검색</AppButton>
        <AppButton type="secondary" @click="goToCreate">신규 등록</AppButton>
      </div>
    </AppCard>

    <AppCard>
      <table class="app-tree-table">
        <thead>
          <tr>
            <th>메뉴명</th>
            <th>메뉴 ID</th>
            <th>레벨</th>
            <th>순서</th>
            <th>상위 메뉴 ID</th>
            <th>경로</th>
            <th>사용 여부</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="menu in visibleMenus"
            :key="menu.menuId"
            class="app-tree-row"
            style="cursor: pointer"
            @click="goToDetail(menu.menuId)"
          >
            <td>
              <div class="tree-cell" :style="{ paddingLeft: `${menu.depth * 24}px` }">
                <span
                  v-if="menu.children && menu.children.length > 0"
                  class="tree-toggle"
                  @click.stop="toggleNode(menu)"
                >
                  {{ isExpanded(menu) ? '▼' : '▶' }}
                </span>
                <span v-else class="tree-indent"></span>
                <span>{{ menu.menuNm }}</span>
              </div>
            </td>
            <td>{{ menu.menuId }}</td>
            <td>{{ menu.menuLevel }}</td>
            <td>{{ menu.ordNum }}</td>
            <td>{{ menu.parentMenuId }}</td>
            <td>{{ menu.path }}</td>
            <td>{{ menu.useYn === 1 ? 'Y' : 'N' }}</td>
          </tr>
          <tr v-if="visibleMenus.length === 0">
            <td colspan="7" style="text-align: center; padding: 24px">데이터가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </AppCard>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import { getMenus } from '../api/menuApi.js'

const router = useRouter()
const menus = ref([])
const searchQuery = ref('')
const expandedNodes = ref(new Set())

// Build tree from flat list
const buildTree = (items) => {
  const tree = []
  const lookup = {}

  // Initialize lookup
  items.forEach((item) => {
    lookup[item.menuId] = { ...item, children: [] }
  })

  // Build tree structure
  items.forEach((item) => {
    if (item.parentMenuId && item.parentMenuId.trim() !== '') {
      if (lookup[item.parentMenuId]) {
        lookup[item.parentMenuId].children.push(lookup[item.menuId])
      }
    } else {
      tree.push(lookup[item.menuId])
    }
  })

  // Sort children by ordNum
  const sortTree = (nodes) => {
    nodes.sort((a, b) => (a.ordNum || 0) - (b.ordNum || 0))
    nodes.forEach((node) => {
      if (node.children.length > 0) sortTree(node.children)
    })
  }
  sortTree(tree)

  return tree
}

// Flatten tree for table rendering
const flattenTree = (nodes, depth = 0) => {
  let result = []
  nodes.forEach((node) => {
    const flatNode = { ...node, depth }
    result.push(flatNode)
    if (expandedNodes.value.has(node.menuId) && node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, depth + 1))
    }
  })
  return result
}

// Automatically expand root nodes initially if we want, or handle dynamically
const visibleMenus = computed(() => {
  const tree = buildTree(menus.value)
  return flattenTree(tree)
})

const toggleNode = (node) => {
  const newSet = new Set(expandedNodes.value)
  if (newSet.has(node.menuId)) {
    newSet.delete(node.menuId)
  } else {
    newSet.add(node.menuId)
  }
  expandedNodes.value = newSet
}

const isExpanded = (node) => {
  return expandedNodes.value.has(node.menuId)
}

const fetchMenus = async () => {
  try {
    // For a tree view, we typically want to fetch all records (or a high limit)
    // because pagination breaks the tree hierarchy if children are on page 2
    const data = await getMenus({
      page: 1,
      limit: 1000,
      search: searchQuery.value,
    })
    menus.value = data.data

    // Auto-expand all root nodes on load
    if (menus.value.length > 0 && expandedNodes.value.size === 0) {
      const rootNodes = menus.value.filter((m) => !m.parentMenuId || m.parentMenuId.trim() === '')
      const newSet = new Set()
      rootNodes.forEach((n) => newSet.add(n.menuId))
      expandedNodes.value = newSet
    }
  } catch (error) {
    console.error('Error fetching menus:', error)
  }
}

const goToDetail = (id) => {
  router.push(`/sys/syst03/${id}`)
}

const goToCreate = () => {
  router.push(`/sys/syst03/new`)
}

onMounted(() => {
  fetchMenus()
})
</script>
