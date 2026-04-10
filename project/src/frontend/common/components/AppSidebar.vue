<template>
  <aside class="app-sidebar">
    <nav>
      <ul class="menu-list">
        <li
          v-for="menu in menuTree"
          :key="menu.menuId"
          @mouseenter="menu.isHovered = true"
          @mouseleave="menu.isHovered = false"
        >
          <div class="menu-item" :class="{ active: isActive(menu.path) }" @click="toggleMenu(menu)">
            <router-link v-if="menu.path" :to="menu.path" class="menu-link">
              {{ menu.menuNm }}
            </router-link>
            <span v-else class="menu-label">
              {{ menu.menuNm }}
              <span class="toggle-icon">{{ menu.isOpen || menu.isHovered ? '▼' : '▶' }}</span>
            </span>
          </div>

          <ul
            v-show="(menu.isOpen || menu.isHovered) && menu.children && menu.children.length > 0"
            class="submenu-list"
          >
            <li
              v-for="child in menu.children"
              :key="child.menuId"
              @mouseenter="child.isHovered = true"
              @mouseleave="child.isHovered = false"
            >
              <div
                class="menu-item child-item"
                :class="{ active: isActive(child.path) }"
                @click.stop="toggleMenu(child)"
              >
                <router-link v-if="child.path" :to="child.path" class="menu-link">
                  {{ child.menuNm }}
                </router-link>
                <span v-else class="menu-label">
                  {{ child.menuNm }}
                  <span class="toggle-icon">{{ child.isOpen || child.isHovered ? '▼' : '▶' }}</span>
                </span>
              </div>

              <ul
                v-show="
                  (child.isOpen || child.isHovered) && child.children && child.children.length > 0
                "
                class="submenu-list"
              >
                <li
                  v-for="grandchild in child.children"
                  :key="grandchild.menuId"
                  @mouseenter="grandchild.isHovered = true"
                  @mouseleave="grandchild.isHovered = false"
                >
                  <div
                    class="menu-item grandchild-item"
                    :class="{ active: isActive(grandchild.path) }"
                  >
                    <router-link v-if="grandchild.path" :to="grandchild.path" class="menu-link">
                      {{ grandchild.menuNm }}
                    </router-link>
                    <span v-else class="menu-label">
                      {{ grandchild.menuNm }}
                    </span>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const flatMenus = ref([])
const menuTree = ref([])

const isActive = (path) => {
  if (!path) return false
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const buildTree = (menus) => {
  const tree = []
  const map = {}

  menus.forEach((menu) => {
    map[menu.menuId] = { ...menu, children: [], isOpen: false, isHovered: false }
  })

  menus.forEach((menu) => {
    if (menu.parentMenuId && menu.parentMenuId.trim() !== '' && map[menu.parentMenuId]) {
      map[menu.parentMenuId].children.push(map[menu.menuId])
    } else {
      tree.push(map[menu.menuId])
    }
  })

  // Sort children by ordNum
  const sortChildren = (nodes) => {
    nodes.sort((a, b) => a.ordNum - b.ordNum)
    nodes.forEach((node) => {
      if (node.children.length > 0) {
        sortChildren(node.children)
      }
    })
  }
  sortChildren(tree)

  // Automatically open menus based on current route
  const openActiveMenus = (nodes) => {
    let hasActiveChild = false
    nodes.forEach((node) => {
      let isChildActive = false
      if (node.children && node.children.length > 0) {
        isChildActive = openActiveMenus(node.children)
      }
      if (isActive(node.path) || isChildActive) {
        node.isOpen = true
        hasActiveChild = true
      }
    })
    return hasActiveChild
  }
  openActiveMenus(tree)

  return tree
}

const toggleMenu = (menu) => {
  if (menu.children && menu.children.length > 0) {
    menu.isOpen = !menu.isOpen
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/sys/menus/usermenus')
    if (response.ok) {
      flatMenus.value = await response.json()
      menuTree.value = buildTree(flatMenus.value)
    } else {
      console.error('Failed to fetch menus')
    }
  } catch (error) {
    console.error('Error fetching menus', error)
  }
})

watch(
  () => route.path,
  () => {
    if (flatMenus.value.length > 0) {
      menuTree.value = buildTree(flatMenus.value)
    }
  },
)
</script>

<style scoped>
.app-sidebar {
  overflow-y: auto;
  user-select: none;
}

.menu-list,
.submenu-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.submenu-list {
  background-color: rgba(0, 0, 0, 0.02);
}

.menu-item {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-link,
.menu-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  color: var(--app-text-color);
  text-decoration: none;
  font-size: 14px;
}

.menu-item:hover > .menu-link,
.menu-item:hover > .menu-label {
  background-color: var(--app-bg-color);
  color: var(--app-primary-color);
}

.menu-item.active > .menu-link,
.menu-item.active > .menu-label {
  font-weight: bold;
  background-color: var(--app-bg-color);
  color: var(--app-primary-color);
  border-right: 3px solid var(--app-primary-color);
}

.child-item > .menu-link,
.child-item > .menu-label {
  padding-left: 32px;
  font-size: 13.5px;
}

.grandchild-item > .menu-link,
.grandchild-item > .menu-label {
  padding-left: 48px;
  font-size: 13px;
}

.toggle-icon {
  font-size: 10px;
  color: #aaa;
  transition: transform 0.2s ease;
}
</style>
