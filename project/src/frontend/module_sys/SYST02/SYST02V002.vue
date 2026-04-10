<template>
  <div>
    <AppPageTitle :title="isNew ? '권한 등록 (Create Role)' : '권한 상세 (Role Details)'" />
    
    <AppCard style="margin-bottom: 16px">
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px">
        <AppButton type="secondary" @click="goBack">목록</AppButton>
        <AppButton type="primary" @click="saveData">저장</AppButton>
        <AppButton v-if="!isNew" style="background-color: #dc3545; color: white; border: none;" @click="deleteData">삭제</AppButton>
      </div>

      <div class="app-grid">
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">권한 ID *</label>
          <AppInput v-model="roleData.roleId" :disabled="!isNew" placeholder="ROLE_ADMIN" />
        </div>
        <div class="app-grid-item">
          <label style="display: block; margin-bottom: 4px">사용 여부</label>
          <select v-model="roleData.useYn" class="app-input">
            <option :value="1">Y</option>
            <option :value="0">N</option>
          </select>
        </div>
        <div class="app-grid-item" style="min-width: 100%">
          <label style="display: block; margin-bottom: 4px">설명</label>
          <AppInput v-model="roleData.description" placeholder="권한 설명" />
        </div>
      </div>
    </AppCard>

    <!-- Role Menus & Users Tabs (Only show if not new) -->
    <AppCard v-if="!isNew">
      <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--app-border-color); margin-bottom: 16px;">
        <div 
          @click="activeTab = 'menus'"
          :style="{ padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'menus' ? '2px solid var(--app-primary-color)' : 'none', fontWeight: activeTab === 'menus' ? 'bold' : 'normal' }"
        >
          메뉴 권한 (Role Menus)
        </div>
        <div 
          @click="activeTab = 'users'"
          :style="{ padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'users' ? '2px solid var(--app-primary-color)' : 'none', fontWeight: activeTab === 'users' ? 'bold' : 'normal' }"
        >
          사용자 할당 (Role Users)
        </div>
      </div>

      <!-- Menus Tab -->
      <div v-if="activeTab === 'menus'">
        <div style="margin-bottom: 8px;">
          <label>권한에 포함할 메뉴를 선택하세요.</label>
        </div>
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--app-border-color); padding: 8px; border-radius: 4px;">
          <div v-for="menu in allMenus" :key="menu.menuId" style="display: flex; align-items: center; padding: 4px; border-bottom: 1px solid #eee;">
            <input 
              type="checkbox" 
              :id="'menu-' + menu.menuId" 
              :value="menu.menuId" 
              v-model="selectedMenus"
              style="margin-right: 8px;"
            >
            <label :for="'menu-' + menu.menuId" style="cursor: pointer; width: 100%;">
              {{ menu.menuNm }} ({{ menu.menuId }}) - Level: {{ menu.menuLevel }}
            </label>
          </div>
          <div v-if="allMenus.length === 0" style="padding: 16px; text-align: center;">
            메뉴 데이터가 없습니다.
          </div>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'">
        <div style="margin-bottom: 16px; display: flex; gap: 8px;">
          <AppInput v-model="newUserId" placeholder="추가할 사용자 ID 입력 (예: admin@test.com)" @keyup.enter="addUser" />
          <AppButton type="secondary" @click="addUser">추가</AppButton>
        </div>
        
        <table class="app-table">
          <thead>
            <tr>
              <th>사용자 ID</th>
              <th style="width: 80px; text-align: center;">액션</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in assignedUsers" :key="user">
              <td>{{ user }}</td>
              <td style="text-align: center;">
                <button @click="removeUser(user)" style="background: none; border: none; color: #dc3545; cursor: pointer; text-decoration: underline;">삭제</button>
              </td>
            </tr>
            <tr v-if="assignedUsers.length === 0">
              <td colspan="2" style="text-align: center;">할당된 사용자가 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRoleDetail, saveRole, updateRole, deleteRole, getRoleMenus, updateRoleMenus, getRoleUsers, updateRoleUsers } from '@/frontend/module_sys/api/roleApi.js'
import { getMenus } from '@/frontend/module_sys/api/menuApi.js'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppInput from '@/frontend/common/components/AppInput.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.params.id === 'new')

const roleData = ref({
  roleId: '',
  description: '',
  useYn: 1
})

const activeTab = ref('menus')

// Menus State
const allMenus = ref([])
const selectedMenus = ref([])

// Users State
const assignedUsers = ref([])
const newUserId = ref('')

const fetchRoleDetails = async () => {
  if (isNew.value) return
  
  try {
    const data = await getRoleDetail(route.params.id)
    roleData.value = {
      roleId: data.roleId,
      description: data.description,
      useYn: data.useYn
    }

    // Fetch mappings
    const menus = await getRoleMenus(route.params.id)
    selectedMenus.value = menus
    
    const users = await getRoleUsers(route.params.id)
    assignedUsers.value = users
    
  } catch (error) {
    console.error('Error fetching role details:', error)
    alert('데이터를 불러오는데 실패했습니다.')
  }
}

const fetchAllMenus = async () => {
  try {
    const response = await getMenus({ page: 1, limit: 1000 })
    allMenus.value = response.data
  } catch (error) {
    console.error('Error fetching all menus:', error)
  }
}

const addUser = () => {
  const uid = newUserId.value.trim()
  if (uid && !assignedUsers.value.includes(uid)) {
    assignedUsers.value.push(uid)
  }
  newUserId.value = ''
}

const removeUser = (uid) => {
  assignedUsers.value = assignedUsers.value.filter(u => u !== uid)
}

const saveData = async () => {
  if (!roleData.value.roleId) {
    alert('권한 ID를 입력하세요.')
    return
  }

  try {
    if (isNew.value) {
      await saveRole(roleData.value)
      alert('저장되었습니다.')
      router.push(`/sys/roles/${roleData.value.roleId}`)
    } else {
      await updateRole(roleData.value.roleId, roleData.value)
      
      // Update mappings
      await updateRoleMenus(roleData.value.roleId, selectedMenus.value)
      await updateRoleUsers(roleData.value.roleId, assignedUsers.value)
      
      alert('수정되었습니다.')
    }
  } catch (error) {
    console.error('Error saving role:', error)
    alert('저장에 실패했습니다.')
  }
}

const deleteData = async () => {
  if (confirm('이 권한을 정말 삭제하시겠습니까? 관련된 메뉴 및 사용자 할당도 함께 삭제됩니다.')) {
    try {
      await deleteRole(roleData.value.roleId)
      alert('삭제되었습니다.')
      goBack()
    } catch (error) {
      console.error('Error deleting role:', error)
      alert('삭제에 실패했습니다.')
    }
  }
}

const goBack = () => {
  router.push('/sys/roles')
}

onMounted(() => {
  if (!isNew.value) {
    fetchAllMenus()
  }
  fetchRoleDetails()
})
</script>
