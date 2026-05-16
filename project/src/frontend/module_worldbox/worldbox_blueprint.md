# WorldBox Module - Architecture Blueprint

본 문서는 `module_worldbox`의 핵심 아키텍처 및 게임 시스템의 상세 구현 구조를 정의합니다. ECS(Entity-Component-System) 패턴을 기반으로 한 시스템별 동작 원리를 10개의 핵심 도메인으로 나누어 설명합니다.

---

## 1. 국가 시스템 (Nation System)
*   **관련 파일:** `NationSystem.js`, `SocialSystem.js`
*   **구현 상세:** 
    *   개별 `Civilization` 컴포넌트가 소속 국가 ID를 가지며, 국가 간의 외교적 관계나 세력 버프를 시뮬레이션합니다. 
    *   인간(엔티티) 간의 사회적 평판과 상호작용도 연계되어 관리되며, 향후 전쟁이나 동맹 같은 거시적 이벤트의 기반 데이터로 활용됩니다.

## 2. 마을 시스템 (Village System)
*   **관련 파일:** `VillageSystem.js`, `ZoneManager.js`
*   **구현 상세:**
    *   마을 단위의 총 인구, 보유 자원, 영토 범위를 총괄 관리합니다. 
    *   주택 수용량이 부족해지면 자동으로 거주구역 청사진을 배치하여 마을을 확장(Expansion)시키는 자율 로직이 포함되어 있습니다.
    *   `ZoneManager`를 통해 마을 주변의 활동 영역과 자원 채집 구역을 논리적으로 파티셔닝하여 AI의 활동 반경을 제어합니다.

## 3. 촌장 시스템 (Chief/Mayor System)
*   **관련 파일:** `ChiefRole.js` (Role 시스템 내장)
*   **구현 상세:**
    *   촌장이라는 별도의 무거운 시스템이 아닌, 개체의 직업(Role) 중 하나로 경량화되어 구현되어 있습니다.
    *   마을의 방향성이나 자원 소모 우선순위에 영향을 주는 의사결정 전략(Strategy Pattern)을 내포하여, 다른 구성원들의 작업 효율이나 타겟팅에 간접적인 버프/지시를 내리는 형태로 캡슐화되어 있습니다.

## 4. 직업 시스템 (Job/Role System)
*   **관련 파일:** `JobController.js`, `RoleFactory.js`, `ArchitectRole.js`, `LoggerRole.js` 등
*   **구현 상세:**
    *   `JobController` 컴포넌트가 엔티티의 작업 활동 범위(`zoneId`)와 세부 직업 상태를 관리합니다.
    *   직업별 행동 전략을 별도의 Role 클래스로 분리하여 유연성을 높였습니다. 
    *   각 직업은 자신이 수집해야 할 자원의 '속성(Category)' 기반으로 목표를 탐색하여 지능적으로 작업 우선순위를 결정합니다.

## 5. 상태 시스템 (State/Behavior System)
*   **관련 파일:** `State.js` (Component), `WanderState.js`, `GatherState.js`, `BuildState.js` 등
*   **구현 상세:**
    *   유한상태기계(FSM, Finite State Machine) 아키텍처를 근간으로 합니다.
    *   각 엔티티는 현재 행동 상태(`mode`), 타겟 ID, 그리고 행동의 복원을 위한 상태 스택(`modeStack`)을 유지합니다.
    *   각각의 구체적인 행동(방황, 채집, 건축 등)은 별개의 상태 클래스로 완전히 분리되어 엔진 업데이트 루프에서 독립적으로 로직이 실행됩니다.

## 6. 채집과 드롭, 줍기 (Gathering, Dropping, Picking up)
*   **관련 파일:** `GatheringSystem.js`, `GathererComponent.js`, `DroppedItem.js`, `PickupState.js`
*   **구현 상세:**
    *   벌목이나 사냥, 전투 완료 시 **`drops: []` 배열 기반의 표준화된 시스템**을 통해 아이템을 월드에 드롭합니다.
    *   드롭된 자원은 `DroppedItem` 컴포넌트를 가지며, 식용, 건축용 등 기능적 분류(`category`) 속성을 내포합니다.
    *   AI는 이 속성을 인지해 자신이 필요한 자원임을 파악하고(`PickupState`), 인벤토리로 주워 담아 창고나 건설 현장으로 운반합니다.

## 7. 자연물 (Nature)
*   **관련 파일:** `ResourceNode.js`, `TerrainGen.js`, `NatureFactory.js`, `TreeRenderer.js` 등
*   **구현 상세:**
    *   `TerrainGen`을 통한 지형 생성 완료 후, `SpawnerSystem`이 환경 비옥도와 밀도 설정에 맞춰 식생을 절차적으로 배치합니다.
    *   자원 노드는 채집 가능 여부와 잔여량을 관리하며, 소진 시 파괴됩니다.
    *   `NatureRenders`를 통해 바람에 의한 흔들림, 계절 변화, 배설물 분해 등의 환경 시각 효과가 절차적 렌더링으로 부여됩니다.

## 8. 동물 (Animal)
*   **관련 파일:** `CarnivoreBrain.js`, `BeeBrain.js`, `AnimalBehaviorSystem.js`, `AnimalRenders.js`
*   **구현 상세:**
    *   종(Species)별 특성에 따라 두뇌(`Brain`) 구조가 세분화되어 고유의 생태(육식동물의 사냥, 벌의 수분/꿀 채집 등)를 자율적으로 시뮬레이션합니다.
    *   허기, 피로, 수명 등의 생명주기(`Metabolism`) 시스템의 통제를 받아, 배가 고프면 사냥하거나 풀을 뜯는 등 동기 기반(Motivation-driven) 행동을 수행합니다.

## 9. 인간 (Human)
*   **관련 파일:** `HumanBrain.js`, `HumanBehaviorSystem.js`, `HumanFactory.js`
*   **구현 상세:**
    *   시뮬레이션 내 가장 복잡한 로직을 수행하는 엔티티입니다.
    *   소속 마을과 국가, 부여받은 직업(Role)을 바탕으로 사회 활동을 수행합니다.
    *   기술 발전, 건물 건축, 농사, 번식(`ReproductionSystem`) 등 상위 시스템의 상호작용 통제를 받아 문명을 이룩합니다.

## 10. 건물 (Building)
*   **관련 파일:** `Structure.js`, `Housing.js`, `Storage.js`, `ConstructionSystem.js`
*   **구현 상세:**
    *   완공 여부와 내구도를 관리하는 `Structure` 컴포넌트를 기반으로 합니다.
    *   용도에 따라 수용량을 관리하는 `Housing`(거주구), 자원 보관용 `Storage`(창고) 컴포넌트가 추가로 결합되어 기능이 결정됩니다.
    *   초기에는 빈 청사진 상태로 스폰되며, 건축가(Architect/Builder)들이 자원을 투입하여 내구도를 채우면 완공 처리(`ConstructionSystem`)되는 생명주기를 가집니다.

---

## 11. Root & Config (루트 및 문서)
### 11.1 Entry & Registration
- `index.js`: `module_worldbox`의 엔트리 포인트로, 모듈 초기화 및 외부 프론트엔드 환경(Vue, Router 등)과의 통합을 담당합니다.
- `ToolRegistry.js`: 사용자가 월드와 상호작용할 수 있도록 하는 도구(신의 권능, 지형 브러시, 스폰 툴 등)들을 중앙에 등록하고 메타데이터를 관리합니다.
### 11.2 Documentation
- `worldbox_blueprint.md`, `worldBoxTodo.md`, `worldBoxTodoDone.md`, `biome_resources_blueprint.md`: 기획 의도, 시스템 설계 구조, 앞으로 구현해야 할 최적화 목표 및 진행 상황을 추적하는 개발 문서입니다.

## 12. Core Engine (핵심 엔진 및 매니저) - `engine/core`
### 12.1 ECS Control
- `Engine.js`: 브라우저의 `requestAnimationFrame`을 이용해 전체 게임의 메인 틱(Tick) 루프를 돌리는 심장부입니다. 초기 설정부터 각 시스템의 업데이트 순서를 제어합니다.
- `SystemManager.js`: 등록된 여러 로직 시스템들을 `PRE_UPDATE`, `UPDATE`, `POST_UPDATE`, `RENDER` 등의 생명주기 페이즈(Phase)에 맞춰 순차적으로 실행시키는 오케스트레이터입니다.
- `EntityManager.js`: 메모리상에 엔티티 객체를 생성/삭제하고 필요한 컴포넌트를 부착하거나 제거합니다. 특정 컴포넌트 조합을 가진 엔티티를 고속 탐색하기 위한 인덱싱 처리도 담당합니다.
- `Component.js`, `System.js`: ECS 패턴의 가장 뼈대가 되는 추상화 인터페이스를 정의합니다.
### 12.2 Global Systems
- `EventBus.js`: 시스템 간의 결합도를 낮추기 위한 전역 Pub/Sub 이벤트 버스입니다. (예: 타겟 할당, 개체 사망, 건물 완공 등의 이벤트를 중계)
- `Camera.js`: 플레이어의 시야 이동과 줌인/줌아웃을 처리하며, 화면 밖(Frustum) 대상을 렌더링에서 제외하기 위한 뷰포트 영역(AABB)을 계산합니다.
- `StatsMonitor.js`: 렌더링 소요 시간, 프레임 레이트(FPS), 엔티티 수 등을 실시간 추적하여 성능 병목 지점을 모니터링합니다.
### 12.3 Interface
- `ToolManager.js`: 마우스/터치 입력과 `ToolRegistry`에 등록된 브러시 동작을 매핑하여 실제 월드에 지형 조작이나 유닛 스폰을 명령합니다.
- `UISystem.js`: 게임 내부 시뮬레이션 데이터를 Vue 스토어 상태로 푸시하여 프론트엔드 UI 화면에 마을 통계나 인구 정보가 실시간 반영되게 합니다.

## 13. Components (ECS 데이터 구조체) - `engine/components`
*오직 데이터(State)만을 보관하는 컨테이너들입니다.*
### 13.1 AI & Behavior (`behavior/`)
- `State.js`, `Target.js`: 현재 AI가 실행 중인 행동 상태(`Wander`, `Gather` 등)와 쫓고 있는 타겟의 위치 및 참조 데이터를 보관합니다.
- `JobController.js`: 소속 마을 내에서 할당받은 작업 구역(`zoneId`)과 작업 진행 상황 데이터를 저장합니다.
### 13.2 Civilization (`civilization/`)
- `Builder.js`, `Structure.js`: 건축 속도, 건물 완공 진행률(HP), 건물 종류 등 구조물 데이터입니다.
- `Door.js`, `Housing.js`, `SocialComponent.js`, `TechLevel.js`: 주거지의 거주민 목록, 인구 수용 한계, 소속 국가 및 기술력(기여도)을 기록합니다.
### 13.3 Environment & Motion
- `environment/`: `MineralDensity.js`, `SoilFertility.js`, `WaterQuality.js` 등 해당 타일의 비옥도 및 자원 밀도 파라미터.
- `motion/`: `Transform.js`(x, y 위치 및 회전각), `Velocity.js`(현재 이동 속도 및 방향 벡터).
- `render/`: `Trail.js`, `Visual.js` (스프라이트 애니메이션 프레임, 시각적 잔상 데이터).
### 13.4 Resource & Stats
- `resource/`: `DroppedItem.js`, `Inventory.js`, `Resource.js`, `Storage.js` 등 자원의 종류(`category`), 채집 가능 여부, 창고의 보관량 정보를 담습니다.
- `stats/`: `Age.js`(나이 및 수명), `BaseStats.js`(기본 체력/이속), `Digestion.js`(소화 진행도), `Health.js`(현재 체력) 등 생명 유지 파라미터. `TagBitmask.js`는 비트 연산을 통한 고속 객체 속성 분류기입니다.

## 14. Systems (ECS 로직) - `engine/systems`
*컴포넌트 데이터를 기반으로 실질적인 게임 규칙과 상태 변화를 시뮬레이션하는 비즈니스 로직 계층입니다.*
### 14.1 Behavior & AI (`behavior/`)
- `AnimalBehaviorSystem.js`, `HumanBehaviorSystem.js`: 틱마다 개체의 두뇌(`Brain`)를 호출하여 다음 상태 전이를 결정하는 FSM(유한상태기계) 드라이버 시스템입니다.
- `TargetManager.js`: 여러 개체가 동일한 자원으로 몰리는 것을 방지하기 위한 중앙 타겟 할당/조율 시스템입니다.
- `CombatSystem.js`, `DeathProcessor.js`: 공격 사거리, 피해량 연산을 수행하고 개체 사망 시 아이템 드롭(`drops` 배열 처리) 및 객체 해제를 처리합니다.
- `brains/` & `sensors/`: 종족별 행동 우선순위를 정하는 AI 두뇌와 시야 내 먹이/위협을 탐지하는 센서 로직입니다.
- `states/`: `WanderState`, `BuildState`, `GatherState` 등 구체적으로 '이동', '망치질', '채집 모션'을 실행하는 단일 행동 처리 로직들입니다.
### 14.2 Civilization & Economy
- `civilization/`: `ConstructionSystem.js`(건설 진척도 연산 및 완공 처리), `VillageSystem.js`(마을 자율 확장 로직 및 인구/영토 관리), `NationSystem.js`(외교 및 국가 소속 처리), `ZoneManager.js`(마을 근처 자원 채집 구역 설정).
- `economy/`: `SpawnerSystem.js`(초기 지형에 동식물을 자동 스폰), `GatheringSystem.js`(채집 로직 처리), `ConsumptionSystem.js`(자원 소모 시뮬레이션).
- `roles/`: `ArchitectRole`, `ChiefRole`, `LoggerRole` 등 직업별 고유한 작업 타겟 탐색 전략(Strategy Pattern)을 내포한 클래스들입니다.
### 14.3 Lifecycle, Motion & Render
- `lifecycle/`: `MetabolismSystem.js`(허기 증가 및 소화), `ReproductionSystem.js`(Batch 방식의 번식 및 아기 스폰), `EmotionSystem.js`(스트레스 및 만족도 연산) 등 생태계 유지 로직.
- `motion/`: `KinematicSystem.js`(속도를 위치에 적용하고 SpatialHash 셀 업데이트), `CollisionSystem.js`(객체 간 물리 충돌 해소).
- `render/`: `RenderCoordinator.js`, `EntityRenderer.js` 등 실제 캔버스(Canvas API)에 이미지를 그리고 카메라 스케일에 맞춘 LOD 렌더링을 지시합니다.
### 14.4 Input & Tools
- `input/`: `InputSystem.js` - 마우스 이벤트(클릭, 드래그)를 게임 좌표계로 변환하여 ToolManager에 전달합니다.
- `tools/brushes/`: 사용자 클릭 시 지형을 어떻게 변경할지 결정하는 브러시 모양별(Draw, Fill, Spray) 연산 로직.

## 15. Factories (엔티티 생성 파이프라인) - `engine/factories`
### 15.1 Core Factory
- `FactoryProvider.js`, `EntityBuilder.js`: 체이닝 방식으로 컴포넌트를 조립하여 엔티티를 쉽게 생성하는 중앙 빌더 패턴 코어입니다.
### 15.2 Entity Factories
- `HumanFactory.js`, `AnimalFactory.js`, `NatureFactory.js` 등: 생성될 때 종족별 JSON 설정 파일(Config) 값을 읽어와 체력, 시야, 드롭 아이템 등의 초기 데이터를 세팅하고 엔진에 투입하는 팩토리 클래스입니다.

## 16. World (지형 및 공간 파티셔닝) - `engine/world`
### 16.1 Chunk & Rendering
- `Chunk.js`, `ChunkManager.js`: 거대한 월드 맵을 정해진 크기(예: 512x512)의 청크(타일 조각) 단위로 쪼개어 화면에 보일 때만 렌더링(캐싱)하여 드로우 콜을 비약적으로 줄이는 최적화 모듈입니다.
### 16.2 Terrain & Zone
- `TerrainGen.js`, `WorldLayers.js`: Perlin Noise 알고리즘 등을 기반으로 고도, 수심, 온도 등의 레이어 데이터를 절차적으로 생성해 자연스러운 대륙과 바이옴 지형을 만듭니다.

## 17. Utilities (유틸리티 및 최적화 도구) - `engine/utils`
### 17.1 Math & Logic
- `MathUtils.js`, `GridUtils.js`: 삼각함수 보정, 벡터 연산, 오토타일링(Auto-tiling) 인덱스 계산 등 수학적 유틸리티 모음입니다.
### 17.2 Optimization & Algorithms
- `SpatialHash.js`: 2D 평면 공간을 격자로 분할(Spatial Partitioning)해 O(1) 수준의 고속 객체 근접 탐색(충돌, 시야)을 지원하는 핵심 자료구조입니다.
- `Pathfinder.js`: 장애물과 물을 우회해 최적의 경로를 찾는 A* 및 HPA*(계층적 길찾기) 알고리즘 구현체입니다.
- `ObjectPool.js`: 빈번히 생성되고 파괴되는 단발성 객체들을 재활용하여 가비지 컬렉터(GC) 부하를 방지합니다.

## 18. Renders (시각화 및 렌더링 세부) - `engine/objects/renders`
### 18.1 Render Coordinators
- `AnimalRenders.js`, `BuildRender.js` 등: 카테고리에 속한 개별 객체 렌더러들을 총괄하여 알맞은 그리기 함수를 분기 처리합니다.
### 18.2 Specific Renderers
- `animals/` & `nature/`: `HumanRenderer.js`, `TreeRenderer.js`, `WolfRenderer.js` 등 각 개체별 실제 캔버스 `ctx.drawImage` 호출, 신체 파츠 조합, 애니메이션 프레임 계산 및 계절/상태에 따른 외형 변화를 픽셀 단위로 구현하는 구체적인 렌더링 스크립트입니다.

## 19. Configuration (설정 데이터) - `engine/config`
### 19.1 Databases & JSON
- `biomes.json`, `buildings.json`, `resource_balance.json`, `species.json` 등: 하드코딩을 피하기 위해 자원의 가치, 체력, 수명, 식용 여부(`category`), 스폰 밀도 등을 정의해둔 정적 밸런싱 데이터베이스입니다.
### 19.2 Enums & Constants
- `JobTypes.js`, `VillageTypes.js`: 상태 기계나 직업 분류에서 문자열 오타 방지를 위해 사용하는 열거형 상수 집합입니다.

## 20. UI & Store (사용자 인터페이스 및 스토어) - `ui`
### 20.1 Components
- `MapSettings.vue`: 게임 시작 전 맵 사이즈, 해수면 비율, 생태계 밀도를 조절하는 Vue 환경설정 컴포넌트입니다.
- `EntityStatusPanel.vue`, `VillageDetailPanel.vue`: 게임 플레이 중 클릭된 유닛의 HP/나이/직업 또는 마을의 총 인구수 및 창고 현황을 화면에 시각적으로 뿌려주는 정보창 UI입니다.
### 20.2 Store & View
- `worldboxStore.js`: Pinia(Vuex) 스토어로, 엔진의 상태(선택된 엔티티 ID 등)와 Vue 컴포넌트 간의 단방향 데이터 바인딩을 매개합니다.
- `WorldboxView.vue`: 캔버스 엔진과 모든 UI 컴포넌트를 감싸고 있는 최상위 화면(Page) 컴포넌트입니다.

---

## 21. 리팩토링 기대 효과 (Expected Effects of SOLID Refactoring)
`worldBoxTodo.md`에 정의된 18, 19, 20단계의 SOLID 원칙 기반 리팩토링이 수행되었을 때 기대되는 아키텍처 개선 효과입니다.

### 18단계: 자원 및 건축 시스템 분리 (Data & Logic Decoupling)
*   **응집도(Cohesion) 향상:** `Inventory`는 순수 데이터 보관 컨테이너로써의 단일 책임(SRP)만 가지게 되며, 자원 유사어 및 카테고리 검증 로직은 `ResourceRegistry`로 이관되어 관리가 용이해집니다.
*   **유연성(Flexibility) 확보:** 건물 종류에 따른 필요 자원 조건이 하드코딩되지 않고 `BlueprintRegistry` 데이터로 관리되므로, 새로운 건물이나 자원 타입을 추가할 때 핵심 AI 시스템(`ArchitectRole` 등) 코드를 전혀 수정할 필요가 없어져 OCP(개방-폐쇄 원칙)를 달성합니다.

### 19단계: AI 타겟 탐색 시스템의 전략 패턴 적용 (Strategy Pattern)
*   **확장성(Scalability) 극대화:** `TargetManager` 내의 거대한 분기문(`switch`)이 제거됨에 따라, 향후 '적군 침략 탐색', '특정 이벤트 타겟 탐색' 등 새로운 탐색 행동이 필요할 때 기존 코드를 건드리지 않고 새로운 `TargetStrategy` 클래스만 등록하면 됩니다.
*   **복잡도 감소 및 단일 책임(SRP) 달성:** 수백 줄에 달하던 거대한 자원/창고/청사진 탐색 알고리즘이 각각 독립된 파일로 분할되어, 디버깅과 테스트가 매우 쉬워지며 시스템 매니저 본연의 역할(요청 분배)에만 집중할 수 있게 됩니다.

### 20단계: ECS 렌더링 로직 분리 (Presentation & Logic Separation)
*   **관심사 분리(SoC) 완벽 달성:** 데이터 시뮬레이션을 담당하는 비즈니스 시스템(`VillageSystem`, `ZoneManager`)에서 Canvas API 렌더링 로직이 완전히 분리되어, State(상태)와 View(표현)를 분리하는 Data-Oriented Design 및 ECS의 기본 철학을 엄격히 준수하게 됩니다.
*   **유지보수 및 렌더링 최적화 안전성 확보:** 화면을 그리는 로직이 전용 Overlay 렌더러(`VillageOverlayRenderer`, `ZoneOverlayRenderer`)로 분리되므로, UI 연출 변경이나 렌더링 최적화(예: 오프스크린 렌더링) 작업 시 핵심 비즈니스 로직에 부작용(Side-effect)을 일으킬 위험 없이 안전하게 뷰(View) 레이어만 수정할 수 있습니다.
