<template>
  <div>
    <AppPageTitle title="Dashboard" />

    <AppGrid>
      <div class="app-grid-item">
        <AppCard>
          <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--app-primary-color)">
            System Overview
          </h3>
          <p style="color: var(--app-secondary-color); margin-bottom: 24px">
            Welcome to the main dashboard of the ERP system.
          </p>
          <AppButton type="primary" @click="goToSettings">System Settings</AppButton>
        </AppCard>
      </div>

      <div class="app-grid-item">
        <AppCard>
          <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--app-primary-color)">
            Recent Activity
          </h3>
          <AppTable :columns="columns" :data="recentData" />
        </AppCard>
      </div>
    </AppGrid>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppPageTitle from '@/frontend/common/components/AppPageTitle.vue'
import AppCard from '@/frontend/common/components/AppCard.vue'
import AppGrid from '@/frontend/common/components/AppGrid.vue'
import AppButton from '@/frontend/common/components/AppButton.vue'
import AppTable from '@/frontend/common/components/AppTable.vue'

const router = useRouter()

const columns = [
  { key: 'date', label: 'Date' },
  { key: 'module', label: 'Module' },
  { key: 'action', label: 'Action' },
]

const recentData = ref([
  { date: '2026-04-07 10:00', module: 'SYS', action: 'User login' },
  { date: '2026-04-07 11:30', module: 'FI', action: 'Invoice created' },
  { date: '2026-04-07 14:15', module: 'HR', action: 'Employee profile updated' },
])

const goToSettings = () => {
  router.push('/sys')
}
</script>
