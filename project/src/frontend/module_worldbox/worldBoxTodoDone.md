# 🌍 WorldBox 모듈 작업 완료 내역 (WorldBox Todo Done)

## Phase 1: 코어 뼈대 정상화 및 Engine 다이어트
### 1. ECS Base Class 구현 (Component, System)
- 순수 데이터 모델 규격을 강제하는 `Component.js` Base 클래스 생성
- 상태(데이터)의 직렬화(Serialization)를 위한 공통 인터페이스 마련
- 비즈니스 로직 규격을 강제하는 `System.js` Base 클래스 생성
- System이 `Engine`이라는 거대 객체(God Object)에 의존하지 않고, `EntityManager`와 `EventBus`만 주입(DI)받도록 생성자 규격 확립
- 자식 시스템들이 강제로 `update(dt, time)` 메서드를 구현하도록 에러 스로우 로직 추가

### 2. 전역 통신망(EventBus) 구축
- `core/EventBus.js` 생성: 시스템 간 직접 참조를 끊고 Pub/Sub 패턴으로 소통할 수 있는 중앙 메시지 브로커 구현
- `Engine.js` 코어에 `this.eventBus` 인스턴스화 및 전역 통신 파이프라인 연결 완료

### 3. 입력 시스템(InputSystem) 분리
- `Engine.js`에 존재하던 거대한 마우스 및 키보드 이벤트 리스너(`setupInput`) 로직을 `systems/input/InputSystem.js`로 완전히 분리.
- `InputSystem`이 `System` Base 클래스를 상속받도록 하여 ECS 패턴 규격을 준수.

### 4. UI 데이터 바인딩 시스템(UISystem) 분리
- `Engine.js` 내부에 있던 객체 선택(`handleSelect`) 및 데이터 포맷팅(`getEntityData`) 로직을 `systems/ui/UISystem.js`로 완전히 분리.
- Vue 프론트엔드 UI로 쏘아주는 데이터 동기화 업데이트를 `UISystem.js`의 `update` 루프로 위임하여 `Engine.js` 루프를 가볍게 만듦.
- `EventBus`를 통해 `INSPECT_REQUEST`, `ENTITY_SELECTED` 이벤트를 주고받아 코어 엔진과 UI 상태의 결합도를 대폭 낮춤.

### 5. SpawnerSystem 리팩토링 및 Base System 상속 적용
- 기존 `SpawnerSystem.js`가 `System` Base Class를 상속받도록 구조 변경.
- 시스템 내부에서 `this.engine.updateFertilityStat()` 등 UI나 엔진을 직접 호출하던 강결합 로직을 `EventBus.emit()` 방식으로 전환 준비 완료.
- (참고: 다른 모든 시스템들에도 동일한 Base Class 상속 작업이 순차적으로 적용될 예정입니다.)

## Phase 2: 시각(Render)과 논리(Logic)의 분리
### 6. 파티클 시스템(ParticleSystem) 분리 및 도입
- `Engine.js`에 혼재되어 있던 `particles` 데이터 배열과 관련 로직을 `systems/render/ParticleSystem.js`로 완전히 이관.
- `ReproductionSystem`이 번식 시 파티클 배열에 직접 푸시(Push)하던 코드를 제거하고, `EventBus.emit('SPAWN_EFFECT_PARTICLES')` 구조로 변경하여 렌더러와 로직 간의 결합도를 완벽히 격리함 (ECS 원칙 준수).

### 7. BehaviorSystem 명칭 변경 및 에러 해결
- 타 모듈(`module_game`)과의 명칭 충돌 및 혼동을 방지하기 위해 `BehaviorSystem.js`의 파일명을 `AnimalBehaviorSystem.js`로 변경함.
- 변경과 동시에 해당 시스템이 `System` Base Class를 상속받도록 리팩토링.
- 내부에 남아있던 벌(Bee) 산란 시의 하드코딩된 `particles.push` 로직을 `EventBus`로 전면 교체하여 런타임 크래시 에러 완벽 해결.

### 8. 동물 식사(Consumption) 로직 및 애니메이션, AI 버그 수정
- `ConsumptionSystem`과 `MetabolismSystem`을 ECS 패턴(`System` 상속)으로 완전 전환함.
- 양이 마찰력에 막혀 목표물에 도달하지 못하던 물리 버그를 `AnimalBehaviorSystem`의 `force` 값 현실화로 완벽하게 해결.
- 풀을 한순간에 삭제해버려서 애니메이션을 볼 수 없었던 문제를, `ConsumptionSystem` 내에서 `biteSize`를 통해 프레임 단위로 천천히 뜯어먹도록 개선하여 시각적 즐거움을 복구함.

### 9. EntityRenderer 렌더링 로직 하드코딩 분리 (디커플링)
- `EntityRenderer.js`에서 애니메이션 상태를 결정하기 위해 `AIState`와 `Metabolism` 컴포넌트를 직접 참조하던 강결합(하드코딩) 제거.
- `AnimalBehaviorSystem`과 `MetabolismSystem`이 연산 후 결과 상태를 `Visual` 컴포넌트(`isEating`, `isPooping`, `isInside`)에 기록하도록 구조 변경.
- 렌더러는 오직 `Visual` 컴포넌트 데이터만 읽어 시각화에 집중하도록 순수 ECS 원칙을 완벽하게 준수함.

### 10. SpawnerSystem UI 통계 갱신 로직 EventBus 통합
- `SpawnerSystem.js` 내부에서 `this.engine.updateFertilityStat()`을 직접 호출하던 강결합 요소를 제거함.
- 식물(풀, 꽃, 나무)이 자원을 소모할 때 `this.eventBus.emit('STATS_UPDATED')`를 발생시키고 코어 엔진에서 이를 수신하여 UI 시스템에 전달하도록 분리.
- Phase 2(시각과 논리의 분리)의 모든 목표 항목 달성 완료.

## Phase 3: FSM 기반 행동 AI 고도화
### 11. AI 상태(State) 컴포넌트 규격화
- 동적으로 할당되던 `AIState` 객체를 ECS 원칙에 맞게 `components/behavior/State.js` 컴포넌트로 구조화.
- `mode`, `targetId`, `wanderAngle`, `stateTimer` 등 행동 판별에 필요한 순수 데이터 필드 정의.
- FSM 아키텍처 전환을 위한 기반 데이터 모델 마련 완료.

### 🗑️ 삭제 또는 사용 중지(Deprecated) 대상 파일 식별
- 현 단계에서 즉시 삭제되는 파일은 없으나, 아키텍처 개편에 따라 다음 로직들이 점진적으로 삭제 및 이관될 예정입니다.
- **(예정)** `engine/core/ToolRegistry.js`의 `execute()` 등 구형 컨텍스트 기반 메서드 (현재 Command 패턴 분배기로 대체 중이며, 최종적으로는 구형 함수들 삭제 예정)
- **(예정)** `SpawnerSystem.js` 및 `ReproductionSystem.js` 등 기존 시스템 파일 내부에 존재하는 `this.engine.updateFertilityStat()`과 같은 UI 하드코딩 직접 호출부 (EventBus 도입 시 전면 삭제)
- **(예정)** `Engine.js` 내부의 파티클 렌더링 배열(`this.particles`) 관리 및 업데이트 로직 (독립된 `ParticleSystem`으로 이관 후 삭제 예정)

## Phase 3: FSM 기반 행동 AI 고도화 (완료)
### 12. AnimalBehaviorSystem FSM 패턴 확장
- 거대한 `if-else` 블록으로 관리되던 동물 행동 로직을 분리하여 상태 기계(FSM) 구조로 전환함.
- `AnimalBehaviorSystem` 내부에서 FSM 상태 전이 및 업데이트 처리를 담당하도록 리팩토링.

### 13. 개별 상태 모듈 구현 및 결합도 감소
- `states/State.js` 베이스 클래스 수정.
- `WanderState.js`, `HuntState.js`, `EatState.js`, `FleeState.js` 모듈을 각각 분리하여 구현 완료.
- 각 상태는 `System`을 주입받아 작동하며 순수 데이터 컴포넌트(`AIState`, `Transform`, `Metabolism` 등)만 조작하도록 격리.

### 14. 공간 해시맵(Spatial Hash) 기반 최적화 탐색 알고리즘 도입
- `utils/SpatialHash.js` 구현을 통해 화면 전체를 셀(100px) 단위로 분할하여 관리.
- `AnimalBehaviorSystem`에 적용하여 매 프레임 위치를 해싱하고, `findFood` 메서드에서 무작위 전체 엔티티 순회가 아닌 반경 내 인접 셀 대상 검색을 하도록 대폭 최적화함.

## Phase 4: 자원 순환 및 경제 시스템 정립 (완료)
### 15. 자원 밸런스 설정 중앙화 (Hardcoding 제거)
- `config/resource_balance.json`에 `grass`, `flower`, `tree`, `meat`, `milk`, `poop` 등의 기본 영양가(Nutrition) 및 목재량 데이터를 정의함.
- `Engine.js`에서 위 JSON 파일을 `resourceConfig`로 로드하도록 개선.
- `SpawnerSystem.js` 및 `EntityFactory.js`에서 엔티티 스폰 시 리소스(`Resource`) 컴포넌트에 할당하던 하드코딩 수치들을 분리하여 `resourceConfig`의 값을 사용하도록 완벽하게 연동함.

### 16. 자원 채집 및 소비 로직(Gathering & Consumption) 책임 분리
- 비어있던 `GatheringSystem.js`를 신규 구현하여 동물 및 곤충의 외부 자원 상호작용 채집 로직을 통합.
- 기존에 `AnimalBehaviorSystem`에 강결합되어 있던 벌(Bee)의 꿀 채집 후 `animal.nectar` 증가 및 타겟 상태 변경 처리 로직을 `GatheringSystem.js`로 완전히 이관함 (물리적인 AI 움직임 로직과 행동 완료 후의 데이터 변경 로직을 ECS 원칙에 맞게 성공적으로 Decoupling 처리).
- 기존에 `ConsumptionSystem.js`에 있던 "동물이 땅에서 식물/고기를 먹는 행위"를 `GatheringSystem.js`의 `gatherToStomach`로 이관하여 역할을 재정립함. 
- 추후 `ConsumptionSystem.js`는 인간 등의 개체가 인벤토리에 보관된 식량을 자체 소비하는 용도(Phase 5)로 활용될 수 있도록 비워둠.

## Phase 5: 🏛️ 문명 및 건축 시스템 도입 (완료)
### 18. 문명 및 건축 컴포넌트 구현
- `components/civilization/Builder.js` (건축가), `Structure.js` (건물 상태), `TechLevel.js` (기술 레벨) 컴포넌트를 설계 및 구현.
- `Inventory.js`를 구체화하여 `wood` 등의 자원을 담을 수 있도록 개편.
- `EntityFactory.js`에서 인간(`human`) 생성 시 `Builder` 및 `Inventory`를 자동으로 할당하도록 디커플링 설정.

### 19. 건축 팩토리 및 문명 시스템 적용
- `buildings.json`과 `tech_tree.json`을 설계하여 건물의 건설 비용, 소요 시간, 시대 발전 조건(인구, 나무 등)을 중앙 집중화.
- `BuildingFactory.js`를 도입하여 무작위 좌표에 투명한 "청사진(Blueprint)" 엔티티를 스폰할 수 있도록 구현.
- `ProgressSystem.js`를 개발하여 인구수와 누적 자원을 체크하고 시대를 다음 레벨로 발전(`techLevel++`)시키는 이벤트(`CIVILIZATION_PROGRESS`) 추가. 또한 조건 만족 시 새로운 건물 청사진을 맵에 배치하도록 AI 유도.

### 20. 건설 AI 로직 연동
- 인간 개체가 자원이 모자랄 때 수행할 `GatherWoodState.js` (나무 탐색 및 벌목)와 청사진을 향해 이동하는 `BuildState.js` FSM 상태를 추가.
- `ConstructionSystem.js`에서 `Builder`를 가진 엔티티가 청사진에 도달하면 `buildSpeed`와 `Inventory` 자원을 소모하며 `Structure.progress`를 올리고, 완성 시 실제 건물(불투명화)로 렌더링되게 구현 완료.