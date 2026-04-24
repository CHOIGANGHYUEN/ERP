export function useGameInteraction(getWorldInstance, gameCanvas, activeTool, isClickDrag, selectedEntityData) {
  const handleCanvasClick = (event) => {
    const worldInstance = getWorldInstance()
    if (!worldInstance || !gameCanvas.value || isClickDrag.value) return

    const rect = gameCanvas.value.getBoundingClientRect()
    const scaleX = gameCanvas.value.width / rect.width
    const scaleY = gameCanvas.value.height / rect.height
    const mouseX = (event.clientX - rect.left) * scaleX
    const mouseY = (event.clientY - rect.top) * scaleY

    const currentZoom = worldInstance.camera.zoom || 1
    const worldX = mouseX / currentZoom + worldInstance.camera.x
    const worldY = mouseY / currentZoom + worldInstance.camera.y

    // 💡 월드 경계(Bounds) 밖을 클릭한 경우 처리 취소 (Chunk 매니저의 Out of Bounds 에러 방어)
    if (worldX < 0 || worldX > (worldInstance.width || 3200) || worldY < 0 || worldY > (worldInstance.height || 3200)) {
      worldInstance.selectedEntity = null
      selectedEntityData.value = null
      return
    }

    // 도구가 선택된 상태면 소환/상호작용 진행
    if (activeTool.value) {

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
    const clickedEntity = worldInstance.getEntityAt(worldX, worldY)

    if (clickedEntity) {
      // 💡 [상태창 닫기] 이미 선택된 동일한 개체를 다시 클릭하면 선택 해제(닫기 토글)
      if (worldInstance.selectedEntity &&
        worldInstance.selectedEntity.id === clickedEntity.id &&
        worldInstance.selectedEntity._type === clickedEntity._type) {
        worldInstance.selectedEntity = null
        selectedEntityData.value = null
        return
      }

      worldInstance.selectedEntity = clickedEntity
      const data = worldInstance.getDataFromBuffer(clickedEntity._type, clickedEntity.id)
      selectedEntityData.value = data
      // 💡 [데이터 동기화] Worker에게 상세 정보(인벤토리, 할일 목록 등) 요청
      if (data && !data.isDead) {
        worldInstance.onProxyAction({
          type: data.isVillage ? 'GET_VILLAGE_DETAILS' : 'GET_ENTITY_DETAILS',
          payload: { id: clickedEntity.id, type: clickedEntity._type },
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
