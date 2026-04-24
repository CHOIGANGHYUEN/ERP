/**
 * 지능형 상호작용(AI Interaction) 시각화 시스템
 * 개체 간의 대화(말풍선), 감정 이모지 등을 렌더링합니다.
 */
export class InteractionSystem {
  constructor() {
    this.bubbles = []
    this.entityMap = new Map() // [Optimization] 매 프레임 Map 생성을 피하기 위해 재사용
  }

  addBubble(entityId, entityType, text, duration = 2000) {
    // 같은 개체의 기존 말풍선 제거 (새로운 대화로 덮어쓰기)
    this.bubbles = this.bubbles.filter(
      (b) => !(b.entityId === entityId && b.entityType === entityType),
    )
    this.bubbles.push({ entityId, entityType, text, lifeTime: duration, maxLife: duration })
  }

  update(deltaTime, world) {
    if (world && world.spatialProxies) {
      this.entityMap.clear()
      // 💡 [렌더링 최적화] 매 프레임 수만 개의 문자열(`type_id`)을 생성하며 발생하는 GC 메모리 부하를 막기 위해 비트 연산 기반 정수 Key 사용
      const typeMap = {
        creature: 0,
        animal: 1,
        plant: 2,
        building: 3,
        tornado: 4,
        mine: 5,
        resource: 6,
        village: 7,
      }
      for (let i = 0; i < world.spatialProxies.length; i++) {
        const p = world.spatialProxies[i]
        const t = typeMap[p._type] || 0
        this.entityMap.set((t << 20) | p.id, p)
      }

      this.bubbles.forEach((b) => {
        // 동물과 크리처 구분 처리 포함 빠른 조회
        const tStr = b.entityType === 'animal' ? 'animal' : b.entityType
        const t = typeMap[tStr] || 0
        const proxy = this.entityMap.get((t << 20) | b.entityId)
        if (proxy) {
          b.x = proxy.x
          b.y = proxy.y
          b.size = proxy.size || 16
        }
      })
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].lifeTime -= deltaTime
      if (this.bubbles[i].lifeTime <= 0) {
        this.bubbles.splice(i, 1)
      }
    }
  }

  render(ctx, drawables, world) {
    // 1. 모든 개체 이름표 렌더링 (카메라 화면에 보이는 개체들)
    if (drawables && drawables.length > 0 && world && world.getDataFromBuffer) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.font = 'bold 10px "Pretendard", sans-serif'

      for (let i = 0; i < drawables.length; i++) {
        const ent = drawables[i]

        // 선택된 개체는 아래 상세 상태창에 이름이 표시되므로 기본 이름표는 숨김
        if (world.selectedEntity && world.selectedEntity.id === ent.id && world.selectedEntity._type === ent._type) continue

        if (ent._type === 'creature' || ent._type === 'animal' || ent._type === 'building') {
          const data = world.getDataFromBuffer(ent._type, ent.id)
          if (!data || data.isDead) continue

          let nameStr = ''
          let color = '#ffffff'

          if (ent._type === 'creature') {
            nameStr = `${data.familyName || ''}주민 ${data.id}`
            color = '#f1c40f'
          } else if (ent._type === 'animal') {
            nameStr = `야생동물 (${data.species || '?'})`
            color = '#e67e22'
          } else if (ent._type === 'building') {
            const bType = data.type || '건물'
            if (!data.isConstructed) {
              nameStr = `🚧 건설 중 (${bType})`
              color = '#bdc3c7'
            } else {
              nameStr = `${bType} Lv.${data.tier || 1}`
              color = '#3498db'
            }
          }

          const px = ent.x
          const py = ent.y - (ent.size || 16) - 4

          // 가독성을 위한 검은색 외곽선
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.lineWidth = 2
          ctx.strokeText(nameStr, px, py)

          // 텍스트 채우기
          ctx.fillStyle = color
          ctx.fillText(nameStr, px, py)
        }
      }
      ctx.restore()
    }

    // 2. 대화 말풍선 렌더링
    if (this.bubbles.length > 0) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.font = 'bold 12px "Pretendard", sans-serif'

      this.bubbles.forEach((b) => {
        if (b.x === undefined || b.y === undefined || Number.isNaN(b.x) || Number.isNaN(b.y)) return

        const alpha = Math.min(1, b.lifeTime / 300) // 마지막 300ms 동안 서서히 페이드아웃
        ctx.globalAlpha = alpha

        const textWidth = ctx.measureText(b.text).width
        const paddingX = 8
        const paddingY = 6
        const boxWidth = textWidth + paddingX * 2
        const boxHeight = 22
        const x = b.x
        const y = b.y - b.size - 8

        // 말풍선 배경
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(x - boxWidth / 2, y - boxHeight, boxWidth, boxHeight, 8)
        ctx.fill()
        ctx.stroke()

        // 말풍선 꼬리
        ctx.beginPath()
        ctx.moveTo(x - 5, y)
        ctx.lineTo(x + 5, y)
        ctx.lineTo(x, y + 5)
        ctx.fill()

        // 텍스트 그리기
        ctx.fillStyle = '#2c3e50'
        ctx.fillText(b.text, x, y - paddingY)
      })
      ctx.restore()
    }

    // 💡 선택된 개체(selectedEntity) 상세 상태창 오버레이 렌더링
    if (world && world.selectedEntity) {
      const ent = world.selectedEntity
      // Main Thread 전용 버퍼 데이터 읽기
      const data = world.getDataFromBuffer ? world.getDataFromBuffer(ent._type, ent.id) : null

      if (data && !data.isDead) {
        const px = data.x
        const py = data.y - (data.size || 16) - 40 // 개체 머리 위 일정 간격 위로 띄움

        ctx.save()
        // 상태창 배경 패널
        ctx.fillStyle = 'rgba(20, 25, 30, 0.85)'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 1

        const boxW = 150
        let boxH = 76

        let tasks = []
        let inv = {}
        let invKeys = []

        if (ent._type === 'creature') {
          tasks = ent.taskQueue || data.taskQueue || []
          if (tasks.length === 0 && data.currentTask) tasks.push(data.currentTask)
          inv = ent.inventory || data.inventory || {}
          invKeys = Object.keys(inv).filter((k) => inv[k] > 0)

          boxH = 116 + 16 + (Math.max(1, tasks.length) * 14) + 2 + 16 + 14
        }
        else if (ent._type === 'animal') boxH = 86
        else if (ent._type === 'building') boxH = 92

        // 팝업 창 그리기
        ctx.beginPath()
        ctx.roundRect(px - boxW / 2, py - boxH, boxW, boxH, 8)
        ctx.fill()
        ctx.stroke()

        // 말풍선 꼬리표 (지시선)
        ctx.beginPath()
        ctx.moveTo(px - 5, py)
        ctx.lineTo(px + 5, py)
        ctx.lineTo(px, py + 5)
        ctx.fillStyle = 'rgba(20, 25, 30, 0.85)'
        ctx.fill()

        // 텍스트 설정
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        let textY = py - boxH + 10
        const textX = px - boxW / 2 + 12

        // 우상단 X 표시 (클릭 시 닫힘 유도 데코레이션)
        ctx.fillStyle = '#95a5a6'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText('✖', px + boxW / 2 - 8, textY)
        ctx.textAlign = 'left'

        if (ent._type === 'creature') {
          ctx.font = 'bold 12px "Pretendard", sans-serif'
          ctx.fillStyle = '#f1c40f'
          ctx.fillText(`${data.familyName || ''}주민 ${data.id}`, textX, textY)
          textY += 18

          ctx.font = '11px "Pretendard", sans-serif'
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText(`직업: ${data.profession || '무직'} / Lv.${data.level || 1}`, textX, textY)
          textY += 14
          ctx.fillText(`상태: ${data.state || '대기'}`, textX, textY)
          textY += 16

          // 목표(타겟) 표기
          let targetName = '없음'
          const targetObj = ent.target || data.target
          const taskId = data.currentTask?.targetId
          const taskType = data.currentTask?.targetType
          const typeNames = { creature: '주민', animal: '동물', resource: '자원', building: '건물', plant: '식물', mine: '광맥', village: '마을' }

          if (targetObj) {
            const tType = targetObj._type || targetObj.type || '개체'
            targetName = `${typeNames[tType] || tType} ${targetObj.id !== undefined ? targetObj.id : ''}`
          } else if (data.targetId !== undefined && data.targetId !== null && data.targetId !== -1) {
            const tType = data.targetType || '개체'
            targetName = `${typeNames[tType] || tType} ${data.targetId}`
          } else if (taskId !== undefined) {
            targetName = `${typeNames[taskType] || taskType || '개체'} ${taskId}`
          }
          ctx.fillText(`목표: ${targetName}`, textX, textY)
          textY += 16

          // 허기 게이지 렌더링
          ctx.fillText('허기:', textX, textY)
          ctx.fillStyle = 'rgba(231, 76, 60, 0.3)'
          ctx.fillRect(textX + 30, textY + 2, 70, 6)
          ctx.fillStyle = '#e74c3c'
          ctx.fillRect(textX + 30, textY + 2, 70 * (Math.min(100, data.needs?.hunger || 0) / 100), 6)
          textY += 12

          // 피로 게이지 렌더링
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText('피로:', textX, textY)
          ctx.fillStyle = 'rgba(52, 152, 219, 0.3)'
          ctx.fillRect(textX + 30, textY + 2, 70, 6)
          ctx.fillStyle = '#3498db'
          ctx.fillRect(textX + 30, textY + 2, 70 * (Math.min(100, data.needs?.fatigue || 0) / 100), 6)
          textY += 16

          // 💡 할일 목록(Task Queue) 렌더링
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText('[할일 목록]', textX, textY)
          textY += 14
          if (tasks.length === 0) {
            ctx.fillStyle = '#7f8c8d'
            ctx.fillText('- 대기 중', textX + 5, textY)
            textY += 14
          } else {
            tasks.forEach((t, idx) => {
              const tName = t.type || t.name || '작업'
              ctx.fillStyle = idx === 0 ? '#2ecc71' : '#bdc3c7'
              ctx.fillText(`- ${tName} ${t.targetId !== undefined ? '(' + t.targetId + ')' : ''}`, textX + 5, textY)
              textY += 14
            })
          }

          // 💡 소지품(Inventory) 렌더링
          textY += 2
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText('[소지품]', textX, textY)
          textY += 14
          if (invKeys.length === 0) {
            ctx.fillStyle = '#7f8c8d'
            ctx.fillText('- 비어있음', textX + 5, textY)
          } else {
            ctx.fillStyle = '#f1c40f'
            const resourceNames = { wood: '나무', food: '식량', stone: '돌', gold: '금', iron: '철', meat: '고기', coal: '석탄', diamond: '다이아' }
            const invStr = invKeys.map(k => `${resourceNames[k] || k} ${inv[k]}`).join(', ')
            const shortInv = invStr.length > 21 ? invStr.substring(0, 19) + '...' : invStr
            ctx.fillText(shortInv, textX + 5, textY)
          }

        } else if (ent._type === 'animal') {
          ctx.font = 'bold 12px "Pretendard", sans-serif'
          ctx.fillStyle = '#e67e22'
          ctx.fillText(`야생동물 (${data.species || '?'})`, textX, textY)
          textY += 18

          ctx.font = '11px "Pretendard", sans-serif'
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText(`상태: ${data.state || '배회'}`, textX, textY)
          textY += 16

          // 목표(타겟) 표기
          let targetName = '없음'
          const targetObj = ent.target || data.target
          const typeNames = { creature: '주민', animal: '동물', resource: '자원', building: '건물', plant: '식물', mine: '광맥', village: '마을' }

          if (targetObj) {
            const tType = targetObj._type || targetObj.type || '개체'
            targetName = `${typeNames[tType] || tType} ${targetObj.id !== undefined ? targetObj.id : ''}`
          } else if (data.targetId !== undefined && data.targetId !== null && data.targetId !== -1) {
            const tType = data.targetType || '개체'
            targetName = `${typeNames[tType] || tType} ${data.targetId}`
          }
          ctx.fillText(`목표: ${targetName}`, textX, textY)
          textY += 16

          // 생명력 게이지 렌더링
          ctx.fillText('생명:', textX, textY)
          ctx.fillStyle = 'rgba(46, 204, 113, 0.3)'
          ctx.fillRect(textX + 30, textY + 2, 70, 6)
          ctx.fillStyle = '#2ecc71'
          ctx.fillRect(textX + 30, textY + 2, 70 * (Math.max(0, Math.min(100, data.energy || 0)) / 100), 6)
        } else if (ent._type === 'building') {
          ctx.font = 'bold 12px "Pretendard", sans-serif'
          ctx.fillStyle = '#3498db'
          ctx.fillText(`건물 (${data.type || '알 수 없음'})`, textX, textY)
          textY += 18

          ctx.font = '11px "Pretendard", sans-serif'
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText(`상태: ${data.isConstructed ? '완공됨' : '건설 중'}`, textX, textY)
          textY += 16
          ctx.fillText(`등급: Lv.${data.tier || 1}`, textX, textY)
          textY += 16
          if (data.capacity) {
            ctx.fillText(`수용 인원: ${data.occupants || 0} / ${data.capacity}`, textX, textY)
          }
        } else {
          ctx.font = 'bold 12px "Pretendard", sans-serif'
          ctx.fillStyle = '#2ecc71'
          ctx.fillText(`${(ent._type || 'Entity').toUpperCase()} ${data.id || ''}`, textX, textY)
          textY += 18

          ctx.font = '11px "Pretendard", sans-serif'
          ctx.fillStyle = '#ecf0f1'
          ctx.fillText(`종류: ${data.type || '알 수 없음'}`, textX, textY)
        }

        ctx.restore()
      }
    }
  }
}
