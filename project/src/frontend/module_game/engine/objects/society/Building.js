import { Entity } from '../../core/Entity.js'
import { RenderUtils } from '../../utils/RenderUtils.js'

export class Building extends Entity {
  init(x, y, type) {
    super.init(x, y)
    this.type = type // 'HOUSE', 'SCHOOL', 'FARM', 'BARRACKS', 'TEMPLE', 'SMITHY'
    this.tier = 1 // 현재 티어
    this.maxTier = ['HOUSE', 'FARM'].includes(type) ? 3 : 2

    const typeProps = {
      HOUSE: { size: 24, color: '#e74c3c', maxProgress: 100 },
      SCHOOL: { size: 32, color: '#3498db', maxProgress: 200 },
      FARM: { size: 36, color: '#27ae60', maxProgress: 120 },
      BARRACKS: { size: 32, color: '#7f8c8d', maxProgress: 250 },
      TEMPLE: { size: 40, color: '#f1c40f', maxProgress: 400 },
      SMITHY: { size: 28, color: '#34495e', maxProgress: 150 },
    }

    this.size = typeProps[type]?.size || 24
    this.color = typeProps[type]?.color || '#e74c3c'
    this.maxProgress = typeProps[type]?.maxProgress || 100
    this.isConstructed = false
    this.progress = 0
    this.upgradeTimer = 0
    this.effectTimer = 0
  }

  update(deltaTime, _world) {
    // 완성된 건물 효과 (알고리즘 기반 마을 발전)
    if (this.isConstructed) {
      this.effectTimer += deltaTime
      if (this.effectTimer >= 2000) {
        this.effectTimer = 0
        if (this.village && this.village.inventory) {
          if (this.type === 'SCHOOL') {
            this.village.inventory.knowledge =
              (this.village.inventory.knowledge || 0) + this.tier * 2
          } else if (this.type === 'FARM') {
            this.village.inventory.food = (this.village.inventory.food || 0) + this.tier * 3
          } else if (this.type === 'SMITHY') {
            if (this.village.inventory.iron >= 1) {
              this.village.inventory.iron -= 1
              this.village.inventory.knowledge += 1 // 철을 소모하여 기술/무기 지식 증대
            }
          }
        }
      }

      // 티어 자동 업그레이드 조건 체크 (5초마다 연산 분산)
      if (this.village && this.tier < this.maxTier) {
        this.upgradeTimer += deltaTime
        if (this.upgradeTimer >= 5000) {
          this.upgradeTimer = 0
          this.tryUpgrade()
        }
      }
    }
  }

  tryUpgrade() {
    const inv = this.village.inventory
    if (this.type === 'HOUSE' && this.tier === 1) {
      if ((inv.wood || 0) >= 50 && (inv.biomass || 0) >= 20) {
        inv.wood -= 50
        inv.biomass -= 20
        this.startUpgrade(2, '#c0392b', 28) // 2티어: 견고한 목조 주택
      }
    } else if (this.type === 'HOUSE' && this.tier === 2) {
      if ((inv.wood || 0) >= 80 && (inv.stone || 0) >= 30) {
        inv.wood -= 80
        inv.stone -= 30
        this.startUpgrade(3, '#8e44ad', 32) // 3티어: 고급 석조 주택
      }
    } else if (this.type === 'FARM' && this.tier === 1) {
      if ((inv.wood || 0) >= 60 && (inv.stone || 0) >= 20) {
        inv.wood -= 60
        inv.stone -= 20
        this.startUpgrade(2, '#2ecc71', 40) // 2티어: 대형 농장
      }
    } else if (this.type === 'SCHOOL' && this.tier === 1) {
      if ((inv.wood || 0) >= 100 && (inv.knowledge || 0) >= 50) {
        inv.wood -= 100
        inv.knowledge -= 50
        this.startUpgrade(2, '#2980b9', 40) // 2티어: 대학교 (지식 생성 가속)
      }
    }
  }

  startUpgrade(newTier, newColor, newSize) {
    this.tier = newTier
    this.color = newColor
    this.size = newSize
    // 재건축 모드로 진입 (건축가가 다시 지어야 완료됨)
    this.isConstructed = false
    this.progress = 0
    this.maxProgress *= 1.5 // 다음 티어는 건설 시간이 1.5배 더 오래 걸림
  }

  render(ctx) {
    // 그림자
    RenderUtils.drawShadow(ctx, this.x, this.y - 4, this.size, 8)

    if (!this.isConstructed) {
      // 공사 중
      ctx.fillStyle = '#95a5a6'
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
      RenderUtils.drawBar(
        ctx,
        this.x,
        this.y - this.size / 2 - 4,
        this.size,
        4,
        this.progress / this.maxProgress,
        '#95a5a6',
        '#f1c40f',
      )
    } else {
      // 몸체
      ctx.fillStyle = this.color
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)

      // 지붕
      ctx.fillStyle = '#2c3e50'
      ctx.beginPath()
      ctx.moveTo(this.x - this.size / 2 - 4, this.y - this.size / 2)
      ctx.lineTo(this.x + this.size / 2 + 4, this.y - this.size / 2)
      ctx.lineTo(this.x, this.y - this.size)
      ctx.fill()

      // 창문/문
      ctx.fillStyle = '#f1c40f' // 불켜진 창문
      ctx.fillRect(this.x - this.size / 4, this.y - this.size / 4, this.size / 2, this.size / 2)

      const iconMap = {
        HOUSE: '🏠',
        SCHOOL: '🏫',
        FARM: '🌾',
        BARRACKS: '⛺',
        TEMPLE: '⛪',
        SMITHY: '⚒️',
      }

      // 아이콘
      ctx.fillStyle = '#fff'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${iconMap[this.type] || '🏗️'} Lv.${this.tier}`, this.x, this.y - this.size - 4)
    }
  }
}
