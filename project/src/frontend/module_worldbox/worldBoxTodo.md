# 🌍 WorldBox 모듈 리팩토링 및 고도화 계획서 (WorldBox Todo)

본 문서는 `worldbox_blueprint.md`의 초기 설계 사상을 복구하고, 현재 얽혀있는 스파게티 코드를 순수 **ECS (Entity-Component-System)** 아키텍처로 리팩토링하기 위한 진단 및 단계별 실행 계획입니다.

---

## 1. 🚨 현재 구조 및 문제점 진단 (Current State Analysis)

### 1.1 설계 의도 (ECS Pattern)
*   **Entity:** 고유 ID를 가진 빈 껍데기 객체.
*   **Component (`components/`):** 로직이 전혀 없는 순수한 '데이터(상태) 묶음' (예: 위치 좌표, 체력, 인벤토리).
*   **System (`systems/`):** 매 프레임마다 특정 Component들을 가진 Entity들을 찾아 '비즈니스 로직'을 실행하는 주체.

### 1.2 현재 구현의 치명적인 문제점 (Anti-Patterns)
1.  **System들의 독립성 파괴 (Engine 의존성 심화)**
    *   정상적인 ECS라면 System은 `Entity`의 `Component`만 읽고 써야 합니다.
    *   하지만 현재 `SpawnerSystem.js`, `ReproductionSystem.js` 등은 `this.engine.particles.push()` 처럼 **엔진의 그래픽(Render) 배열에 직접 개입**하거나 `this.engine.updateFertilityStat()` 처럼 **UI/통계 메서드를 직접 호출**하고 있습니다.
2.  **Engine.js의 비대화 (God Object)**
    *   게임 루프만 돌려야 할 `Engine.js`가 마우스 클릭 이벤트(`setupInput`), 객체 선택 로직(`handleSelect`), UI 데이터 변환(`getEntityData`), 심지어 파티클 렌더링 배열(`particles`)까지 모두 관리하고 있습니다.
3.  **기본 뼈대(Base Class)의 부재**
    *   `Component.js`와 `System.js`가 텅 비어있어, 각 개발자가 중구난방으로 객체를 다루고 있습니다.

---

## 2. 🛠️ 아키텍처 개선 방안 (Improvement Strategy)

### 2.1 완벽한 계층 분리 (Decoupling)
*   **이벤트 버스(EventBus / Message Queue) 도입:** 시스템은 더 이상 엔진을 직접 조작하지 않습니다. 예를 들어 동물이 교미할 때 파티클이 필요하다면 `EventBus.emit('SPAWN_PARTICLE', {x, y, type: 'heart'})` 이벤트만 던지고 끝냅니다. 이를 `ParticleSystem`이 받아서 화면에 그립니다.
*   **Input 시스템 분리:** `Engine.js`에 있는 마우스 이벤트를 `InputSystem`으로 빼내어 **Command 패턴**으로 전환합니다. (이미 `ToolRegistry.js`에서 일부 개선 시작됨).

### 2.2 ECS 인터페이스 강제 (Standardization)
*   `System.js`에 공통 부모 클래스를 구현하여 `update(deltaTime, entityManager)` 시그니처를 강제합니다.
*   `Component.js`에 데이터 직렬화/역직렬화 규격을 마련하여 나중에 저장/불러오기가 가능하게 합니다.

---

## 3. 🚀 단계별 리팩토링 및 개발 마일스톤 (Action Plan)

*(Phase 1 ~ Phase 5의 모든 작업이 완료되어 `worldBoxTodoDone.md`로 이관되었습니다.)*

### Phase 6: 동적 생태계 및 지형별 자원 확장 (Blueprint 5.0 구현)
*(상세 설계: `biome_resources_blueprint.md` 참조)*

#### 6.1 데이터 및 스키마 중앙화 (Data Configuration)
- [x] `engine/config/biomes.json` 업데이트: 각 지형 데이터에 확산 및 스폰 기준 특성값(`baseSoilFertility`, `waterQuality`, `mineralDensity`) 스키마 추가.
- [x] `engine/config/resource_balance.json` 업데이트: 설계된 모든 신규 자원(심해 해조류, 소금, 점토, 사금, 부싯돌, 구리, 흑요석, 석탄, 철광석, 금, 보석 등)의 ID, 자원량(Capacity), 채집 난이도 수치 등록.

#### 6.2 환경 컴포넌트 및 타일 적용 (Environment Components)
- [x] 신규 컴포넌트 생성 또는 확장: 타일 엔티티에 부착할 `SoilFertility`, `WaterQuality`, `MineralDensity` 컴포넌트 구현.
- [x] 지형 생성 시(`TerrainGen` 또는 `ChunkManager`), 타일의 고도/온도/습도에 맞춰 상기 3가지 기반 수치 컴포넌트를 타일 엔티티에 할당. (구현 완료)

#### 6.3 환경 확산 시스템 구현 (Biome Spread System)
- [ ] `systems/lifecycle/EnvironmentSystem.js` (또는 `BiomeSpreadSystem.js`) 신규 개발.
- [ ] 흙(`DIRT`) 타일의 `SoilFertility` 수치를 읽어 주변으로 생태계(GRASS, JUNGLE)가 퍼져나가는 확산 로직 구현 (ECS 원칙: 데이터만 변경).
- [ ] 비옥도가 0인 척박한 지형은 확산이 원천 차단되도록 조건부 로직 추가.

#### 6.4 자원 동적 스폰 시스템 적용 (Resource Spawner & Factory)
- [ ] `factories/ResourceFactory.js` 수정: `ResourceNode`의 `capacity`(자원량)를 생성 지점 타일의 기반 수치(비옥도/수질/광맥밀도)에 정비례하도록 조립 로직 변경.
- [ ] `systems/economy/SpawnerSystem.js` 고도화: 
  * 육상 지형: 토양 비옥도에 비례한 식생 스폰 및 용량 결정.
  * 수생 지형: 수질에 따른 해조류/수초/사금 등 자연 스폰.
  * 산악 지형: 광맥 밀도에 비례한 철광석, 석탄, 금, 보석 확률 스폰.
- [ ] 스폰 완료 후 UI/통계 갱신 시 `Engine` 직접 호출 대신 `EventBus.emit('RESOURCE_SPAWNED', ...)` 이벤트 발송으로 결합도 해소.

#### 6.5 자원 채집 및 소멸 로직 완비 (Gathering System)
- [ ] `systems/economy/GatheringSystem.js` 수정: 동적 할당된 `ResourceNode.capacity`를 틱당 소모시키고 `Inventory`를 증가시키는 채집 연산 처리.
- [ ] 자원 고갈(capacity <= 0) 시 `EntityManager.removeEntity()` 호출로 엔티티 소멸 처리.
- [ ] 자원 파괴 시 시각 효과 처리를 위해 `EventBus.emit('SPAWN_PARTICLE')` 발송 로직 추가.

---

## 4. 작업 지침 (Development Rules)

1. **System에서 `this.engine` 접근 금지:** System은 생성자에서 주입받은 `EntityManager`와 `EventBus`만 사용해야 합니다.
2. **Component 내부에 메서드 구현 금지:** 컴포넌트는 단순 JSON 직렬화가 가능할 정도의 순수 변수 묶음(Data Object)이어야 합니다.
3. **UI는 반응형으로 구축 (Vue 3 Pinia 연동):** 화면의 상태창 등은 WorldBox 모듈이 쏘아주는 Event를 Pinia Store가 수신하여 반응형(Reactive)으로 렌더링되게 합니다. `WorldBox` 코어 엔진 내부에서 HTML DOM을 직접 조작해선 안 됩니다.

---

## 5. 🛡️ ECS 원칙 절대 준수 및 아키텍처 방어 방안 (Strict ECS Enforcement)

초기 설계가 무너지는 것을 방지하기 위해, 팀 내 규약 및 구조적 강제성을 둡니다.

1.  **의존성 격리 (Dependency Isolation):**
    *   `systems/logic/` 하위의 파일들은 어떠한 경우에도 `Engine.js`, `Canvas API`, UI 컴포넌트를 `import` 하거나 참조해선 안 됩니다.
    *   의존성 규칙을 어길 시 코드 리뷰에서 반려하거나, 향후 ESLint의 `no-restricted-imports` 규칙을 도입하여 물리적으로 차단합니다.
2.  **시스템 간 직접 통신 금지 (No Direct System Calls):**
    *   `System A`가 `System B`의 메서드를 직접 호출하는 것을 엄격히 금지합니다.
    *   **(올바른 예 1):** System A가 Entity의 Component 값을 변경해두면, 다음 프레임에 System B가 그 변경된 값을 스스로 읽어 처리합니다.
    *   **(올바른 예 2):** 공간을 넘나드는 즉각적인 이벤트(예: 낙뢰 발생)가 필요하다면 `EventBus.emit()` 메세징을 사용합니다.
3.  **컴포넌트 순수성 검증 (Component Purity):**
    *   Component 클래스는 `constructor()` 외의 비즈니스 로직(메서드)을 절대 가질 수 없습니다. `JSON.stringify()`를 돌렸을 때 모든 상태값이 온전히 출력되는 순수한 데이터(Data Object)의 형태를 유지해야 합니다.

---

## 6. 🔧 추가 유지보수 및 고도화 식별 사항 (Additional Maintenance & Enhancements)

1.  **오브젝트 풀링 (Object Pooling) 도입 (성능 최적화):**
    *   생태계 특성상 동/식물이 번식하고 죽거나 파티클이 무수히 생성/삭제되는데, 이때 발생하는 **가비지 컬렉션(GC) 멈춤 현상(Spike)**을 방지해야 합니다.
    *   `EntityManager` 내부에 파괴된 Entity ID와 Component 메모리를 버리지 않고 큐(Queue)에 담아두었다가 재활용하는 **Pool 구조**를 향후 도입합니다.
2.  **상태 스냅샷 저장 및 복원 (Save/Load State):**
    *   ECS의 장점인 "데이터(Component)와 로직(System)의 완벽한 분리"를 활용하여, 현재 시뮬레이션의 모든 생명체 상태를 직렬화(Serialization)해 브라우저의 `IndexedDB`에 저장하거나 불러오는 기능을 구현합니다.
3.  **TDD 기반 시스템 단위 테스트 (Unit Testing):**
    *   비즈니스 로직이 UI 및 렌더링과 격리됨에 따라, 화면을 띄우지 않고 로직만 검증할 수 있게 됩니다.
    *   `MetabolismSystem`, `ReproductionSystem` 등에 모의(Mock) Entity 데이터를 주입하여 한계치나 대사량이 프레임 틱(Tick)마다 정상 소모되는지 1초 만에 검증하는 테스트(Vitest) 환경을 구축할 수 있습니다.