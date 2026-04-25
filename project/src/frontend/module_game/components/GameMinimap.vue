<template>
  <div style="display: flex; flex-direction: column; align-items: center">
    <h4
      style="
        align-self: flex-start;
        margin: 0 0 12px 0;
        color: var(--app-text-color);
        border-bottom: 1px solid var(--app-border-color);
        padding-bottom: 8px;
        width: 100%;
        font-size: 1.1rem;
      "
    >
      🗺️ 미니맵
    </h4>
    <div
      style="
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--app-border-color);
        line-height: 0;
      "
    >
      <canvas
        ref="minimapCanvas"
        width="256"
        height="144"
        style="
          display: block;
          width: 100%;
          height: auto;
          cursor: crosshair;
          image-rendering: pixelated;
        "
        @mousedown="handleMinimapMouseDown"
        @mousemove="handleMinimapMouseMove"
        @mouseup="handleMinimapMouseUp"
        @mouseleave="handleMinimapMouseUp"
      ></canvas>
    </div>
    <div
      style="
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--app-secondary-color);
        text-align: center;
      "
    >
      🔍 줌: {{ zoomLevel }}% &nbsp;|&nbsp; 🗺️ 맵 크기: {{ mapWidth }} x {{ mapHeight }}<br />
      <span style="color: #bbb; font-size: 0.8rem">※ 드래그 이동 / 마우스 휠 줌 / 클릭 소환</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { PROPS, STRIDE } from '../engine/core/SharedState.js'

const props = defineProps({
  world: Object,
  mapWidth: Number,
  mapHeight: Number,
  zoomLevel: Number,
  gameCanvas: Object,
})

const emit = defineEmits(['sync-camera'])
const minimapCanvas = ref(null)
let isMinimapDragging = false
let drawInterval = null

onMounted(() => {
  // 자체적으로 주기적 렌더링 루프 실행
  drawInterval = setInterval(drawMinimap, 200)
})

onBeforeUnmount(() => {
  if (drawInterval) clearInterval(drawInterval)
})

const drawMinimap = () => {
  if (!minimapCanvas.value || !props.world || props.mapWidth <= 0) return
  const ctx = minimapCanvas.value.getContext('2d')
  const w = minimapCanvas.value.width
  const h = minimapCanvas.value.height

  // 미니맵 안티앨리어싱 방지
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = '#a4b07e'
  ctx.fillRect(0, 0, w, h)

  const scaleX = w / props.mapWidth
  const scaleY = h / props.mapHeight

  const views = props.world.views
  if (!views || !views.globals) return

  // [Atomic Load] 메모리 가시성 보장을 위해 Atomics.load 사용
  const frontIndex = Atomics.load(views.globalsInt32, PROPS.GLOBALS.RENDER_BUFFER_INDEX)
  const currentSet = views.sets[frontIndex]
  if (!currentSet) return

  // [Bugfix] villageView가 존재하는지(초기화되었는지) 확인 후 순회
  const villageView = currentSet.villages
  if (villageView) {
    const villageCount = views.globals[PROPS.GLOBALS.VILLAGE_COUNT] || 0
    for (let i = 0; i < villageCount; i++) {
      const offset = i * STRIDE.VILLAGE
      if (villageView[offset + PROPS.VILLAGE.IS_ACTIVE] !== 1) continue
      const x = villageView[offset + PROPS.VILLAGE.X]
      const y = villageView[offset + PROPS.VILLAGE.Y]
      const radius = villageView[offset + PROPS.VILLAGE.RADIUS]
      const r = villageView[offset + PROPS.VILLAGE.R] * 255
      const g = villageView[offset + PROPS.VILLAGE.G] * 255
      const b = villageView[offset + PROPS.VILLAGE.B] * 255
      ctx.beginPath()
      ctx.arc(x * scaleX, y * scaleY, (radius || 40) * scaleX, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`
      ctx.fill()
    }
  }

  // [Bugfix] creatureView가 존재하는지 확인 후 순회
  ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'
  const creatureView = currentSet.creatures
  if (creatureView) {
    const creatureCount = views.globals[PROPS.GLOBALS.CREATURE_COUNT] || 0
    for (let i = 0; i < creatureCount; i++) {
      const offset = i * STRIDE.CREATURE
      if (creatureView[offset + PROPS.CREATURE.IS_ACTIVE] !== 1) continue
      ctx.fillRect(
        creatureView[offset + PROPS.CREATURE.X] * scaleX,
        creatureView[offset + PROPS.CREATURE.Y] * scaleY,
        1,
        1,
      )
    }
  }

  const zoom = props.world.camera.zoom || 1
  const camX = props.world.camera.x
  const camY = props.world.camera.y
  // 뷰포트 크기 동기화 방어 로직 추가
  const canvasWidth = props.gameCanvas ? props.gameCanvas.width : 1280
  const canvasHeight = props.gameCanvas ? props.gameCanvas.height : 720
  const viewW = canvasWidth / zoom
  const viewH = canvasHeight / zoom

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(camX * scaleX, camY * scaleY, viewW * scaleX, viewH * scaleY)
}

const moveCameraFromMinimap = (e) => {
  if (!minimapCanvas.value || !props.world) return
  const rect = minimapCanvas.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const worldX = mx * (props.mapWidth / rect.width)
  const worldY = my * (props.mapHeight / rect.height)

  const zoom = props.world.camera.zoom || 1
  const canvasWidth = props.gameCanvas ? props.gameCanvas.width : 1280
  const canvasHeight = props.gameCanvas ? props.gameCanvas.height : 720
  const viewW = canvasWidth / zoom
  const viewH = canvasHeight / zoom

  emit('sync-camera', {
    x: worldX - viewW / 2,
    y: worldY - viewH / 2
  })
}

const handleMinimapMouseDown = (e) => {
  isMinimapDragging = true
  moveCameraFromMinimap(e)
}
const handleMinimapMouseMove = (e) => {
  if (isMinimapDragging) moveCameraFromMinimap(e)
}
const handleMinimapMouseUp = () => {
  isMinimapDragging = false
}
</script>
