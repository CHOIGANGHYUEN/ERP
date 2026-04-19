export function useGameInteraction(getWorldInstance, gameCanvas, activeTool, isClickDrag, selectedEntityData) {
  const handleCanvasClick = (event) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance || !gameCanvas.value || isClickDrag.value) return

    const rect = gameCanvas.value.getBoundingClientRect()
    const scaleX = gameCanvas.value.width / rect.width
    const scaleY = gameCanvas.value.height / rect.height
    const mouseX = (event.clientX - rect.left) * scaleX
    const mouseY = (event.clientY - rect.top) * scaleY

    // 도구가 선택된 상태면 소환/상호작용 진행
    if (activeTool.value) {
      const currentZoom = worldInstance.camera.zoom || 1
      const worldX = mouseX / currentZoom + worldInstance.camera.x
      const worldY = mouseY / currentZoom + worldInstance.camera.y

      switch (activeTool.value) {
        case 'human':
          worldInstance.spawnCreature(worldX, worldY)
          break
        case 'herbivore':
          worldInstance.spawnAnimal(worldX, worldY, 'HERBIVORE')
          break
        case 'carnivore':
          worldInstance.spawnAnimal(worldX, worldY, 'CARNIVORE')
          break
        case 'tree':
          worldInstance.spawnPlant(worldX, worldY, 'tree')
          break
        case 'crop':
          worldInstance.spawnPlant(worldX, worldY, 'crop')
          break
        case 'fence':
          worldInstance.spawnBuilding(worldX, worldY, 'FENCE', null)
          break
        case 'fence_gate':
          worldInstance.spawnBuilding(worldX, worldY, 'FENCE_GATE', null)
          break
        case 'fence_lock':
          if (worldInstance.buildings) {
             const clickedGate = worldInstance.buildings.find(b => b.type === 'FENCE_GATE' && Math.sqrt(Math.pow(b.x - worldX, 2) + Math.pow(b.y - worldY, 2)) < b.size)
             if (clickedGate) clickedGate.isLocked = !clickedGate.isLocked
          }
          break
        case 'tornado':
          worldInstance.spawnTornado(worldX, worldY)
          break
      }
      return // 소환 수행 후 종료
    }

    // 빈 손일 경우 객체 클릭 검사
    const clickedEntity = worldInstance.getEntityAt(mouseX, mouseY)

    if (clickedEntity) {
      worldInstance.selectedEntity = clickedEntity
      const data = worldInstance.getDataFromBuffer(clickedEntity._type, clickedEntity.id)
      selectedEntityData.value = data
      if (data && data.isVillage) {
        worldInstance.onProxyAction({
          type: 'GET_VILLAGE_DETAILS',
          payload: { id: clickedEntity.id },
        })
      }
    } else {
      // 빈 공간 클릭하면 해제
      worldInstance.selectedEntity = null
      selectedEntityData.value = null
    }
  }

  return { handleCanvasClick }
}
