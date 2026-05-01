# 🌎 Worldbox ECS 아키텍처 코드 품질 개선 TODO

본 리스트는 중복 로직 제거, 응집도 향상, 결합도 저하 및 코드 일관성 유지를 위한 20가지 핵심 점검 항목입니다.

## 1. 중복되는 로직 (Duplication)
- [x] **[중복] 동물별 공통 뼈대 로직 통합**
  - 대상: `engine/factories/EntityFactory.js`, `engine/systems/behavior/AnimalBehaviorSystem.js`
  - 내용: 양, 소, 늑대 등 개별 동물의 생성 및 상태 업데이트 시 반복되는 물리/속성 설정 로직을 `EntityFactory` 내 공통 메서드로 묶거나 부모 클래스/컴포넌트 패턴으로 통합.
  - **상세 작업 계획:**
    - [x] `EntityFactory.js`: `createHuman` 전용 메서드 분리 및 `human` 하드코딩 로직 제거.
    - [x] `EntityFactory.js`: `createResource`의 `if-else` 블록을 자원 타입별(Plant, Tree, Mineral) 전용 메서드로 분할하여 구조 개선.
    - [ ] `AnimalBehaviorSystem.js`: `updateBeeAI`의 거대 로직을 `BeeState` 계열 클래스들로 분리하여 일반 동물 AI 업데이트 흐름(`updateEntityAI`)과 통합.
    - [x] `AnimalBehaviorSystem.js`: `findFood` 내의 사냥/식물 탐색 로직을 독립적인 헬퍼 메서드로 분리하여 응집도 향상.

- [x] **[중복] 지형 판정 및 좌표 계산 로직 분리**
  - 내용: 스폰 가능 타일 여부, 유효 좌표 확인 등 지형 관련 판정 로직이 여러 시스템에 산재해 있는지 확인 후 `TerrainGen.js` 혹은 유틸리티로 분리.
  - **상세 작업 계획:**
    - [x] `TerrainGen.js`: `isLand(biomeId)` 헬퍼 메서드 추가 및 각 시스템(`EnvironmentSystem`, `SpawnerSystem`, `EntityFactory`)의 `[5, 6, 7]` 하드코딩 교체.
    - [x] `TerrainGen.js`: `isValidIndex(idx)` 및 `getCoord(idx)` 등 좌표 연산 로직 통합 관리.

- [ ] **[중복] 데이터 직렬화 보일러플레이트 제거**
  - 내용: 엔티티 데이터를 JSON으로 변환하거나 불러올 때 반복되는 속성 할당 코드를 자동화된 매핑 로직으로 개선.
  - **상세 작업 계획:**
    - [ ] `EntityManager.js`: `removeEntity`의 수동 속성 초기화 로직을 컴포넌트별 `reset()` 메서드로 추상화하여 유지보수성 향상.
    - [ ] `EntityManager.js`: `createResourceNode`와 `EntityFactory.js`의 `createResource` 간 중복된 자원 설정 로직을 `EntityFactory`로 단일화.

- [x] **[중복] 바운딩 박스(AABB) 및 충돌 연산 통합**
  - 대상: `engine/systems/motion/KinematicSystem.js`, `engine/utils/SpatialHash.js`
  - 내용: 두 객체가 겹쳤을 때 밀어내는 수학적 바운딩 박스(AABB) 연산이 다른 이동 컨트롤러 내부에도 하드코딩으로 중복 구현되어 있는지 점검.
  - **상세 작업 계획:**
    - [x] `KinematicSystem.js`: 현재 누락된 객체 간 분리(Separation/Push) 로직 구현 및 `SpatialHash`를 활용한 최적화 적용.
    - [x] `engine/utils/MathUtils.js` 신설: AABB 충돌 판정 및 거리 기반 밀어내기 연산을 공통 함수로 분리.

- [x] **[중복] 데미지 및 방어력 계산 공식 단일화**
  - 대상: `engine/systems/behavior/AnimalBehaviorSystem.js`, `engine/components/stats/BaseStats.js`
  - 내용: 동물, 몬스터, 플레이어의 방어력 및 데미지 계산 공식이 여러 클래스에 흩어져 중복 처리되고 있는지 점검.
  - **상세 작업 계획:**
    - [x] `CombatSystem.js` 신설: `AnimalBehaviorSystem`에 산재한 공격/피격 로직(`attackAndConsumeAnimal` 등)을 분리하여 공통 시스템으로 구축.
    - [x] `BaseStats.js`: 데미지 적용 시 방어력 감쇄 로직을 컴포넌트 내부 메서드로 캡슐화.

## 2. 응집도가 높은지 (High Cohesion)
- [x] **[응집] Engine 클래스의 책임 분산 (God Class 방지)**
  - 대상: `engine/core/Engine.js`
  - 내용: 날씨 변화, 시간 흐름, 엔티티 스폰, 데이터 저장 등 서로 다른 성격의 도메인이 하나의 God Class에 몰려 단일 책임 원칙(SRP)을 위배하는지 점검.
  - **상세 작업 계획:**
    - [x] `SystemManager.js` 도입: `Engine` 생성자에서 수동으로 초기화/업데이트하는 15개 이상의 시스템 관리 로직 분리.
    - [ ] `ViewManager.js`: `viewFlags` 관리 및 `toggleView` 로직을 분리하여 엔진 코어 비대화 방지.

- [ ] **[응집] 도메인 로직과 렌더링 로직의 엄격한 분리**
  - 대상: `engine/components/render/Visual.js`, `engine/objects/renders/AnimalRenders.js`
  - 내용: 도메인 로직(체력, 이동 속도) 클래스 내부에 화면에 그리는 렌더링 로직이나 사운드 출력 로직이 섞여 있는지 점검.
  - **상세 작업 계획:**
    - [ ] `Visual.js`: 컴포넌트 내부에 애니메이션 계산 외의 직접적인 캔버스(`ctx`) 조작 코드가 남아있는지 전수 조사 및 제거.
    - [ ] `AnimalRenders.js`: 도메인 속성(체력 등)을 직접 참조하여 렌더링 형태를 결정하는 로직을 인터페이스화하여 분리.

- [ ] **[응집] 사용자 입력 처리와 비즈니스 로직 분리**
  - 대상: `engine/systems/input/InputSystem.js`, `engine/core/ToolRegistry.js`
  - 내용: 사용자의 인벤토리 아이템 소모 로직과 동물 길들이기/먹이주기 로직이 분리되지 않고 하나의 클래스에서 모두 처리되고 있는지 점검.
  - **상세 작업 계획:**
    - [ ] `InputSystem.js`: 마우스/키보드 이벤트 캡처 기능만 남기고, 실제 월드 상호작용은 전용 `InteractionSystem`이나 `Tool` 클래스로 완전 이관.

- [ ] **[응집] AI 브레인 컴포넌트화 점검**
  - 대상: `engine/systems/behavior/AnimalBehaviorSystem.js`
  - 내용: 길찾기(Pathfinding), 타겟 탐색, 교배 로직이 모두 한 파일에 몰려 있는지 점검. 각각의 독립적인 하위 컴포넌트(Sensor, Task)로 분리되었는지 확인.
  - **상세 작업 계획:**
    - [ ] `AnimalBehaviorSystem.js`: 거대한 `findFood` 및 `updateBeeAI` 로직을 각각 `Sensor` 모듈과 종별 전용 `Brain` 클래스로 위임.

- [x] **[응집] 엔티티 사망 처리 프로세스 위임**
  - 대상: `engine/systems/behavior/AnimalBehaviorSystem.js` (`handleDieState`)
  - 내용: 사망 시 드랍 아이템, 파티클 생성, 비옥도 환원 로직이 하나의 함수에 하드코딩되어 있는지 점검.
  - **상세 작업 계획:**
    - [x] `DeathProcessor.js` 신설: 사망 로직의 각 단계를 `EventBus`로 전송하여 드랍 시스템(`DropSystem`)과 파티클 시스템(`ParticleSystem`)이 독립적으로 처리하게 함.

## 3. 결합도가 낮은지 (Low Coupling)
- [ ] **[결합] 내비게이션 인터페이스 의존성 점검**
  - 대상: `engine/systems/behavior/states/HuntState.js`, `engine/world/TerrainGen.js`
  - 내용: 길찾기 모듈이 특정 타일맵 클래스(GridMapImpl)에 강하게 결합되어 있는지 점검. 인터페이스(INavigableMap)를 의존하여 유연성을 높이었는지 확인.
  - **상세 작업 계획:**
    - [ ] `TerrainGen.js`: 지형 데이터에 직접 접근하는 대신 `isWalkable(x, y)` 등의 추상화된 메서드를 제공하도록 인터페이스화.

- [ ] **[결합] 상태 전이 시 강결합 제거**
  - 대상: `engine/systems/behavior/states/WanderState.js` 등
  - 내용: `return AnimalStates.HUNT`와 같이 문자열/열거형 상수를 반환하는 구조인지, 직접 클래스를 생성하여 반환하는지 점검.
  - **상세 작업 계획:**
    - [ ] `StateFactory.js` 도입: 상태 전이 시 하드코딩된 열거형 참조를 제거하고, `StateFactory`를 통해 상태 객체를 주입받아 의존성 역전 적용.

- [ ] **[결합] 데이터 저장소 접근 방식 점검**
  - 대상: `engine/core/EntityManager.js`, `ui/store/worldboxStore.js`
  - 내용: 동물 엔티티 객체가 자신의 데이터를 저장하기 위해 세이브 매니저나 DB 커넥션 객체를 직접 참조(의존)하고 있는지 점검.
  - **상세 작업 계획:**
    - [ ] `worldboxStore.js`: 엔진 내부의 `selectedId` 관리를 Pinia 스토어로 완전히 이관하고, 엔진은 `EventBus`를 통해 선택 상태 변경 정보만 송신하도록 개선.

- [ ] **[결합] 사운드/이펙트 시스템 이벤트 기반 연동**
  - 대상: `engine/objects/renders/AnimalRenders.js`, `engine/systems/render/ParticleSystem.js`
  - 내용: 동물 클래스가 사운드 엔진 API를 직접 호출하는지 점검. 이벤트 버스나 메시지 큐를 통해 느슨하게 결합(Decoupling)되어야 함.
  - **상세 작업 계획:**
    - [ ] `AnimalRenders.js`: `window.dispatchEvent` 기반의 전역 브릿지를 제거하고, 필요한 시각 효과/사운드는 엔진 내부의 `EventBus`를 통해 발행하도록 통합.

- [ ] **[결합] 업적/통계 시스템 관찰자 패턴 적용**
  - 대상: `engine/core/StatsMonitor.js`
  - 내용: 플레이어가 동물을 길들였을 때 동물 클래스 내부에서 업적 시스템의 함수를 직접 호출하는 강결합 구조인지 점검 (Observer 패턴 적용 필요).
  - **상세 작업 계획:**
    - [ ] `StatsMonitor.js`: `onUpdate` 콜백 방식 대신 `EventBus.emit('STATS_TICK')` 방식을 적용하여 통계가 필요한 모듈만 자율적으로 구독하도록 개선.

## 4. 일관되지 않은 코드 (Inconsistency)
- [ ] **[일관] 네이밍 컨벤션 전수 점검**
  - 대상: `engine/` 내 전체 JS 파일
  - 내용: 네이밍 컨벤션 불일치 점검. 어떤 파일은 get_hp(), 다른 파일은 getHealth(), MaxStamina 등 스네이크 케이스와 카멜 케이스가 혼용되었는지 확인.
  - **상세 작업 계획:**
    - [ ] 전수 조사: `engine/` 폴더 내 모든 클래스 메서드를 CamelCase로 통일하고, 설정값 상수는 UPPER_SNAKE_CASE로 변환.

- [ ] **[일관] 매직 넘버 제거 및 설정 파일화**
  - 대상: `engine/config/species.json`, `engine/systems/behavior/AnimalBehaviorSystem.js`
  - 내용: 스탯 관리의 일관성 점검. 늑대의 이동 속도는 설정 파일에서 불러오는데, 양의 이동 속도는 소스 코드 내부에 매직 넘버(Magic Number)로 하드코딩되어 있는지 확인.
  - **상세 작업 계획:**
    - [ ] `species.json` 확장: `AnimalBehaviorSystem`에 하드코딩된 허기/피로도 변화 수치 및 속도 배율을 설정 파일로 추출.

- [ ] **[일관] 객체 라이프사이클(초기화 방식) 통일**
  - 대상: `engine/factories/EntityFactory.js`
  - 내용: 객체 라이프사이클 일관성 점검. 어떤 동물은 생성자(Constructor)에서 모든 값을 초기화하고, 어떤 동물은 빈 생성자 호출 후 init() 메서드를 따로 불러야 하는지 확인.
  - **상세 작업 계획:**
    - [ ] `EntityFactory.js`: 컴포넌트 추가 시 객체 리터럴(`{}`)과 클래스 인스턴스(`new`) 사용이 혼재된 부분을 모두 인스턴스 기반 초기화로 통일하여 일관된 생성 흐름 적용.

- [ ] **[일관] 에러 핸들링 및 예외 처리 방식 통일**
  - 대상: `engine/world/ChunkManager.js`, `engine/core/Engine.js`
  - 내용: 에러 핸들링 방식의 일관성 점검. 데이터를 불러올 때 에러가 나면 어떤 곳은 try-catch 후 null을 반환하고, 어떤 곳은 Exception을 그대로 상위로 던지는지(Throw) 확인.
  - **상세 작업 계획:**
    - [ ] 에러 처리 표준화: 성능 민감 구간(루프)은 `null` 반환 경계 검사로 통일하고, 데이터 로딩 등 초기화 구간은 `throw new Error()` 방식으로 일원화하여 프로젝트 표준 방식을 정해 통일.

- [x] **[일관] 상태 업데이트 주기 및 방식 통일**
  - 대상: `engine/core/Engine.js` (`update` 루프)
  - 내용: 상태 업데이트 주기의 일관성 점검. 어떤 로직은 매 틱마다 update()를 돌며 폴링(Polling) 방식으로 검사하고, 어떤 로직은 이벤트 기반(Event-driven)으로만 동작하여 아키텍처가 통일되지 않았는지 확인.
  - **상세 작업 계획:**
    - [x] `Engine.js`: 각 시스템의 업데이트 순서를 명시적으로 관리하고, 상태 변화 알림은 `EventBus`로, 지속적인 물리/AI 연산은 `update` 루프로 명확히 이원화하여 아키텍처 일관성 확보.