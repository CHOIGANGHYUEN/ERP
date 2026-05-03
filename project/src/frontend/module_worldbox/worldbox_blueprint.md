# WorldBox Module - Components Architecture Blueprint

이 문서는 `module_worldbox` 내의 ECS(Entity-Component-System) 아키텍처 중 **Component(데이터 구조체)**들의 역할과 관계를 정의합니다.
모든 컴포넌트는 비즈니스 로직을 최대한 배제하고 순수한 상태(데이터)만을 보관하는 것을 원칙으로 합니다.

## 1. 컴포넌트 디렉토리 구조 및 역할

### 🧠 Behavior (행동 AI)
- **State.js (`AIState`)**: 개체의 현재 유한 상태 기계(FSM) 상태(`mode`), 상호작용 중인 타겟 ID, 행동 타이머 및 상태 스택(인터럽트 복구를 위한 `modeStack`)을 저장합니다.
- **Target.js (`Target`)**: 개체가 현재 목표로 하고 있는 대상의 고유 ID, 타입, 월드 좌표 등 추적 정보를 캐싱합니다.
- **JobController.js (`JobController`)**: 개체에 부여된 직업(`currentJob`), 할당된 활동 구역(`zoneId`), 직업 내 세부 상태를 관리합니다. 생존 욕구 발생 시 현재 작업을 중단(Interrupt)하고 다른 상태를 우선하도록 제어하는 역할을 돕습니다.

### 🏛️ Civilization (문명 및 건축)
- **Builder.js (`Builder`)**: 개체의 건축 가능 여부 및 건축 수행 속도를 관리합니다.
- **Structure.js (`Structure`)**: 건설 중인 청사진이거나 완성된 건물의 종류, 완성도(progress), 내구도(hp/maxHp) 및 소속 마을 정보를 담습니다.
- **Housing.js (`Housing`)**: 주거용 건물의 소유주, 거주자(resident) ID 목록, 최대 수용 인원(capacity) 및 거주 만족도(quality)를 관리합니다.
- **Door.js (`Door`)**: 울타리 문이나 출입구의 개폐 상태(`isOpen`) 및 자동 닫힘 딜레이 시간을 관리합니다.
- **TechLevel.js (`TechLevel`)**: 군락(세력)의 기술 발전 수준, 총 인구수, 누적 채집 자원량, 생존 시간 등을 추적하여 시대 발전을 제어하는 기반 데이터입니다.

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

### 📊 Stats (능력치 및 생태 스탯)
- **BaseStats.js (`BaseStats`)**: 체력(health), 허기(hunger), 피로도(fatigue), 배설 대기량(waste), 식성(diet: 초식/육식/잡식), 이동속도, 방어력 등 개체 생존에 직결되는 핵심 파라미터를 통합 관리합니다. 방어력 연산 로직도 함께 지닙니다.
- **Digestion.js (`Digestion`)**: 섭취한 음식물을 기반으로 포만감 회복 및 감정 상태(행복도)를 증감시키는 소화 파라미터를 담당합니다.
- **Emotion.js (`Emotion`)**: 지능이 있는 개체(인간 등)의 심리적 상태인 행복도, 스트레스, 충성도를 추적하고 전반적인 기분(mood)을 결정합니다.
- **Age.js (`Age`)**: 개체의 현재 나이, 무작위로 부여된 최대 수명, 그리고 성장 단계(유년기, 성체, 노년기 등)를 기록합니다.
- **TagBitmask.js (`TagBitmask`)**: 비트 연산을 통해 엔티티의 카테고리 속성(HUMAN, ANIMAL, RESOURCE 등)을 고속으로 분류 및 필터링하기 위한 마스크 객체입니다.

---

## 2. 핵심 컴포넌트 도메인 간의 관계 (Architecture Dynamics)

### 🧬 생존 및 AI 행동 파이프라인
- **상태 평가**: `BaseStats`의 생존 수치(허기, 피로)가 임계치에 도달하면 Behavior/Brain 시스템이 이를 감지하여 `AIState`의 `mode`를 변경합니다 (예: 배회 중 피곤하면 `SLEEP`으로, 배고프면 `FORAGE`로 전이).
- **인터럽트 (Interrupt) 통제**: `JobController`에 의해 건축(`build`)이나 채집 같은 장기 직업을 수행 중이더라도, 생존 수치가 위험해지면 `JobController`가 `AIState.pushMode()`를 통해 현재 상태를 스택에 보존하고 식사/수면 상태를 강제 주입하여 개체의 사망을 막습니다. 생존 욕구가 해소되면 `popMode()`로 이전 작업으로 자동 복귀합니다.
- **타겟팅 인지**: `AIState`가 먹이나 채집물을 결정하면 TargetManager가 `Target` 컴포넌트 정보 및 `AIState.targetId`를 업데이트하여 시스템이 목표물의 위치(`Transform`)를 추적하도록 합니다.

### ♻️ 자원 순환 및 경제 파이프라인
- **채집과 이동**: 개체가 목표 자원 노드(`Resource`)의 `Transform`으로 다가가 사거리 내에 들면 `GathererComponent`의 로직이 동작하여 자원을 추출합니다. 획득된 양은 `Inventory`에 저장됩니다.
- **생태계 비옥도 순환 체계**: 동물이 식용 자원(`ResourceNode`)을 캐어 먹으면 `Digestion` 컴포넌트를 거치며 `BaseStats` 내부에 비옥도로서 축적됩니다. 틱마다 배설물(waste) 수치가 차올라 배출되면, 해당 픽셀의 `SoilFertility`가 상승하며 이는 새로운 식물 자원 노드의 생성 밑거름이 되는 완벽한 제로섬 순환을 이룹니다.
- **물자 비축**: 개체의 가방(`Inventory`)이 가득 차면 행동 AI는 촌락의 `Storage` 건물로 귀환하는 `DepositState` 모드로 전환하여 자원을 이관합니다.

### 🏗️ 건축 및 문명 발전 파이프라인
- **협동 건설**: 시스템이 지면 위에 `Structure`(isBlueprint = true) 컴포넌트를 스폰시키면, 인근의 `Builder` 속성을 가진 개체들이 `Inventory` 자원을 소모하여 구조물의 완성도(progress)를 증가시킵니다.
- **상태 부여**: 완공 시 `Structure.isComplete = true`가 되며, 주거용 건물의 경우 `Housing` 컴포넌트를 활용해 거주자가 할당됩니다.
- **문명 스케일업**: 군락의 `TechLevel`과 `Wealth`, `Storage` 자원이 종합적으로 연산되어 종족의 다음 기술 시대(석기 ➔ 청동기 등) 해금 이벤트로 이어집니다.

---
## 3. 핵심 설계 원칙 및 가이드라인
1. **순수 데이터 객체 유지**: ECS 설계 원칙에 따라 컴포넌트는 `serialize()` 등의 기본 직렬화 메서드를 제외한 복잡한 비즈니스 로직(행동 처리, 위치 갱신 등)을 직접 수행하지 않고 오직 **상태(데이터)의 저장소** 역할만 해야 합니다. (일부 유틸성 메서드는 허용되나 궁극적으로 System 계층으로 분리를 지향합니다.)
2. **컴포지션(Composition) 조립**: 상속보다는 컴포넌트들을 필요에 따라 레고 블록처럼 조합하여 새로운 특성을 가진 엔티티를 생성합니다. 
   * 예: '건축이 가능한 사람'은 `AIState` + `BaseStats` + `Builder` + `Inventory` + `Emotion` 컴포넌트의 결합체입니다.

---

## 4. Systems - Behavior & AI Architecture (🧠 행동 및 의사결정 계층)

개체의 AI는 철저하게 분업화된 파이프라인(인지 ➔ 판단 ➔ 관제 ➔ 실행)을 거쳐 동작합니다.

### 4.1. Core Managers (중앙 제어 및 관제)
- **BehaviorSystem (`AnimalBehaviorSystem`, `HumanBehaviorSystem`)**: 프레임마다 `SpatialHash`를 갱신하고, 종별 두뇌(`Brain`)가 결정한 FSM 모드에 맞춰 `StateFactory`로부터 상태 객체를 주입받아(DIP) 로직을 실행하는 핵심 AI 루프입니다.
- **TargetManager**: AI가 요구하는 타겟팅 요청을 비동기 큐(`pendingRequests`)에 쌓고, 프레임당 최대 20건씩만 분할 처리하여 다수 개체의 길찾기 연산 병목을 방지합니다. 대상 할당 시 `claimedBy` 락(Mutex)을 걸어 여러 개체가 하나의 자원을 동시에 타겟팅하는 것을 차단합니다.
- **Blackboard**: 연산 비용이 높은 데이터(창고 목록, 타입별 자원 노드, 구역 정보)를 저주기(Phase 2.5)로 캐싱하여, 모든 AI 시스템이 즉시 참조할 수 있도록 돕는 공유 메모리입니다.

### 4.2. Sensors (환경 인지)
- **`FoodSensor` / `PredatorSensor`**: `SpatialHash`를 이용해 반경 내 엔티티를 고속 필터링합니다. 개체의 식성(`DietType`)에 따라 먹이를 식별하며 탐색 반경을 최적화합니다.
- **`ZoneSensor`**: `JobController`에 할당된 구역(`zoneId`) 정보를 기반으로, 전체 맵이 아닌 자신에게 허가된 활동 구역(`ZoneManager` 연동) 내부의 자원 및 사냥감만을 정밀하게 필터링합니다.

### 4.3. Brains (의사결정 두뇌)
- **생존 최우선 판단**: 모든 두뇌는 공통적으로 허기(`hunger`)나 피로도(`fatigue`)가 임계치에 도달하면, 하던 작업을 중단(Interrupt)하고 생존 모드(`FORAGE`, `SLEEP`)로 전이(`AIState.pushMode()`)합니다.
- **종족별 특화**:
  - `HumanBrain`: 촌장이나 건축가는 마을의 자원 상황(`Blackboard`)을 파악하여 직접 자원을 캐거나 청사진을 향해 건설 모드(`build`)로 진입합니다. 그 외에는 부여된 직업(`role.decide()`)에 따라 행동합니다.
  - `CarnivoreBrain` / `HerbivoreBrain`: 식성에 따라 주변 포식자(`PredatorSensor`)를 감지해 도망치거나(`FLEE`), 초식동물을 추적(`HUNT`)하거나 풀을 뜯습니다(`GRAZE`).
  - `BeeBrain`: 여왕벌은 모인 꿀을 소모하여 애벌레(`larva`)를 부화시키고, 일벌(`worker`)은 벌집을 중심으로 궤도 비행(`Orbiting`)을 하며 꽃에서 꿀을 수집(`bee_gather`)해 귀환합니다.

### 4.4. States (FSM 행동 실행 로직)
- **기반 상태 클래스 (`GatherState`)**: 채집을 위한 이동과 사거리 도달, 채집 쿨다운(Tick)을 공통으로 제어합니다.
- **세부 작업 구현 (`GatherWoodState`, `GatherPlantState`)**: 공통 채집 로직을 상속받으며, 나무의 경우 쓰러지는 물리적 연출(`fallingTargetId`)을 동기적으로 처리하여 몰입감을 줍니다.
- **단계적 건축 (`BuildState`)**: 인벤토리 검사 ➔ 창고 이동(`GOING_TO_STORAGE`) ➔ 자원 인출(`WITHDRAWING`) ➔ 청사진 도달 및 건설(`GOING_TO_BLUEPRINT`) 등 복합 페이즈를 제어합니다.
- **이동 및 회피 (`FleeState`, `WanderState`)**: `Pathfinder`를 통해 장애물을 우회합니다. 위협 대상(`threat`)의 반대 각도로 도주 벡터를 실시간 연산합니다.
- **대기 및 복귀 (`WaitForTargetState`, `DepositState`)**: 타겟 관리자로부터 자리가 날 때까지 제자리에서 기다리며(`wait_target`), 가방이 꽉 차면 창고로 돌아와 자원을 이관(`deposit`)하고 말풍선을 띄웁니다.
- **신(God) 상호작용 (`GrabbedState`)**: 마우스 도구(`grab_entity`)에 의해 공중으로 집어 올려진 개체는 즉각 물리 이동과 AI가 정지되어 안정성을 보장합니다.

### 4.5. 생명주기 및 전투 시스템
- **`CombatSystem`**: 전투 발생 시 대상의 체력(`health`)을 깎고 시각 효과를 발생시킵니다. 대상 사망 시 소지한 재화(Gold)를 약탈(`Looting`)하며, 주변 인간들에게 스트레스 이벤트(`BATTLE_WITNESSED`)를 전파합니다.
- **`DeathProcessor`**: 개체 사망(`DIE`) 시 점진적으로 페이드아웃(`alpha` 감소)됩니다. 소멸 시점에 다음의 처리가 일어납니다.
  - **제로섬 토양 환원**: 죽은 자리의 픽셀 비옥도(`fertilityBuffer`)를 +50 증가시킵니다.
  - **물자 환원**: 소지 중이던 인벤토리 자원(최대 5개)과 고기(`meat`)를 바닥에 드롭합니다.
  - **사회망 이탈**: 마을 직업(`VILLAGER_DEATH`) 및 벌집(`beeCount`) 정보를 즉시 차감하고, `SpatialHash`에서 자신을 지워 렌더링/물리 오류를 차단합니다.

---

## 5. Entity Factories (엔티티 생성 팩토리 파이프라인)

ECS의 복잡한 컴포넌트 조립 과정을 숨기고 도메인별 생성을 캡슐화한 팩토리 클래스들입니다.

- **생물 팩토리 (`HumanFactory`, `AnimalFactory`)**: 
  - 성별, 초기 스탯, 나이, 식성, `AIState`, `Metabolism` 등을 조합합니다. 
  - 소환되는 위치가 건물 내부(장애물)일 경우, `SpatialHash`를 조회하여 스스로 안전한 빈 공간을 찾아 스폰 좌표를 보정하는 방어 로직을 내장하고 있습니다.
- **건축물 팩토리 (`BuildingFactory`)**: 
  - 청사진(`isBlueprint`) 상태와 완성된 건물을 제어합니다.
  - 스폰 시 해당 픽셀 반경의 `Fertility(비옥도)`를 강제로 0으로 만들어, 건물 안에 나무나 풀이 자라나지 않도록 환경을 통제합니다.
- **환경 및 자원 (`NatureFactory`, `ResourceFactory`)**: 
  - 자원의 외형 스케일 및 보유량(`ResourceNode.value`)을 부여합니다. 
  - 특히 `NatureFactory`에서 나무를 스폰할 때, 초기엔 작은 묘목(Size 5)으로 스폰된 후 `setInterval` 로직에 의해 6초마다 조금씩 커지며 완전한 성목으로 자라나는 자체 생장(Growth) 시스템을 가집니다.
- **도구 (`ToolFactory`)**: 무기, 채집 도구 등의 장착 아이템 수치(내구도, 위력)를 조립합니다.

---

## 6. 고성능 렌더링 파이프라인 (🎨 Rendering System)

게임 엔진은 다수의 개체를 60FPS로 렌더링하기 위해 스프라이트 캐싱과 틱 기반 물리 모션을 결합하여 사용합니다.

### 6.1. 캐싱 및 동적 렌더링 (AnimalRenders)
- **Sprite Caching**: 동일한 종족, 상태, 프레임을 가진 동물은 매번 도트를 다시 찍지 않고 오프스크린 캔버스 캐시(`spriteCache`)를 활용해 O(1) 수준으로 렌더링하여 연산 비용을 대폭 줄입니다.
- **8-Directional Motion (`HumanRenderer`)**: 방향 벡터(`facing`), 상태(`mode`), 배낭 소지 등 장비 여부에 따라 각 신체 부위 관절의 Z-Sorting(심도)이 동적으로 변하는 진정한 8방향 3D 투영 픽셀 렌더링을 지원합니다.
- **Advanced State Motion**: `applyAdvancedStateMotion`을 통해 `Math.sin(time)`을 활용한 수면 호흡(스케일링), 식사 저작 운동, 돌진(Lunge) 등의 모션을 절차적으로 생성해 생동감을 더합니다.

### 6.2. 절차적 지물 및 건축 렌더링 (Nature / Build Renders)
- **Dynamic Nature**: 식생 및 자원은 바람 벡터(`wind.getSway()`)와 고갈 상태(`isWithered`)에 따라 진자 운동과 색상 팔레트가 실시간으로 변동됩니다.
- **Auto-Tiling (`BuildRender`)**: `SpatialHash`를 조회하여 상하좌우의 타일 연결 상태를 비트마스크(Bitmask) 연산으로 파악하고, 동적으로 울타리(`Fence`) 연결부의 모양을 오토 타일링 처리합니다. 울타리 문(`Gate`)의 경우 `isOpen` 상태값에 따라 3D 평면 비틀기 효과를 부여합니다.

---

## 7. 군락 AI 및 작업 분배 시스템 (🌍 Macro & Task System)

마을/군락 단위의 유기적인 발전을 통제하기 위해, 게시판 기반의 분배 로직과 거시적 건축/개척 AI가 동작합니다.

### 7.1. 마을 작업 게시판 (`TaskBoardService`)
- **중앙 집중형 협업**: 발생된 건축 청사진이나 개척 목표는 개별 AI가 각자 판단하지 않고 중앙의 작업 게시판에 큐(Queue)로 게시(`publishTask`)됩니다.
- **수주 및 반환**: 일꾼 엔티티들이 가용 상태(`AVAILABLE`)의 작업을 수주(`CLAIMED`)하여 효율적으로 협동하며, 생존 욕구 등으로 중단 시 게시판으로 다시 반환(`releaseTask`)하여 타 개체가 이어받을 수 있게 조율합니다.

### 7.3. 건축 AI 및 부지 선정 (Town Planning)
- **Town Planning (`Builder.js`)**: 마을의 현재 인구수와 보유 자원(Wood, Stone 등)을 복합 평가하여 마을 회관(TOWN_HALL) ➔ 주거지(HOUSE) ➔ 농장/대장간 등 지어야 할 건물의 우선순위를 지능적으로 결정합니다.
- **나선형 부지 탐색 (Spiral Search)**: 건물을 스폰할 때, 마을 중심점으로부터 나선형 탐색(최대 반경 `maxSearchRadius`)을 돌며 기존 건물과 일정한 48px 간격(Grid)을 유지하면서 자기 영토 내부(`world.territory`)의 바다가 아닌 평탄한 지형을 스스로 찾아내 청사진을 배치합니다.

### 7.4. 영토 개척 (`ExpansionTask`)
- 개척 임무를 받은 개체는 본대에서 800~1500px 떨어진 랜덤 좌표로 이동합니다. 도착 후 바다나 기존 건물 밀집 지역인지 부지 적합성(Terrain/Building Validate)을 스스로 검사합니다.
- 타당한 빈 땅을 발견하면 `VillageSystem.createVillage`를 호출하여 새로운 마을/군락을 세워 문명을 확장합니다.

---

## 8. 상호작용 및 도구 시스템 (Interaction & Tools)

사용자가 직접 환경에 개입하거나 맵을 조작할 수 있는 신(God) 모드 인터페이스 명세입니다.

### 8.1. 브러시 도구 시스템 (Strategy Pattern)
- 확장이 용이한 전략 패턴(Strategy Pattern)을 활용해 다채로운 지형 및 엔티티 스폰 조작을 지원합니다.
- 단일 클릭 핀포인트 조작(`SingleBrush`), 반경 무작위 살포(`SprayBrush`), 선 긋기(`DrawBrush` - Bresenham 알고리즘 활용), 영역 단위 연속 채우기(`FillBrush` - BFS/Flood Fill) 등 정교한 툴 모드를 제공합니다.

### 8.2. 개체 상호작용 (Drag & Drop)
- **상태 제어 (`GrabbedState`)**: 마우스로 생명체를 집어 들면 해당 개체의 AI 로직이 완전히 중단되며 마우스를 따라 공중에 뜹니다. 드롭하는 순간 기존 행동(Task)으로 안전하게 복귀하여 길찾기 연산이 폭주하지 않도록 보호합니다.
- **동적 통행 (Gates)**: 마우스 툴로 문(`Door`) 엔티티를 클릭하여 수동으로 여닫을 수 있습니다. 길찾기 엔진(`Pathfinder`)과 물리 시스템(`KinematicSystem`)은 이 문의 개폐 상태에 실시간으로 반응하여 지나갈 수 있는 공간으로 인식하게 됩니다.

---

## 9. 도메인별 핵심 시스템 명세 (Systems Architecture)

ECS 아키텍처의 System 계층으로, 매 프레임마다 엔티티들의 컴포넌트 데이터를 읽고 쓰는 실제 비즈니스 로직이 수행되는 곳입니다. 역할과 도메인에 따라 철저히 디렉토리가 분리되어 있습니다.

### 9.1. Core (코어 및 시스템 제어)
- **`WorldUpdater`**: Main Thread와 Worker 간의 물리/렌더링 틱(Tick)을 관리합니다. 날씨(10틱), 마을(20틱), 재해(60틱) 등 시스템별 업데이트 주기를 분산하여 성능을 최적화하고, `Atomics.load`를 통해 프록시 객체의 렌더링 동기화를 안전하게 수행합니다.
- **`SystemManager`**: 비대해진 `Engine` 클래스(God Class)의 역할을 분산하여 15개 이상의 하위 시스템들의 초기화 및 실행 순서 제어를 전담합니다.

### 9.2. Civilization (문명 및 건축)
- **`ConstructionSystem`**: 건축물 완공 처리를 담당합니다. 건물이 완성되는 순간 내부에 위치한 개체(인간 등)가 `NaN` 좌표 에러를 일으키거나 끼어 죽는 현상을 방지하기 위해, 건물 반경 밖 안전 지대로 개체를 자연스럽게 밀어내는 보정 로직을 포함합니다.
- **`VillageSystem` / `BuildingSystem`**: 아메바식(BFS) 탐색 알고리즘을 통한 유기적 영토 확장(`VillageActions`) 및 나선형(Spiral) 탐색 기반의 지능형 부지 선정 등 군락 단위의 거시적 제어를 수행합니다.

### 9.3. Economy (경제 및 자원 스폰)
- **`SpawnerSystem`**: 맵 상에 광물, 식물, 고기 등 1차 자원의 스폰을 관리합니다. 기존에 고기(Meat) 아이템이 동물(Animal) 컴포넌트와 결합되어 스스로 움직이던 심각한 버그를 방지하기 위해, 모든 자원 생성은 전용 `resource` 팩토리를 엄격히 거치도록 통제합니다.

### 9.4. Input (사용자 입력)
- **`InputSystem`**: 사용자의 마우스/키보드 이벤트를 월드와 상호작용시킵니다. 드래그 중인 개체의 `SpatialHash` 갱신 시 발생하는 런타임 에러(`is not a function`)를 차단하는 방어 코드를 내장하고 있으며, 브러시 도구 조작은 전략 패턴(Strategy Pattern - `SingleBrush`, `SprayBrush` 등)으로 위임합니다.

### 9.5. Lifecycle (생명주기 및 환경)
- **`MetabolismSystem`**: 개체의 소화, 피로, 수명 주기를 통제합니다. 아사(Starvation) 시 급격한 체력 감소로 인한 연쇄 생태계 붕괴를 막기 위해 초당 체력 감소 폭을 완화(5.0 ➔ 2.0)하여 생태계 밸런스를 조절합니다.
- **`EnvironmentSystem`**: 토양 비옥도(Fertility) 및 수질을 바탕으로 바이옴(Biome) 생태계가 인접 타일로 유기적으로 확산(Spread)되는 시뮬레이션을 제어합니다.

### 9.6. Motion (물리 및 이동)
- **`KinematicSystem`**: 이동 속도(`Velocity`)를 물리적 좌표(`Transform`)로 변환합니다. `SpatialHash`를 활용한 AABB 충돌 계산으로 개체 간 겹침을 밀어내기(Separation)로 해소하며, 열린 문(`Door`)이나 드래그 중인 개체는 충돌 판정에서 제외시킵니다.
- **`PathSystem`**: A* 기반의 길찾기 연산을 수행하며, 길찾기 요청 폭주로 인한 프리징을 막기 위해 프레임당 연산량(Throttling)을 제한하고 도달 불가능한 목표를 식별합니다.

### 9.7. Render (렌더링 파이프라인 보조)
- **`ParticleSystem`**: 도메인(채집 완료, 전투 등) 로직 내부에 하드코딩될 수 있는 시각 이펙트(이모지 말풍선, 타격 효과) 처리를 분리하여, `EventBus` 이벤트를 수신받아 독립적으로 렌더링 파티클을 관리합니다.

---

## 10. AI 직업 및 역할 시스템 (Roles System)

개체의 직업(Job)에 따라 각기 다른 행동 우선순위와 타겟팅을 제어하는 전략 패턴(Strategy Pattern) 구현체입니다.

- **`RoleFactory`**: 엔티티의 직업 속성에 맞춰 적합한 Role 인스턴스를 동적으로 생성 및 주입합니다.
- **`BaseRole`**: 모든 역할 클래스가 상속받는 기본 인터페이스로, 공통 의사결정 파이프라인을 정의합니다.
- **특화 역할군 (`ArchitectRole`, `ChiefRole`, `GathererRole`, `HunterRole`, `LoggerRole` 등)**: 
  - `HumanBrain` 등의 두뇌 AI에서 호출되며, 현재 주변 상황과 마을의 재고를 판단하여 어떤 상태(State)로 진입할지 결정합니다.
  - 예: `ArchitectRole`은 청사진(Blueprint)을 최우선 탐색하고, `GathererRole`은 할당된 Zone(구역) 내의 식용 자원을 필터링합니다.

---

## 11. 코어 유틸리티 및 공간 관리 (Utils & World)

순수 로직의 최적화와 월드의 렌더링/생성을 담당하는 기반(Foundation) 모듈들입니다.

### 11.1. Utilities (엔진 유틸리티)
- **`SpatialHash`**: 2D 공간을 그리드로 나누어 O(1) 수준의 초고속 주변 개체 검색 및 AABB 충돌 밀어내기 연산을 가능하게 하는 핵심 자료구조입니다.
- **`Pathfinder`**: A* (A-Star) 알고리즘 기반으로 정적 장애물을 우회하는 최단 이동 경로를 제공합니다.
- **`BitmaskUtils` / `MathUtils` / `GridUtils`**: 오토타일링을 위한 비트 연산, 벡터 거리 계산, 좌표-그리드 인덱스 변환 등 수학적 유틸리티 함수들을 캡슐화했습니다.

### 11.2. World & Zones (지형 및 구역)
- **`TerrainGen`**: 절차적 생성(Procedural Generation) 알고리즘을 통해 바다, 평야, 산맥 등 자연스러운 지형 타일맵과 바이옴(Biome)을 렌더링합니다.
- **`ChunkManager`**: 광활한 월드를 청크 단위로 분할하여, 동적/정적 엔티티들의 렌더링 부하(Culling)를 최적화하고 공간적 필터링을 지원합니다.
- **`WorldLayers`**: 고도, 온도 등 환경 메타데이터 레이어를 관리합니다.
- **`ZoneData`**: 사용자가 지정한 '작업 구역(Zone)' 데이터를 보관하여 AI 일꾼들의 활동 반경을 물리적으로 제한합니다.

---

## 12. UI 및 상태 관리 (Vue Frontend Layer)

순수 JavaScript 엔진(`Engine`)과 Vue 3 기반 UI 계층 간의 상호작용 및 렌더링을 제어합니다.

### 12.1. 사용자 인터페이스 (Components & Views)
- **`WorldboxView.vue`**: 엔진 구동의 메인 뷰입니다. `<canvas>`를 마운트하고 게임 루프를 시작하며, 디버그 패널, 마을 상태(Village Status), 하단 브러시 도구(Tools) 메뉴 UI를 관장합니다. `ResizeObserver`를 통해 창 크기에 맞춰 캔버스 해상도를 동적으로 재조정합니다.
- **`EntityStatusPanel.vue`**: 사용자가 맵 상의 개체를 클릭했을 때 우측 상단에 노출되는 상세 상태창입니다. 대상의 식성(Diet), AI 상태 파이프라인, 직업, 현재 인벤토리(가방), 생존 파라미터(포만감/피로도) 및 신의 권능인 `KILL(💀)` 기능을 시각적으로 제공합니다.

### 12.2. 브러시 및 도구 전략 (Tools Strategy)
- **`BrushStrategy`**: 신(God) 모드의 다양한 도구 조작 방식을 규격화한 전략 패턴 클래스입니다.
- **구현체 (`SingleBrush`, `DrawBrush`, `SprayBrush`, `FillBrush`)**: 마우스 상호작용 패턴에 맞춰 핀포인트 스폰(`Single`), 선형 드로잉(`Draw`), 무작위 확산 살포(`Spray`), BFS 기반 연속 채우기(`Fill`) 로직을 수행합니다.

### 12.3. 전역 상태 브릿지 (Store)
- **`worldboxStore.js` (Pinia)**: 백그라운드 엔진 루프(`monitor.onUpdate`)에서 전달하는 FPS, 엔티티 총량, 토양 비옥도 총합, 군락(Village) 통계 수치를 수신받아 Vue 컴포넌트들에 반응형(Reactive) 데이터로 중계하는 핵심 스토어 역할을 담당합니다.