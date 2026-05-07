# WorldBox Module - Architecture Blueprint

이 문서는 `module_worldbox`의 고도화된 ECS(Entity-Component-System) 아키텍처 및 시스템 설계를 상세히 정의합니다.
최신 구현 사항인 **자동 번식, 자율 마을 확장, 지능형 직업 분배, 그리고 개선된 고성능 렌더링 파이프라인**을 포함합니다.

---

## 1. Core Engine & Management (엔진 코어 및 관제)

- `engine/core > Engine.js`
  - 엔진의 메인 루프(`requestAnimationFrame`)를 제어하고 모든 시스템의 라이프사이클을 관리합니다. `SpatialHash`, `EventBus`, `Config` 등을 초기화하며 전체 시뮬레이션의 허브 역할을 수행합니다.
  - **연관 파일**: `SystemManager.js`, `EntityManager.js`, `EventBus.js`
- `engine/systems/core > TimeSystem.js`
  - 게임 내 시간 흐름(틱, 일/월/년, 낮/밤 사이클)을 관리합니다. 시간 배속 제어 및 환경 시스템(빛깔 등)과의 동기화를 수행합니다.
- `engine/core > SystemManager.js`
  - 시스템들의 실행 우선순위(Phase)를 관리합니다. `PRE_UPDATE`, `UPDATE`, `POST_UPDATE`, `RENDER` 등의 단계별로 시스템을 실행하며, `Blackboard`를 통해 시스템 간 공유 데이터를 중계합니다.
  - **연관 파일**: `System.js`, `Blackboard.js`
- `engine/core > Camera.js`
  - **[최신]** 카메라의 시야 영역(Viewport AABB)을 계산하고 줌 레벨에 따른 LOD(Level of Detail) 임계값을 제공하여 화면 밖 청크를 렌더링에서 제외(Culling)하는 핵심 역할을 수행합니다.
- `engine/core > EntityManager.js`
  - 엔티티의 생성, 삭제 및 컴포넌트 조립을 담당합니다. 엔티티 타입별 고속 순회 인덱스(`humanIds`, `animalIds`, `resourceIds` 등)를 유지하여 시스템 연산 효율을 극대화합니다.
  - **연관 파일**: `Component.js`, `EntityBuilder.js`
- `engine/core > ToolRegistry.js`
  - 사용자의 마우스/터치 입력을 실제 엔진 명령으로 변환하는 브러시 및 도구들의 등록소입니다. 바이옴 변경, 엔티티 스폰, 지형 조작 등의 로직을 캡슐화합니다.
  - **연관 파일**: `InputSystem.js`, `ToolManager.js`
- `engine/core > UISystem.js`
  - 엔진의 내부 상태(선택된 엔티티 정보, 마을 통계 등)를 Vue 프론트엔드 레이어와 동기화합니다. `worldboxStore`와의 인터페이스를 담당합니다.
  - **연관 파일**: `worldboxStore.js`, `EntityStatusPanel.vue`

---

## 2. ECS - Components (데이터 구조체)

*일부 컴포넌트는 성능과 관리 편의를 위해 별도 클래스 파일 없이 팩토리에서 익명 객체(Plain Object) 형태로 생성 및 주입됩니다.*

### 🧠 Behavior & AI
- `engine/components/behavior > State.js (AIState)`
  - 개체의 현재 행동 상태(`mode`), 타겟 ID, 상태 스택(`modeStack`)을 저장합니다. 길찾기 실패 카운트와 블랙리스트를 관리합니다.
- `engine/components/behavior > Target.js`
  - 현재 추적 중인 대상의 위치, 타입, 유효성 정보를 캐싱합니다.
- `engine/components/behavior > JobController.js`
  - 개체의 직업 활동 범위(`zoneId`)와 직업별 세부 상태를 관리합니다.

### 🏛️ Civilization
- `(Object) Civilization`
  - 소속 마을 ID, 국가 ID, 현재 직업 유형(`jobType`) 및 할당된 `Role` 객체를 포함합니다.
- `engine/components/civilization > Structure.js`
  - 건물 종류, 완공 여부(`isComplete`), 내구도, 소속 마을 정보를 담습니다.
- `engine/components/civilization > Housing.js`
  - 주거 건물의 최대 수용량, 현재 거주자 목록, 주거 만족도를 관리합니다.
- `engine/components/civilization > Door.js`
  - 울타리 문이나 출입구의 개폐 상태 및 자동 닫힘 로직을 담당합니다.
- `engine/components/civilization > TechLevel.js`
  - 군락의 기술 발전 수준 및 누적 자원 기여도를 기록합니다.
- `engine/components/civilization > Builder.js`
  - 개체의 건축 능력치와 건설 가능 여부를 정의합니다.

### 🪵 Resource & Economy
- `engine/components/resource > Resource.js / ResourceNode.js`
  - 자원 노드의 종류, 잔여량, 채집 가능 여부를 관리합니다. `ResourceNode`는 시각적 파티클 생성 로직 및 **속성 분류(`category`)** 기능을 포함합니다.
- `engine/components/resource > DroppedItem.js`
  - 월드에 드롭된 아이템의 데이터(`itemType`, `amount`)와 **기능적 분류(`category`)**를 관리합니다. AI가 아이템의 용도를 인지하는 핵심 지표로 활용됩니다.
- `engine/components/resource > Inventory.js`
  - 개체가 소지한 자원의 종류별 수량과 가방 용량을 관리합니다.
- `engine/components/resource > Storage.js`
  - 창고 건물의 대규모 자원 보관 상태를 관리하며, 입출력 이벤트를 발생시킵니다.
- `engine/components/resource > GathererComponent.js`
  - 채집 속도 및 채집 로직 실행을 위한 데이터를 보유합니다.

### 📊 Stats & Biology
- `engine/components/stats > BaseStats.js`
  - 체력, 허기, 피로도, 이동 속도, 공격력 등 기본 파라미터를 관리합니다.
- `engine/components/stats > Age.js`
  - 나이, 수명, 성장 단계(baby/adult/elder)를 기록하고 단계별 변화를 처리합니다.
- `(Object) Metabolism`
  - 소화, 배설 대기량, 축적된 비옥도를 관리합니다.
- `engine/components/stats > Health.js / Emotion.js / Digestion.js`
  - 체력 회복, 감정 상태, 세부 소화 파라미터를 정밀하게 관리합니다.
- `engine/components/stats > TagBitmask.js`
  - 엔티티의 카테고리 속성을 비트마스크를 통해 고속 분류합니다.

---

## 3. ECS - Systems (로직 처리 계층)

### 🧬 Lifecycle & Biology
- `engine/systems/lifecycle > MetabolismSystem.js`
  - 시간 경과에 따른 노화, 허기/피로도 증가, 소화 및 배설물 스폰을 처리합니다. LOD 업데이트를 통해 연산 비용을 최적화합니다.
- `engine/systems/lifecycle > ReproductionSystem.js`
  - **[최신]** 성체 엔티티의 상태와 마을 상황을 종합하여 번식을 제어합니다. 아기 엔티티 스폰 및 성장 관리를 담당합니다.
- `engine/systems/lifecycle > HealthSystem.js / EmotionSystem.js`
  - 개체의 체력 재생 및 감정 변화(행복도, 스트레스)를 실시간 시뮬레이션합니다.

### 🏗️ Civilization & Society
- `engine/systems/civilization > VillageSystem.js`
  - 마을의 인구, 자원, 영토를 총괄 관리합니다. 자동 주택 확장 계획과 영토 개척(Expansion) 로직을 포함합니다.
- `engine/systems/civilization > ConstructionSystem.js`
  - 청사진 상태의 건물을 완공시키는 과정을 처리하며, 완공 시 내부 엔티티를 안전한 곳으로 이동시킵니다.
- `engine/systems/civilization > NationSystem.js / SocialSystem.js`
  - 국가 간 관계, 세력 버프, 엔티티 간 사회적 관계 및 평판을 시뮬레이션합니다.
- `engine/systems/civilization > ZoneManager.js`
  - 마을별 활동 영역 및 자원 관리 구역을 정의합니다.

### 🧠 Behavior & AI Control
- `engine/systems/behavior > HumanBehaviorSystem.js / AnimalBehaviorSystem.js`
  - 엔티티의 두뇌(`Brain`)를 구동하고 상태(`State`) 전이를 실행합니다.
- `engine/systems/behavior > TargetManager.js`
  - 지능형 타겟 분배기로, 중복 타겟팅 방지 및 효율적인 목표 할당을 수행합니다.
- `engine/systems/behavior > CombatSystem.js / DeathProcessor.js`
  - 전투 판정, 피해 계산 및 사망 시 전리품 생성과 엔티티 정리를 처리합니다. **`drops: []` 배열 기반의 표준화된 드랍 시스템**을 통해 다중 아이템 및 확률적 드랍을 관리합니다.

### 💰 Economy & Resources
- `engine/systems/economy > EconomyManager.js`
  - 마을 간 자원 불균형을 해소하기 위한 수송 작업(`TransportTask`)을 자동 생성합니다.
- `engine/systems/economy > GatheringSystem.js / SpawnerSystem.js`
  - 자원 채집(벌목, 사냥 등) 로직과 자연적인 식생/동물 스폰을 관리합니다.
- `engine/systems/economy > FarmingSystem.js`
  - 농장 작물의 성장 및 수확 프로세스를 담당합니다.

### 🏃 Motion & Physics
- `engine/systems/motion > KinematicSystem.js`
  - 위치/속도 기반 이동 계산 및 `SpatialHash`를 이용한 충돌 분리(AABB)를 수행합니다.
- `engine/systems/motion > HerdingSystem.js / PathSystem.js`
  - 무리 행동 시뮬레이션 및 충돌 레이어를 인지하는 길찾기 경로를 제공합니다.

### 🎨 Rendering & Visuals
- `engine/systems/render > RenderCoordinator.js`
  - **[최신]** 메인 렌더 루프를 제어합니다. 전체 맵 대신 `ChunkManager`에서 가시 영역으로 판별된 청크만 선택적으로 렌더링하며, 카메라 줌에 따라 LOD 0(원거리 미니맵)과 LOD 1(근거리 고해상도) 렌더링 파이프라인을 분기하여 드로우 콜을 최적화합니다.
- `engine/systems/render > EntityRenderer.js`
  - 엔티티의 8방향 애니메이션 및 장착 상태를 고속 렌더링하며, 캔버스 캐싱을 활용합니다.
- `engine/systems/render > ParticleSystem.js / CullingSystem.js`
  - 특수 효과 파티클 관리 및 화면 밖 엔티티 렌더링 제외(Culling)를 통한 성능 최적화.

---

## 4. AI Brains, Roles, States & Sensors (지능 및 행동)

### 🧠 Brains & Roles
- `engine/systems/behavior/brains > HumanBrain.js / CarnivoreBrain.js / BeeBrain.js` 등
  - 종족별 의사결정 우선순위 정의.
- `engine/systems/roles > ChiefRole.js / ArchitectRole.js / LoggerRole.js` 등
  - 직업별 세부 행동 전략(Strategy Pattern) 및 우선순위 로직. **속성 기반 식별 체계(Category-based Identification)**를 통해 유연한 자원 탐색을 수행합니다.

### 🏃 States & Jobs
- `engine/systems/behavior/states > WanderState.js, BuildState.js, GatherState.js` 등
  - FSM의 각 상태별 구체적 실행 로직.
- `engine/systems/behavior/states/jobs > LumberjackState.js, TransporterState.js`
  - 직업 특화 행동 상태.

### 🔍 Sensors (인지)
- `engine/systems/behavior/sensors > FoodSensor.js, PredatorSensor.js, ZoneSensor.js`
  - `SpatialHash`를 활용해 반경 내 먹이, 위협, 활동 구역 내 자원을 고속 필터링합니다.

---

## 5. Rendering Pipeline - Objects & Renders (시각화 세부)

- `engine/objects/renders > AnimalRenders.js / BuildRender.js / NatureRenders.js`
  - 각 엔티티 타입별 구체적인 그리기(Draw) 함수들을 포함합니다.
- `engine/objects/renders/animals > HumanRenderer.js / WolfRenderer.js / BeeRenderer.js` 등
  - 개별 종족의 신체 파츠, 애니메이션 프레임, 성별/나이별 시각적 차이를 정의합니다.
- `engine/objects/renders/nature > TreeRenderer.js / GrassRenderer.js / PoopRenderer.js` 등
  - 식생의 계절 변화, 바람에 의한 흔들림, 배설물 등의 절차적 렌더링을 처리합니다.

---

## 6. Entity Factories (생성 파이프라인)

- `engine/factories/core > FactoryProvider.js / EntityBuilder.js`
  - 팩토리들의 중앙 접근점과 체이닝 방식의 엔티티 조립 빌더를 제공합니다.
- `engine/factories/entities > HumanFactory.js, BuildingFactory.js, NatureFactory.js, ItemFactory.js`
  - 각 도메인별 컴포넌트 조합 및 초기 데이터 설정을 수행합니다. **설정 파일(Config) 연동**을 통해 엔티티의 초기 속성과 드랍 데이터를 주입합니다.
  - 나무 엔티티는 `tree_` 접두사 규칙(예: `tree_oak`)을 사용하여 엔진 내에서 표준화된 인식이 가능하도록 생성됩니다.

---

## 7. World & Utilities (공간 및 지형)

- `engine/world > ChunkManager.js / Chunk.js`
  - **[최신]** 타일 기반 청크 렌더링 시스템입니다. 거대한 맵을 512x512 단위의 청크로 분할하고, 개별 `OffscreenCanvas`를 할당합니다. `isDirty` 플래그 캐싱과 메모리 풀링을 통해 지형 렌더링 비용을 획기적으로 낮춥니다.
- `engine/world > TerrainGen.js / WorldLayers.js`
  - 다층 레이어 기반의 절차적 지형 생성 및 환경 데이터(비옥도 등) 관리.
- `engine/utils > SpatialHash.js`
  - O(1)에 가까운 근접 검색을 지원하는 핵심 공간 파티셔닝 자료구조.
- `engine/utils > Pathfinder.js`
  - A* 알고리즘 기반의 고성능 길찾기 유틸리티.
- `engine/utils > BitmaskUtils.js, GridUtils.js, MathUtils.js`
  - 지형 오토타일링, 그리드 계산, 물리 연산을 위한 최적화 함수 모음.

---

## 8. UI, Store & Config (인터페이스 및 설정)

- `ui/views > WorldboxView.vue` / `ui/store > worldboxStore.js`
  - 시뮬레이션 메인 뷰 및 엔진-UI 데이터 브릿지 (Pinia).
- `ui/components > MapSettings.vue / EntityStatusPanel.vue / VillageDetailPanel.vue`
  - **[최신]** `MapSettings.vue`: 게임 시작 전 세계 규모, 자원 밀도, 생태계 구성을 설정하는 프리미엄 인터페이스.
- `engine/config > species.json, resource_balance.json, buildings.json, biomes.json, JobTypes.js`
  - 시뮬레이션의 균형과 속성을 정의하는 데이터 셋. **`resource_balance.json`**은 이제 모든 자원의 드랍 데이터와 기능적 속성(`edible`, `category`)을 정의하는 핵심 설정 파일입니다.

---

## 9. World Initialization Flow (세계 초기화 시퀀스)

**[최신]** 시뮬레이션의 안정성과 사용자 정의를 위해 다음과 같은 초기화 단계를 따릅니다.

1.  **Map Configuration**: `MapSettings.vue`를 통해 사용자로부터 맵 크기, **육지 스케일(Landmass Scale)**, 및 각종 자원 밀도 옵션을 수집합니다.
2.  **Engine Boot**: 수집된 옵션이 `Engine` 생성자로 주입되어 `mapWidth/Height`가 결정됩니다.
3.  **Terrain Generation**: `TerrainGen.generateProgressive`가 비동기로 지형과 환경 레이어를 생성합니다.
4.  **WORLD_READY Event**: 모든 버퍼와 지형이 준비되면 `EventBus`를 통해 `WORLD_READY` 이벤트가 발생합니다.
5.  **Dynamic Spawning**: `SpawnerSystem`이 이벤트를 수신하고, 설정된 밀도에 맞춰 나무, 광석, 동물, 인간을 맵 전체에 지능적으로 배치(Initialize World)합니다.