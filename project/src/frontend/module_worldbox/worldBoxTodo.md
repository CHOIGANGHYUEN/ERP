# 🚀 WorldBox 동물 모션 및 애니메이션 시스템 고도화 계획

ECS 아키텍처 환경에서 동물들의 상태별 디테일한 모션 렌더링을 구현하여 시뮬레이션의 생동감을 극대화합니다. 수학적 보간과 파티클 효과, 프레임 애니메이션을 결합한 고도화 작업입니다.

---

## 1단계: 애니메이션 메타데이터 및 Visual 컴포넌트 확장
- **목표**: 엔티티의 `Visual` 컴포넌트에 애니메이션 제어용 데이터를 추가하고 상태별 모션 메타데이터 정의.
- **파일 경로**: `src/frontend/module_worldbox/engine/components/render/Visual.js`
- **구현 상세**:
    1. **프레임 상태 관리**: `currentFrame`, `frameTimer`, `flipX` 속성을 추가하여 애니메이션의 진행 상태와 방향성 유지.
    2. **상태별 애니메이션 정의**: `animations` 객체를 내부에 선언하고 아래 상태별 메타데이터 구축.
        - `IDLE`, `WALK`, `EAT`, `SLEEP`: 루프 가능 프레임 데이터 및 속도(`speed`).
        - `RUN`, `FLEE`, `EVADE`: 고속 애니메이션 프레임 데이터.
        - `DIE`: `loop: false` 속성을 추가하여 마지막 프레임 유지 처리.

## 2단계: 모션 및 프레임 업데이트 시스템 로직 구현
- **목표**: 매 프레임 델타 타임(dt)을 계산하여 프레임을 전환하고 이동 방향에 따른 스프라이트 반전 처리.
- **파일 경로**: `src/frontend/module_worldbox/engine/systems/render/SpriteManager.js` [NEW]
- **구현 상세**:
    1. **`updateAnimations(entity, dt)` 구현**: 
        - `Transform` 컴포넌트의 속도(`vx`)를 체크하여 0보다 작으면 `visual.flipX = true`, 크면 `false`로 설정.
    2. **프레임 전환 로직**:
        - `visual.frameTimer`에 `dt`를 누적하고, `animations[mode].speed` 도달 시 `currentFrame` 증가.
        - `DIE` 상태와 같은 비루프 애니메이션의 경우 마지막 프레임에 고정되는 예외 로직 작성.

## 3단계: 상태별 디테일 모션 렌더링 고도화
- **목표**: Canvas Transform API를 활용하여 스케일, 회전, 투명도 등 물리 기반 모션 효과 부여.
- **파일 경로**: `src/frontend/module_worldbox/engine/objects/renders/AnimalRenders.js` [NEW]
- **구현 상세**:
    1. **`drawAnimalBody(ctx, entity, time)` 구현**:
        - `Transform` 위치로 `translate` 후 `flipX`에 따른 `scale(-1, 1)` 처리.
    2. **상태별 특수 효과 적용 (Switch문)**:
        - `SLEEP / IDLE`: `Math.sin(time)`을 활용한 Y축 스케일 보간으로 '숨쉬는 바운스' 모션 연출.
        - `RUN / FLEE / EVADE`: 진행 방향으로 약 10도 회전(`rotate`) 및 랜덤 확률로 `spawnDustParticle()` 호출.
        - `EAT`: `Math.sin` 기반으로 Y축 위치를 낮춰 '고개 끄덕임' 모션 구현.
        - `DIE`: `grayscale(100%)` 필터 적용 및 `alpha` 감소에 비례한 Y축 하강(땅으로 꺼지는 효과) 구현.
    3. **복구 로직**: `drawImage` 출력 후 `ctx.restore()`를 호출하여 캔버스 상태 초기화.

## 4단계: 시각적 피드백 계층 분리 및 최적화
- **목표**: 애니메이션과 동기화된 이펙트(Zzz, 먼지, 혈흔 등)를 별도 레이어로 분리하여 렌더링.
- **파일 경로**: `src/frontend/module_worldbox/engine/systems/render/ParticleSystem.js`
- **구현 상세**:
    1. **렌더링 순서 최적화**: 
        - 동물 본체 렌더링 직후 파티클 레이어가 오버레이되도록 렌더링 파이프라인(`EntityRenderer`) 내 호출 순서 조정.
    2. **Z-index/Depth 분리**: 복잡한 환경에서도 이펙트가 엔티티에 가려지지 않도록 최상단 레이어 렌더링 보장.