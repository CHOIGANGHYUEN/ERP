# WorldBox Module - Components Architecture Blueprint

이 문서는 `module_worldbox` 내의 ECS(Entity-Component-System) 아키텍처 중 **Component(데이터 구조체)**들의 역할과 관계를 정의합니다.
모든 컴포넌트는 비즈니스 로직을 최대한 배제하고 순수한 상태(데이터)만을 보관하는 것을 원칙으로 합니다.

## 1. 컴포넌트 디렉토리 구조 및 역할

### 🧠 Behavior (행동 AI)
- **State.js (`AIState`)**: 개체의 현재 유한 상태 기계(FSM) 상태(`mode`), 상호작용 중인 타겟 ID, 행동 타이머 및 상태 스택(인터럽트 복구를 위한 `modeStack`)을 저장합니다. 
  - **최적화 속성**: 타겟으로의 경로 탐색 실패 횟수(`failedPathCount`)와 일시적 무시 대상 목록(`blacklist`)을 관리하여 길찾기 연산 낭비를 방지합니다.
- **Target.js (`Target`)**: 개체가 현재 목표로 하고 있는 대상의 고유 ID, 타입, 월드 좌표 등 추적 정보를 캐싱합니다.
- **JobController.js (`JobController`)**: 개체에 부여된 직업(`currentJob`), 할당된 활동 구역(`zoneId`), 직업 내 세부 상태를 관리합니다. 생존 욕구 발생 시 현재 작업을 중단(Interrupt)하고 다른 상태를 우선하도록 제어하는 역할을 돕습니다.

### 🏛️ Civilization (문명 및 건축)
- **Builder.js (`Builder`)**: 개체의 건축 가능 여부 및 건축 수행 속도를 관리합니다.
- **Structure.js (`Structure`)**: 건설 중인 청사진이거나 완성된 건물의 종류, 완성도(progress), 내구도(hp/maxHp) 및 소속 마을 정보를 담습니다.
- **Housing.js (`Housing`)**: 주거용 건물의 소유주, 거주자(resident) ID 목록, 최대 수용 인원(capacity) 및 거주 만족도(quality)를 관리합니다.
- **Door.js (`Door`)**: 울타리 문이나 출입구의 개폐 상태(`isOpen`) 및 자동 닫힘 딜레이 시간을 관리합니다.
- **TechLevel.js (`TechLevel`)**: 군락(세력)의 기술 발전 수준, 총 인구수, 누적 채집 자원량, 생존 시간 등을 추적하여 시대 발전을 제어하는 기반 데이터입니다.
- **SocialComponent.js (`SocialComponent`)**: 엔티티의 소속 국가(Nation), 소셜 지위, 평판 등을 관리합니다.

### 🌍 Environment (환경 및 지형 속성)
- **MineralDensity.js**, **SoilFertility.js**, **WaterQuality.js**: 지형 타일의 광맥 밀도, 토양 비옥도, 수질 등을 0.0 ~ 1.0 사이의 수치로 나타내는 순수 환경 데이터 래퍼입니다.

### 🏃 Motion (물리 이동)
- **Transform.js (`Transform`)**: 엔티티의 월드 상 물리적 2D 좌표(x, y)를 저장합니다.
- **Velocity.js (`Velocity`)**: 이동 속도 및 방향 벡터를 저장합니다.

### 🎨 Render (렌더링 및 시각화)
- **Visual.js (`Visual`)**: 렌더링 타입, 색상, 알파(투명도), 크기를 결정합니다. 더불어 FSM 상태(`wander`, `walk`, `run`, `eat` 등)별 애니메이션 메타데이터와 시각적 상태 플래그(`isEating`, `isSleeping` 등)를 관리합니다.
- **Trail.js (`Trail`)**: 이동 궤적 시각화 및 이펙트를 위한 데이터 구조입니다.

### 🪵 Resource (자원 및 경제)
- **Resource.js / ResourceNode.js (`Resource`)**: 필드에 스폰된 채집 가능한 자원의 종류, 잔여량, 최대량, 식용/광물 여부 플래그를 가집니다. `ResourceNode`의 경우 채집 시 데이터 차감과 시각적 파티클 생성(이벤트 발행)을 스스로 캡슐화하여 처리합니다.
- **Inventory.js (`Inventory`)**: 개체가 소지하고 있는 자원(wood, food, stone 등)별 현재 수량과 최대 가방 용량(capacity)을 관리합니다.
- **Storage.js (`Storage`)**: 마을 창고 등 거점 건물의 대규모 아이템 보관 상태를 관리하며, 가득 참(`isFull`) 여부 확인 및 재고 변동 이벤트 알림을 수행합니다.
- **Gatherer.js / GathererComponent.js**: 타겟 자원 엔티티로부터 자원을 추출(채집)하는 속도 설정과 실제 채집 로직 실행 메서드를 보유합니다.
- **Wealth.js (`Wealth`)**: 골드 등 특정 재화의 획득 및 누적 소비량을 저장합니다.
- **DroppedItem.js (`DroppedItem`)**: 필드에 떨어진 아이템의 종류와 수량, 소멸 타이머를 관리합니다.

### 📊 Stats (능력치 및 생태 스탯)
- **BaseStats.js (`BaseStats`)**: 체력, 허기, 피로도, 식성(`diet`), 공격력, 방어력 등 핵심 파라미터를 관리합니다.
  - **부상 시스템(Injury)**: 피격 시 `injurySlowMultiplier`와 `injurySlowTimer`를 통해 2초간 이동 속도가 50% 느려지는 페널티를 적용하는 메커니즘을 가집니다.
- **Health.js (`Health`)**: 개체의 체력 상태, 피해 내역, 재생율 등을 전문적으로 관리하는 컴포넌트입니다.
- **Metabolism.js (`Metabolism`)**: 소화 속도, 위장 상태(stomach), 축적된 비옥도 및 배설(waste) 대기 상태를 관리하여 생태계 비옥도 순환의 핵심 데이터를 담당합니다.
- **Digestion.js (`Digestion`)**: 섭취한 음식물을 기반으로 포만감 회복 및 감정 상태를 증감시키는 세부 파라미터를 담당합니다.
- **Emotion.js (`Emotion`)**: 행복도, 스트레스, 충성도를 추적하고 전반적인 기분(mood)을 결정합니다.
- **Age.js (`Age`)**: 현재 나이, 최대 수명, 그리고 성장 단계를 기록합니다. (매 틱마다 `0.0013889`씩 나이가 증가하여 자연사 도달)
- **TagBitmask.js (`TagBitmask`)**: 엔티티의 카테고리 속성을 고속으로 분류하기 위한 마스크입니다.
- **Civilization (`Civilization`)**: 소속 마을 ID(`villageId`) 및 배정된 직업(`jobType`, `role`) 등 엔티티의 사회적 소속 정보를 담습니다.

---

## 2. 핵심 컴포넌트 도메인 간의 관계 (Architecture Dynamics)

### 🧬 생존 및 AI 행동 파이프라인
- **상태 평가**: `BaseStats`의 생존 수치(허기, 피로)가 임계치에 도달하면 Behavior 시스템이 이를 감지하여 `AIState`의 `mode`를 변경합니다 (예: 배회 중 피곤하면 `SLEEP`으로, 배고프면 `FORAGE`로 전이).
- **인터럽트 (Interrupt) 통제**: 장기 작업을 수행 중이더라도 생존 수치가 위험해지면 `AIState.pushMode()`를 통해 현재 상태를 스택(`modeStack`)에 보존하고 생존 모드를 강제 주입합니다. 생존 욕구가 해소되면 `popMode()`로 이전 작업으로 자동 복귀합니다.
- **타겟팅 인지**: 결정된 타겟은 TargetManager를 거쳐 `Target` 컴포넌트 정보 및 `AIState.targetId`로 업데이트됩니다. 도달할 수 없는 타겟은 60초마다 만료되는 `blacklist`에 등록하여 지속적인 길찾기 실패를 방지합니다.

### ♻️ 자원 순환 및 경제 파이프라인
- **채집과 이동 (`GatheringSystem`)**: 개체가 목표 자원 노드에 다가가 사거리 내(10px 이내)에 들면 `GathererComponent`의 로직이 동작하여 자원을 추출합니다. 육식동물의 경우 사거리 5px 이내에서 대상 체력을 차감하여 사망에 이르게 합니다. 획득된 양은 `Inventory`에 저장됩니다.
- **생태계 비옥도 순환 체계 (`MetabolismSystem`)**: 
  - 동물이 식용 자원을 먹으면 식물의 품질 기반 수치가 `BaseStats.storedFertility`에 비옥도로 축적됩니다.
  - 대사 작용을 거쳐 저장된 비옥도가 임계치(`15.0`)를 넘으면 `SPAWN_POOP` 이벤트를 통해 배설물(Resource)을 지면에 떨어뜨립니다.
  - 이 배설물은 시간이 지남에 따라 `TerrainGen`의 `fertilityBuffer`(최대 255)로 분해/환원되며, 이 지점에서 새로운 식물 자원이 자라나는 완벽한 제로섬(Zero-Sum) 순환을 이룹니다.
- **물자 비축**: 개체의 가방(`Inventory`)이 가득 차면 행동 AI는 촌락의 `Storage` 건물로 귀환하는 `DepositState` 모드로 전환하여 자원을 이관합니다.

### 🏗️ 건축 및 문명 발전 파이프라인
- **협동 건설**: 시스템이 지면 위에 `Structure`(isBlueprint = true)를 스폰시키면, `Builder` 속성을 가진 개체들이 자원을 소모하여 구조물의 완성도(progress)를 증가시킵니다.
- **상태 부여**: 완공 시 `isComplete = true`가 되며, 내부 개체는 밖으로 밀려나는 보정 처리와 함께 거주지(`Housing`) 할당이 이루어집니다.
- **문명 스케일업**: 군락의 `TechLevel`과 `Wealth`, `Storage` 자원이 종합 연산되어 다음 기술 시대(석기 ➔ 청동기 등) 해금 이벤트로 이어집니다.

---

## 3. 핵심 설계 원칙 및 가이드라인
1. **순수 데이터 객체 유지**: ECS 설계 원칙에 따라 컴포넌트는 직렬화 등의 기본 메서드를 제외한 복잡한 비즈니스 로직(행동 처리, 위치 갱신 등)을 직접 수행하지 않고 오직 **상태(데이터)의 저장소** 역할만 해야 합니다.
2. **컴포지션(Composition) 조립**: 상속보다는 컴포넌트들을 레고 블록처럼 조합하여 새로운 특성을 부여합니다. 
   * 예: '건축이 가능한 인간' = `AIState` + `BaseStats` + `Builder` + `Inventory` + `Emotion`

---

## 4. Systems - Behavior & AI Architecture (🧠 행동 및 의사결정 계층)

### 4.1. Core Managers (중앙 제어 및 관제)
- **BehaviorSystem (`HumanBehaviorSystem` 등)**: 
  - **LOD(Level of Detail) 최적화**: 카메라(`viewX`, `viewY`) 반경 내 보이는 개체는 2프레임마다 연산하고, 화면 밖 개체는 10프레임마다 연산(`updateModulo`)하여 렌더링/연산 비용을 극적으로 낮춥니다.
  - 전용 루프: `humanIds` 등의 전용 배열을 순회하여 캐스팅 비용을 최소화합니다.
- **TargetManager**: 타겟팅 요청을 비동기 큐(`pendingRequests`)에 쌓고 분할 처리하며, `claimedBy` 락(Mutex)을 걸어 중복 타겟팅을 차단합니다.

### 4.2. Sensors (환경 인지)
- **`FoodSensor` / `PredatorSensor`**: `SpatialHash`를 이용해 반경 내 엔티티를 고속 필터링합니다. 개체의 식성(`diet`)에 따라 먹이를 식별합니다.
- **`ZoneSensor`**: `JobController`에 할당된 구역(`zoneId`)을 기반으로 허가된 활동 구역 내부의 자원만을 필터링합니다.

### 4.3. Brains (의사결정 두뇌)
- **생존 최우선 판단**: `BaseStats`의 피로도 증가율은 시간대(낮/밤)에 따라 다르게 적용됩니다. (야간에는 피로도가 3배 빠르게 상승).
- **종족별 특화**: `HumanBrain`은 마을의 자원 상황을 파악하여 건설 모드(`build`)로 진입하거나 부여된 직업(`role.decide()`)에 따라 권장 상태(`suggestedMode`)를 시스템에 제안합니다.

### 4.4. 생명주기 및 대사 시스템 (`MetabolismSystem`)
- **Staggered LOD Update**: 화면 밖의 개체들은 매 프레임 대사 작용을 연산하지 않고, 개체 ID를 기반으로 분산하여 1초에 한 번만 누적된 시간(`lodDt`)을 곱하여 일괄 처리합니다. 이를 통해 프레임 드랍(Lag Spikes)을 근본적으로 방지합니다.

---

## 5. Entity Factories (엔티티 생성 팩토리 파이프라인)

### 5.1. Factory Architecture (구조)
- **`IEntityFactory` & `EntityBuilder`**: 빌더 패턴(`builder.withTransform().addComponent()`)을 활용해 컴포넌트 추가를 체이닝 방식으로 수행하여 가독성을 극대화합니다.

### 5.2. Domain Factories (도메인별 구현)
- **생물 팩토리 (`HumanFactory`, `AnimalFactory`)**: 
  - **성별 및 시각 보정**: 성별에 따라 `Visual` 색상(Male: Cyan 계열, Female: Pink 계열)을 달리하고, 아기 개체의 스케일(size: 0.6)을 조절합니다.
  - **스폰 보정**: 생성 좌표가 기존 건물(`Building`) 내부인지 `SpatialHash`로 검증하고 충돌 시 반경 내 빈 공간으로 좌표를 5회 재탐색하여 스폰 오류를 방지합니다.

---

## 6. 고성능 렌더링 파이프라인 (🎨 Rendering System)

### 6.1. 캐싱 및 동적 렌더링
- **Sprite Caching**: 상태와 프레임이 동일한 개체는 `spriteCache` 캔버스에 캐싱하여 O(1) 수준으로 렌더링합니다.
- **8-Directional Motion**: 방향 벡터, 상태, 소지 장비 여부에 따라 신체 관절의 심도(Z-Sorting)가 변동하는 8방향 투영 렌더링을 지원합니다.

### 6.2. 절차적 지물 및 건축 렌더링
- **Dynamic Nature**: 바람 벡터(`wind.getSway()`)에 따른 진자 운동 및 계절/고갈 상태 색상 변동.
- **Auto-Tiling**: 주변 타일 연결 상태를 비트마스크(Bitmask) 연산으로 파악하여 울타리(`Fence`) 연결부 등을 오토타일링 처리합니다.

---

## 7. 군락 AI 및 작업 분배 시스템 (🌍 Macro & Task System)

마을 단위 시스템(`VillageSystem`)은 인구 관리, 건설 계획, 영토 확장 및 자원 분배를 총괄합니다.

### 7.1. 마을 자원 및 인구 관리
- **동적 자원 요구량**: 마을의 인구수(population)에 비례하여 식량, 나무, 돌의 필요량과 창고 최대 한도를 실시간으로 재계산합니다 (예: 인당 식량 20, 나무 15 등).
- **국가 버프 (Nation Buffs)**: 소속 국가(Nation)에 왕(King)이 존재할 경우, 마을 전체의 건설 속도(1.2x)와 사기(Morale)에 보너스가 부여됩니다.

### 7.2. 건축 AI 및 부지 선정 (Natural Progression)
- **우선순위 기반 발전**: 무작위 건설이 아닌 `bonfire ➔ storage ➔ house ➔ farm ➔ well/blacksmith` 순의 엄격한 기초 문명 테크 트리를 따릅니다. 인구 대비 주거 공간(capacity)이 부족할 때만 집을 짓도록 억제합니다.
- **나선형 부지 탐색 (Spiral Search)**: 마을 중심점에서 나선형 반경으로 넓혀가며 `TerrainGen`을 검사하여 토양(`SOIL`) 지형이면서 기존 건물과 최소 50px 간격을 유지하는 명당을 스스로 찾아냅니다.

### 7.3. 영토 개척 (Expansion)
- 마을의 인구가 10명 이상이고 보유 목재가 50 이상일 경우 쿨다운을 거쳐 '개척 이벤트'가 발생합니다.
- 직업이 없는 잉여 인력을 600~1000px 떨어진 먼 곳으로 파견하여 새로운 마을(`Village`)을 창설하며, 기존 국가망에 소속시켜 다중 군락 체제를 형성합니다.

---

## 8. 상호작용 및 도구 시스템 (Interaction & Tools)

사용자가 직접 환경에 개입하거나 맵을 조작할 수 있는 신(God) 모드 인터페이스 명세입니다.

### 8.1. 브러시 및 도구 시스템 (`ToolRegistry`, `InputSystem`)
- **전략 패턴 도구 (`ToolRegistry`)**:
  - `SprinkleTool`: 무작위 반경에 파티클을 흩뿌려 여러 엔티티를 한 번에 생성(`SPAWN_PLANT`)하거나 바이옴을 변환(`CHANGE_BIOME`)합니다. 
    - *안전 장치*: `CHANGE_BIOME` 브러시 사용 시 기반 지형(`TerrainLayer`)은 그대로 두고 생태계(`BiomeLayer`)만 교체하여, 바다가 갑자기 흙으로 변하는 물리적 오류를 원천 차단합니다.
  - `ToggleTool`: `wind`, `fertility`, `water`, `mineral`, `xray` 등 환경 수치를 시각화하는 렌더링 오버레이 레이어를 토글합니다.
- **사용자 입력(`InputSystem`)**: 마우스 클릭 시 `SpatialHash`를 탐색해 근처에 울타리 문(`Door`)이 있다면 최우선으로 개폐(Toggle) 이벤트를 발생시키며, 드래그 중인 대상에 대해서는 지속적으로 `SpatialHash.update`를 호출해 공간 정보를 안전하게 갱신시킵니다.

### 8.2. 개체 상호작용 (Drag & Drop)
- **상태 제어 (`GrabbedState`)**: 생명체를 마우스로 집어 들면 AI 로직이 중지(`grabbed` 모드 전이)되며, 드롭 시 기존 작업(Task)으로 안전하게 복귀하여 길찾기 폭주를 방지합니다.

---

## 9. 도메인별 핵심 시스템 명세 (Systems Architecture)

### 9.1. Core
- `Engine`, `SystemManager`(Phase 기반 실행 통제), `TimeSystem`(틱/시간대 관리), `UISystem`, `ToolManager`.

### 9.2. Civilization & Economy
- **`ConstructionSystem`**: 건물 완공 시 내부 개체 밀어내기 및 처리.
- **`VillageSystem`**: 인구/영토 확장 및 테크트리 관리.
- **`EconomyManager`**: 1초 주기로 전역 자원을 스캔/규격화(Standardization: `tree` ➔ `wood`)하여 캐싱(Blackboard)하고, 마을의 완공된 창고(`Storage`) 간 재고를 비교해 100개 이상의 과적 창고에서 20개 미만의 부족 창고로 물자 50개씩을 보내는 운반 업무(`transportTasks`)를 생성해 경제적 불균형을 자동 해소합니다.
- **`SpawnerSystem`**: 매 프레임 해당 픽셀의 비옥도(Fertility > 0.3)와 바이옴(Grass/Jungle)을 검사해 풀/나무 등을 자연 확률 스폰합니다. 육식 동물이 사냥감을 죽여 고기가 생성될 경우, 포식자의 타겟을 즉시 고기로 자동 할당(Link)하여 '사냥 ➔ 섭취' 흐름을 매끄럽게 보장합니다.

### 9.3. Lifecycle
- `MetabolismSystem`(소화/피로/배설/노화 통합), `EnvironmentSystem`(토양 비옥도 시뮬레이션), `HealthSystem`, `EmotionSystem`, `WindSystem`.

### 9.4. Motion
- `KinematicSystem`(이동 및 `SpatialHash` AABB 충돌 분리), `PathSystem`(A* 길찾기 및 Throttling 제어).

---

## 10. AI 직업 및 역할 시스템 (Roles System)

개체 직업에 따른 행동 우선순위 전략 패턴(`Strategy Pattern`). `RoleFactory`를 통해 생성되며 `BaseRole` 인터페이스를 따릅니다.

### 10.1. ArchitectRole (건축가 판단 로직)
건축가는 청사진이 요구하는 자원(나무, 돌, 철광석)을 파악하고 다음과 같은 4단계의 지능적인 탐색 우선순위를 가집니다:
1. **반경 300px 이내 바닥에 떨어진 자원 줍기 (`pickup`)**
2. **소속 마을의 완공된 창고(`Storage`)에서 인출하기 (`withdraw`)**
3. **맵 전체 반경(2400px)에서 떨어진 목표 찾기**
4. **자연물 직접 채집하기**: 나무/돌 등 무거운 자원은 `gather_wood`를, 가벼운 식물은 `gather_plant`를 트리거합니다.

### 10.2. 기타 특화 직업
- `GathererRole`(채집), `LoggerRole`(벌목), `HunterRole`(사냥) 및 거시적 의사결정을 내리는 `ChiefRole` 등이 존재합니다.

---

## 11. 코어 유틸리티 및 공간 관리 (Utils & World)

### 11.1 지형 생성 및 레이어 최적화 (`TerrainGen`)
- **초고속 절차적 생성**: 내부적으로 `Math.sin` 함수 등을 제거한 퍼뮤테이션 테이블(Permutation Table) 기반의 빠르고 최적화된 커스텀 Perlin Noise 알고리즘을 사용합니다.
- **Color LUT 캐싱**: 지형 종류(TerrainId), 바이옴(BiomeId), 비옥도(Fertility) 조합의 렌더링 컬러값을 사전에 32-bit `Uint32Array` LUT(Look-up Table)로 구워두어, O(1)의 속도로 픽셀 컬러를 추출합니다.
- **메모리 버퍼 분리**: `TerrainLayer`, `BiomeLayer` 와 환경 정보(`fertilityBuffer`, `waterQualityBuffer`)를 8-bit `Uint8Array` 1차원 배열로 평탄화하여 메모리 단편화를 방지하고 고속 스캔을 보장합니다.

### 11.2 공간 파티셔닝
- **`SpatialHash`**: 2D 공간을 그리드로 나누어 O(1) 초고속 개체 검색과 충돌 연산을 지원하는 핵심 자료구조.
- **`Pathfinder`**: A* 기반 최단 경로 알고리즘 제공.
- **`ChunkManager`**: 청크 단위 Culling 렌더링 최적화.

---

## 12. UI 및 상태 관리 (Vue Frontend Layer)

- **`WorldboxView.vue`**: 캔버스 마운트, 게임 루프 개시, 도구(Tools) UI 메뉴 등을 관장합니다. `ResizeObserver`로 해상도를 동기화합니다.
- **`EntityStatusPanel.vue`**: 개체 클릭 시 AI 상태, 식성, 인벤토리, 스탯과 즉사(`KILL`) 명령 등의 상세 정보를 제공합니다.
- **`worldboxStore.js` (Pinia)**: 엔진 루프에서 전송하는 통계 데이터를 Vue에 반응형으로 중계하는 전역 브릿지 스토어입니다.