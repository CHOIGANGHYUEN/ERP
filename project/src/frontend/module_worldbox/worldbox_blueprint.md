# WorldBox Module - Architecture Blueprint

이 문서는 `module_worldbox`의 고도화된 ECS(Entity-Component-System) 아키텍처 및 시스템 설계를 상세히 정의합니다.
최신 구현 사항인 **멀티스레딩 기반 병렬 시뮬레이션, 데이터 지향 설계(DOD), 자율 마을 확장, 그리고 지능형 직업 분배 시스템**을 포함합니다.

---

## 1. Core Engine & Management (엔진 코어 및 관제)

- `engine/core > Engine.js`
  - 엔진의 메인 루프(`requestAnimationFrame`)를 제어하고 `WorkerBridge`를 통해 멀티스레드 시뮬레이션을 오케스트레이션합니다. 렌더링 및 UI 라이프사이클의 허브 역할을 수행합니다.
  - **연관 파일**: `WorkerBridge.js`, `SystemManager.js`, `EntityManager.js`
- `engine/core > SimulationWorker.js` [NEW]
  - 메인 스레드와 분리되어 무거운 시뮬레이션 연산을 전담하는 워커 스레드입니다. AI, 물리, 경제 시스템을 독립적으로 실행하여 렌더링 성능을 보장합니다.
- `engine/core > WorkerBridge.js` [NEW]
  - 메인 스레드와 시뮬레이션 워커 간의 양방향 통신 및 엔티티 상태 동기화를 담당하는 가교 역할을 수행합니다.
- `engine/core > BufferManager.js` [NEW]
  - `SharedArrayBuffer`를 활용해 엔티티의 핵심 데이터를 고속 TypedArray로 관리하며, 스레드 간 제로 카피 데이터 공유를 지원합니다.
- `engine/systems/core > TimeSystem.js`
  - 게임 내 시간 흐름(틱, 일/월/년, 낮/밤 사이클)을 관리합니다. 시간 배속 제어 및 환경 시스템과의 동기화를 수행합니다.
- `engine/core > SystemManager.js`
  - 실행 모드(`MAIN`/`WORKER`)에 따라 시스템을 선별적으로 가동합니다. 시스템 간 우선순위(Phase)를 관리하며 `Blackboard`를 통해 데이터를 중계합니다.
  - **연관 파일**: `System.js`, `Blackboard.js`
- `engine/core > EntityManager.js`
  - 엔티티의 생성, 삭제 및 컴포넌트 조립을 담당합니다. DOD 프록시 인덱스와 일반 객체 데이터를 통합하여 시스템 연산 효율을 관리합니다.
  - **연관 파일**: `BufferManager.js`, `Component.js`
- `engine/core > ToolRegistry.js`
  - 사용자의 입력을 엔진 명령으로 변환하는 브러시 및 도구들의 등록소입니다. 지형 조작 및 엔티티 스폰 로직을 캡슐화합니다.
- `engine/core > UISystem.js`
  - 엔진 내부 상태(마을 통계 등)를 Vue 프론트엔드 레이어와 동기화합니다. 워커로부터 수신된 통계 데이터를 처리합니다.

---

## 2. ECS - Components (데이터 구조체)

*일부 컴포넌트는 성능과 관리 편의를 위해 별도 클래스 파일 없이 팩토리에서 익명 객체(Plain Object) 형태로 생성 및 주입됩니다.*

### 💾 High-Performance DOD (TypedArray 기반)
- `engine/components/motion > Transform.js`
  - 위치와 속도 데이터를 공유 버퍼에서 관리하는 프록시 컴포넌트입니다. **[DOD 적용]**
- `engine/components/stats > BaseStats.js`
  - 체력, 허기, 피로도 등 생물학적 파라미터를 버퍼 기반으로 관리합니다. **[DOD 적용]**
- `engine/components/render > Visual.js`
  - 타입, 크기, 색상 정보를 버퍼에 기록하여 렌더러가 즉시 참조하도록 합니다. **[DOD 적용]**

### 🧠 Behavior & AI
- `engine/components/behavior > State.js (AIState)`
  - 개체의 현재 행동 상태(`mode`), 타겟 ID, 상태 스택을 저장합니다.
- `engine/components/behavior > Target.js`
  - 현재 추적 중인 대상의 위치, 타입, 유효성 정보를 캐싱합니다.
- `engine/components/behavior > JobController.js`
  - 개체의 직업 활동 범위(`zoneId`)와 직업별 세부 상태를 관리합니다.

### 🏛️ Civilization
- `(Object) Civilization`
  - 소속 마을 ID, 국가 ID, 직업 유형 및 할당된 `Role` 객체를 포함합니다.
- `engine/components/civilization > Structure.js`
  - 건물 종류, 완공 여부(`isComplete`), 내구도 정보를 담습니다.
- `engine/components/civilization > Housing.js`
  - 주거 건물의 수용량 및 거주자 목록을 관리합니다.
- `engine/components/civilization > Door.js`
  - 울타리 문이나 출입구의 개폐 상태를 담당합니다.

### 🪵 Resource & Economy
- `engine/components/resource > Resource.js / ResourceNode.js`
  - 자원 노드의 종류, 잔여량, 채집 가능 여부를 관리합니다.
- `engine/components/resource > DroppedItem.js`
  - 월드에 드롭된 아이템의 데이터(`itemType`, `amount`)와 카테고리를 관리합니다.
- `engine/components/resource > Inventory.js`
  - 개체가 소지한 자원의 수량과 가방 용량을 관리합니다.

---

## 3. ECS - Systems (로직 처리 계층)

### 🧬 Lifecycle & Simulation (Worker 스레드)
- `engine/systems/lifecycle > MetabolismSystem.js`
  - 노화, 허기 증가, 배설 프로세스를 버퍼 단위로 고속 처리합니다.
- `engine/systems/lifecycle > ReproductionSystem.js`
  - 성체 상태와 마을 상황을 종합하여 번식 및 성장을 제어합니다.
- `engine/systems/motion > KinematicSystem.js`
  - 버퍼 직접 순회를 통한 물리 이동 계산 및 충돌 분리를 수행합니다.

### 🏗️ Civilization & Behavior (Worker 스레드)
- `engine/systems/civilization > VillageSystem.js`
  - 마을의 인구, 자원, 영토를 총괄 관리하며 자동 주택 확장을 계획합니다.
- `engine/systems/behavior > HumanBehaviorSystem.js / AnimalBehaviorSystem.js`
  - 엔티티의 두뇌(`Brain`)를 구동하고 상태(`State`) 전이를 실행합니다.
- `engine/systems/behavior > CombatSystem.js / DeathProcessor.js`
  - 전투 판정 및 사망 시 전리품 생성 로직을 처리합니다.

### 🎨 Rendering & Input (Main 스레드)
- `engine/systems/render > RenderCoordinator.js`
  - 버퍼 데이터를 기반으로 지형, 엔티티, 파티클의 렌더링 순서를 동기화합니다.
- `engine/systems/render > EntityRenderer.js`
  - 엔티티의 8방향 애니메이션을 버퍼 정보를 참조하여 고속 렌더링합니다.
- `engine/systems/input > InputSystem.js`
  - 사용자 입력을 수집하여 `WorkerBridge`를 통해 시뮬레이션 워커로 전달합니다.

---

## 4. AI Brains, Roles, States & Sensors (지능 및 행동)

### 🧠 Brains & Roles
- `engine/systems/behavior/brains > HumanBrain.js / CarnivoreBrain.js` 등
  - 종족별 의사결정 우선순위 정의.
- `engine/systems/roles > ChiefRole.js / ArchitectRole.js / LoggerRole.js` 등
  - 직업별 세부 행동 전략 및 자원 탐색 로직.

### 🏃 States & Jobs
- `engine/systems/behavior/states > WanderState.js, BuildState.js, GatherState.js` 등
  - FSM 각 상태별 구체적 실행 로직.
- `engine/systems/behavior/states/jobs > LumberjackState.js, TransporterState.js`
  - 직업 특화 행동 상태.

### 🔍 Sensors (인지)
- `engine/systems/behavior/sensors > FoodSensor.js, PredatorSensor.js, ZoneSensor.js`
  - `SpatialHash`를 활용해 반경 내 객체를 고속 필터링합니다.

---

## 5. Rendering Pipeline - Objects & Renders (시각화 세부)

- `engine/objects/renders > AnimalRenders.js / BuildRender.js / NatureRenders.js`
  - 각 엔티티 타입별 구체적인 그리기 함수 정의.
- `engine/objects/renders/animals > HumanRenderer.js / WolfRenderer.js` 등
  - 개별 종족의 신체 파츠 및 애니메이션 프레임 정의.

---

## 6. Entity Factories (생성 파이프라인)

- `engine/factories/core > FactoryProvider.js / EntityBuilder.js`
  - 팩토리 중앙 접근점과 체이닝 방식의 엔티티 조립 빌더 제공.
- `engine/factories/entities > HumanFactory.js, BuildingFactory.js, NatureFactory.js`
  - 도메인별 컴포넌트 조합 및 설정 파일(Config) 연동 초기 데이터 설정.

---

## 7. World & Utilities (공간 및 지형)

- `engine/world > TerrainGen.js / WorldLayers.js`
  - 다층 레이어 기반의 절차적 지형 생성 및 환경 데이터 관리.
- `engine/utils > SpatialHash.js`
  - 메인/워커 독립 인스턴스를 통한 고속 근접 탐색 및 렌더링 컬링 지원.
- `engine/utils > Pathfinder.js`
  - A* 알고리즘 기반의 고성능 길찾기 유틸리티.
- `engine/utils > Logger.js` [NEW]
  - `globalThis`를 활용하여 메인과 워커 환경 어디서나 안전하게 작동하는 싱글톤 로그 시스템.

---

## 8. UI, Store & Config (인터페이스 및 설정)

- `ui/views > WorldboxView.vue` / `ui/store > worldboxStore.js`
  - 시뮬레이션 메인 뷰 및 엔진-UI 데이터 브릿지 (Pinia).
- `engine/config > species.json, resource_balance.json, JobTypes.js`
  - 시뮬레이션의 균형과 속성을 정의하는 데이터 셋.

---

## 9. World Initialization Flow (세계 초기화 시퀀스)

**[최신]** 시뮬레이션의 병렬화와 안정성을 위해 다음과 같은 초기화 단계를 따릅니다.

1.  **Map Configuration**: `MapSettings.vue`를 통해 맵 크기 및 자원 밀도 옵션을 수집합니다.
2.  **Engine & Buffer Boot**: `BufferManager`가 공유 메모리(SAB)를 할당하고 엔진을 초기화합니다.
3.  **Worker Linking**: `WorkerBridge`가 시뮬레이션 워커를 생성하고 공유 버퍼를 연결합니다.
4.  **Terrain Generation**: `TerrainGen`이 비동기로 지형을 생성하고 워커에 데이터를 공유합니다.
5.  **Simulation Start**: 워커가 시뮬레이션 루프를, 메인 스레드가 렌더링 루프를 독립적으로 가동합니다.
6.  **Dynamic Spawning**: `SpawnerSystem`이 밀도에 맞춰 엔티티를 월드에 지능적으로 배치합니다.