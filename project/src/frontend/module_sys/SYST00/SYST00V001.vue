<template>
  <div class="app-container">
    <div class="app-page-title">시스템 대시보드 (SYST00)</div>
    <div class="app-grid">
      <div class="app-grid-item app-card">
        <h3>시스템 상태</h3>
        <p style="margin-top: 10px; color: var(--app-primary-color); font-weight: bold">
          정상 작동 중
        </p>
      </div>
      <div class="app-grid-item app-card">
        <h3>최근 활동</h3>
        <ul style="margin-top: 10px; padding-left: 20px">
          <li>테이블 명세서 관리 화면 업데이트</li>
          <li>권한 관리 권한 변경</li>
          <li>신규 사용자 등록</li>
        </ul>
      </div>
      <div class="app-grid-item app-card">
        <h3>접속 통계</h3>
        <p style="margin-top: 10px">오늘 접속자: 15명</p>
        <p>현재 접속자: 3명</p>
      </div>
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
h3 {
  font-size: 1.2rem;
  border-bottom: 1px solid var(--app-border-color);
  padding-bottom: 8px;
}
</style>
