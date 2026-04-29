🌍 모바일 지구 시뮬레이션 (module_worldbox) 최종 설계 명세서

1. 프로젝트 개요

프로젝트명: 모바일 지구 시뮬레이션 (WorldBox 모듈)

개발 위치: D:\ERP\project\src\frontend\module_worldbox (기존 프론트엔드 프로젝트의 독립 모듈)

목적: 1px 단위의 도트 그래픽 기반 생태계 및 지형 시뮬레이션 구현 (초당 60프레임 이상의 부드러운 모션, 자원 경제, 문명 발전 보장)

기술 스택: * UI/상태 제어: Vue 3 (Composition API), Pinia

핵심 렌더링 및 게임 루프: HTML5 <canvas>, 순수 JavaScript, requestAnimationFrame

아키텍처 패턴: ECS (Entity-Component-System), 데이터 주도 설계 (Data-Driven Design), FSM (Finite State Machine)

2. 모듈 디렉토리 구조 (문명 및 건축 시스템 추가)

자원 채집을 넘어 개체들이 협동하여 건물을 짓고 기술을 발전시키는 civilization 도메인을 시스템과 컴포넌트에 추가했습니다.

module_worldbox/
├── index.js
├── assets/
├── ui/                      
│   ├── components/          
│   ├── views/               
│   └── store/               
└── engine/                  
    ├── config/              # 📊 중앙 집중형 밸런스 통제 구역
    │   ├── traits_db.json
    │   ├── species.json
    │   ├── biomes.json
    │   ├── resource_balance.json 
    │   ├── buildings.json       # 🏛️ 건물 스펙 (비용, 내구도, 제공 버프/기능)
    │   └── tech_tree.json       # 🏛️ 문명 발전 및 기술 해금 트리
    │
    ├── core/                # Engine.js, EntityManager.js, Component.js, System.js
    │
    ├── components/          # 🧩 데이터 구조체 (도메인별 폴더링)
    │   ├── render/          # Visual.js, Trail.js
    │   ├── motion/          # Transform.js, Velocity.js
    │   ├── behavior/        # State.js, Target.js
    │   ├── resource/        # Inventory.js, ResourceNode.js, Gatherer.js
    │   ├── civilization/    # 🏛️ 문명 및 건축 관련 특성
    │   │   ├── Builder.js       # 건축 가능 여부 및 건축 속도
    │   │   ├── Structure.js     # 건물 객체의 상태 (완성도, 내구도, 수용량)
    │   │   └── TechLevel.js     # 해당 군락/개체의 기술 발전 수준 (석기, 청동기 등)
    │   └── stats/           # TagBitmask.js, BaseStats.js
    │
    ├── systems/             # ⚙️ 비즈니스 로직 (역할별 폴더링)
    │   ├── render/          # RenderCoordinator.js, EntityRenderer.js 등
    │   ├── motion/          # KinematicSystem.js, CollisionSystem.js
    │   ├── economy/         # SpawnerSystem.js, GatheringSystem.js, ConsumptionSystem.js
    │   ├── civilization/    # 🏛️ 건축 및 발전 처리 시스템
    │   │   ├── ConstructionSystem.js # 개체가 자원을 소모하여 Structure의 완성도를 높이는 로직
    │   │   └── ProgressSystem.js     # 조건(인구, 자원, 시간) 충족 시 TechLevel 상승 및 새 기능 해금
    │   ├── behavior/        # 🧠 행동 AI (FSM 기반)
    │   │   ├── BehaviorSystem.js
    │   │   └── states/      
    │   │       ├── IdleState.js, HuntState.js, FleeState.js, BerserkState.js
    │   │       ├── GatherState.js, ConsumeState.js
    │   │       └── BuildState.js    # 🏛️ 청사진(Blueprint)을 향해 이동하여 건물을 짓는 상태
    │   └── lifecycle/       # MetabolismSystem.js, EnvironmentSystem.js 등
    │
    ├── factories/           # EntityFactory.js, ResourceFactory.js, BuildingFactory.js
    ├── world/               # ChunkManager.js, TerrainGen.js
    └── utils/               # MathUtils.js, BitmaskUtils.js

4. 🌍 맵 자원 관리 및 생태계 순환 시스템 세부 설계

4.1 데이터 주도 기반 환경/종족 설정 (engine/config/)
- 자원 밸런스 (resource_balance.json): 자원 종류, 색상, 영양가, 자연 회복률 정의 (예: 풀, 거름 등).
- 종족별 대사 (species.json): 섭취 대상, 배출 결과물, 위장 용량, 소화 속도를 수치화하여 모든 개체에 범용적으로 적용.

4.2 핵심 컴포넌트 데이터 (engine/components/)
- ResourceNode (resource/): 자원 종류, 현재 잔액, 최대 보존량.
- Inventory (resource/): 개체의 자원 보관 주머니.
- Digestion (stats/): [NEW] 섭취 잔여량, 배설물 누적량, 소화 속도 기록.

4.3 맵 지형 및 식생 생성 (engine/world/)
- 노이즈 기반 (TerrainGen.js): 1px 단위 고도/습도 계산.
- 조건부 식생: 특정 환경(평야 등) 만족 시 식물 픽셀 스폰 및 ResourceNode 부여.

4.4 범용 자원 순환 로직 (engine/systems/)
- GatheringSystem (economy/): 자원 노드 수치 차감 및 인벤토리 증가.
- ConsumptionSystem (economy/): 포만감 저하 시 인벤토리 식량 소모 -> Digestion 위장 수치 충전 및 체력 회복.
- MetabolismSystem (lifecycle/): 
  * 틱당 위장 수치 감소 -> 배설물 수치 누적.
  * 한계치 도달 시 현재 좌표에 새로운 자원 노드(거름) 스폰.
  * 거름은 다시 식물 성장을 촉진하는 자원으로 순환.

8. 🌍 신(God) 모드 도구 및 환경 시스템 세부 명세 (God-Mode & Environment) 🌟 신규

시뮬레이션의 상호작용성과 환경적 정밀도를 보장하기 위한 도구 속성 및 환경 로직 명세입니다.

8.1 도구 조작 방식 (Tool Interaction Types)

모든 신 도구는 물리적 일관성을 위해 아래 두 가지 조작 방식 중 하나를 엄격히 따릅니다.

*   **뿌리기 방식 (Sprinkle Type) - 입자 기반**:
    *   **설명**: 커서 위치에서 물리 파티클이 떨어지며 지면에 닿는 순간 해당 지점을 변화시킵니다.
    *   **해당 도구**: 
        *   지형 바이옴: Meadow(🌱), Desert(🏜️), Jungle(🌳), Dirt(🟫), Ocean(💧)
        *   식생 스폰: Sprinkle Grass(🌾)
    *   **특징**: 브러시 크기(Brush Size) 내에서 무작위로 확산되며, 물리적이고 유기적인 상호작용 느낌을 제공합니다.
*   **즉시 방식 (Instant Type) - 포인트 기반**:
    *   **설명**: 클릭한 좌표에 즉시 엔티티를 생성하거나 상태를 변경합니다.
    *   **해당 도구**:
        *   이동: Move(🖐️) - 카메라 드래그 및 개체 잡기
        *   생명체 스폰: Sheep(🐑), Human(👤), Cow(🐄)
    *   **특징**: 정확한 위치 지정이 필요한 개체 배치에 사용됩니다.

8.2 바람 물리 엔진 (Atmospheric Physics)

단순한 노이즈를 넘어 기압 경력을 활용한 기상 시뮬레이션을 수행합니다.

*   **물리 모델**: 기압 경도력(Pressure Gradient Force) 모델. 고기압과 저기압 중심점이 월드를 부유하며 기류를 형성합니다.
*   **업데이트 주기 (Climate Cycle)**:
    *   **거시 업데이트 (Macro)**: 60초마다 월드 전체의 바람 벡터 필드(40x40 그리드)를 재계산하여 기후 패턴을 결정합니다.
    *   **미세 펄싱 (Micro)**: 매 프레임마다 사인 파동을 적용하여 벡터의 길이를 신축(Stretching)시킴으로써 대기가 '숨쉬는' 듯한 효과를 줍니다.
*   **시각화**: 신축성 벡터 막대로 표현. 바람이 없을 때는 점(Dot)으로 표시되며, 강할수록 막대가 묵직하게 늘어납니다.

8.3 비옥도 및 식생 순환 (Fixed Fertility System Specification) 🛠️ 최종 확정

대지는 양분을 무작위로 머금고, 이를 유기적으로 순환시키는 정밀한 생태계 자원으로 관리됩니다. 본 규격은 시뮬레이션의 안정성을 위해 최종 확정되었으며, 이후 임의 변경을 금지합니다.

*   **데이터 모델 (Quantized Nutrient Model)**:
    *   모든 타일은 `0.0`(완전 불모)에서 `1.0`(최대 비옥) 사이의 부동 소수점 비옥도 수치를 가집니다.
*   **핵심 초기화 (Core Randomization - TerrainGen)**:
    *   지형 생성 시 모든 토지 바이옴(DIRT, GRASS, JUNGLE)에 `0.1 ~ 1.0` 사이의 무작위 비옥도 값을 즉시 주입하여 월드의 다양성을 확보합니다.
*   **생태계 지속 가능성 (0.1 Ecological Floor)**:
    *   토지 지형은 자원(식물 등)에 의해 양분이 소모되거나 주변으로 확산되더라도, 최소 `0.1`(10%)의 비옥도를 엄격하게 유지하여 생태계 붕괴를 방지합니다.
*   **수용량 및 격리 (Capacity & Isolation)**:
    *   **토지 수용량**: 모든 토지 바이옴의 최대 비옥도 수용량은 `1.0`으로 통일되어 랜덤하게 주입된 양분을 온전히 보존합니다.
    *   **비토지 격리**: 바다, 산맥 등 비토지 지형은 수용량이 `0.0`으로 고정되며, 어떠한 비옥도도 보유하거나 전파할 수 없는 완전한 격리 장벽 역할을 수행합니다.
*   **확산 엔진 (Diffusion Engine)**:
    *   인접한 토지 타일 간에 농도 기울기에 따른 비옥도 확산 알고리즘을 적용합니다 (확산 계수: `0.15`).
    *   비토지 지형은 확산 경로를 차단하는 '싱크홀' 또는 '장벽'으로 작동하여 양분의 누수를 원천 차단합니다.
*   **시각화 규격 (Visual Specification)**:
    *   **10단계 세분화 팔레트**: 10% 단위로 빨강 ➔ 노랑 ➔ 초록으로 이어지는 고대비 팔레트를 적용하여 미세한 수치 변화를 시각적으로 전달합니다.
    *   **실시간 수치 툴팁 (🔢)**: 엔진 레벨에서 마우스 커서 위치의 정확한 비옥도 퍼센트(%)를 HUD 형태로 즉시 렌더링합니다.


5. 📱 사용자 상호작용 및 UI 연동 (ui/)

5.1 픽셀 정밀 타겟팅
- 사용자가 캔버스 터치 시 엔진 공간 해시맵을 조회하여 해당 1px 좌표의 Entity ID 추출.

5.2 상세 상태창 (StatusPanel.vue)
- 선택된 Entity ID의 컴포넌트 데이터를 Pinia 스토어를 통해 UI에 바인딩.
- 종류, 자원량(프로그레스 바), 체력 등 상세 표시.
- 빈 공간 터치 시 자동 닫기.

5.3 확장형 도구 모음 (BottomMenu.vue)
- 확장형 메뉴 레이아웃으로 구현.
- '나무 심기', '물 뿌리기', '번개 내리기' 등 신(God) 능력 아이콘 배치.



3. 핵심 아키텍처 명세

3.1 ECS (Entity Component System)

Entity: 고유 ID(정수형)만을 가지는 빈 객체 (생명체뿐만 아니라 건물도 하나의 Entity입니다).

Component: 로직이 배제된 순수 데이터 구조체.

System: 매 프레임(Tick)마다 특정 Component 조합을 가진 Entity들을 필터링하여 로직을 수행.

3.2 초고속 & 부드러운 렌더링 시스템 (render/)

물리 틱과 렌더 틱 분리: 물리 연산은 고정 프레임(예: 30틱/초)으로 처리하고, 렌더링은 가변 프레임(디스플레이 주사율, 60~120fps)으로 처리합니다.

보간 연산 (Interpolation): EntityRenderer.js에서는 deltaTime을 활용해 물리적으로 1px 이동하더라도 화면에서는 소수점 단위의 부드러운 이동(블렌딩)을 보여줍니다.

다중 버퍼링: 지형, 건물, 생명체, 파티클의 Uint32Array 버퍼들을 Z-index 기반으로 병합하여 단 1번의 Draw Call로 출력.

3.3 상태 기계 기반 행동 AI (behavior/)

방대한 행동 패턴은 FSM(유한 상태 기계) 패턴으로 제어됩니다.

BehaviorSystem은 현재 State 컴포넌트 값을 바탕으로 상태 전이를 제어하며, 구체적 로직은 개별 State 파일로 캡슐화됩니다.

3.4 자원 경제 및 밸런스 통제 시스템 (economy/)

중앙 집중식 밸런스 제어: 모든 생산/소비 수치는 config/resource_balance.json에서 로드됩니다. 코드 하드코딩을 배제하여 기아, 과잉 번식, 자원 고갈 등을 통제합니다.

자원 순환 루프: 스폰(Spawner) -> 채집(Gathering) -> 소비(Consumption)로 이어지는 순환 체계 구축.

3.5 건축 및 문명 발전 시스템 (civilization/)

건축 로직 (Construction): 지능이 있는 종족(인간, 레콘, 나가)은 특정 조건에서 맵 상에 '건물 청사진(투명한 Entity)'을 스폰합니다. 주변의 Builder 컴포넌트를 가진 개체들이 BuildState 상태로 진입하여 인벤토리의 자원을 소모해 건물을 완성합니다.

건물의 기능: 완성된 건물(Structure)은 생명체에게 혹독한 환경(추위, 열기)을 피할 수 있는 '피난처(Shelter)'를 제공하거나, 남는 자원을 보관하는 '창고', 전투 시 방어력을 제공하는 '성벽' 역할을 합니다.

기술 트리 (Tech Tree): ProgressSystem은 특정 군락의 인구수, 누적 자원, 생존 시간을 체크하여 tech_tree.json에 따라 시대를 발전시킵니다. (예: 야생 -> 석기 -> 철기). 시대가 발전할수록 렌더링되는 건물의 픽셀 형태가 달라지고 고도화된 행동 패턴이 해금됩니다.

4. 환경 및 생태계 기획 명세

4.1 지형 및 기후 시스템

고도: 심해(0) ~ 매우 높은 산(100), 펄린 노이즈(Perlin Noise) 사용.

기후: 고도, 온도, 습도 행렬 교차로 환경 타일 결정. 자원 스폰(Spawn) 확률은 이 기후에 직접적인 영향을 받습니다.

4.2 3대 종족 특성 명세

인간 (Human): Adaptable 특성 보유. 기후 패널티 상쇄. 

$$건축$$

 다양한 기후에 맞춰 가장 다채로운 형태의 건물을 짓고 빠르게 기술 시대를 발전시킵니다.

레콘 (Recon): Hydrophobia 특성 보유. 물에 닿으면 BerserkState 진입. 육체적 스탯이 높아 채집 속도 및 전투력이 압도적입니다. 

$$건축$$

 무기를 제련하는 대장간 등 전투와 관련된 건물을 선호하며, 배나 수상 건축물은 절대 짓지 못합니다.

나가 (Naga): ColdBlooded 특성 보유. 저온에서 지속 피해. 

$$건축$$

 추위를 이겨내기 위해 열을 보존하는 늪지/정글 특화 건축물을 지으며, 환경과 동화되는 성향을 띱니다.

4.3 생태계 상호작용 및 자원 경쟁

특정 기후에 가뭄이 들거나 자원(ResourceNode)이 고갈되면 생태계 연쇄 붕괴가 일어납니다. 반면, 문명을 이룬 종족은 창고(Structure)에 보관된 자원을 소모하여 흉년을 버텨낼 수 있습니다.

5. Vue + JS 코어 통합 및 생명주기 관리

WorldBoxMainView.vue 마운트 시 new Engine(canvasContext) 호출.

뷰 언마운트 시 반드시 engine.stop() 호출로 requestAnimationFrame 취소 및 메모리 누수 방지.

6. 단계별 구축 계획 (Implementation Plan)

본 프로젝트는 복잡도가 매우 높으므로, 핵심 뼈대부터 점진적으로 살을 붙여나가는 6단계 마일스톤으로 진행합니다.

Phase 1: 엔진 코어 및 1px 렌더링 기반 구축 (Foundation)

가장 중요한 기술적 허들인 "1px 렌더링 최적화"와 "Vue와의 격리"를 검증하는 단계입니다.

WorldBoxMainView.vue와 GameCanvas.vue 생성 및 라우터 연결.

순수 JS 기반의 Engine.js, EntityManager.js 초기화 로직 구현.

Uint32Array 버퍼 조작을 이용한 RenderCoordinator 및 EntityRenderer 기초 구현.

목표: 화면에 1만 개의 더미 픽셀(Entity)을 띄우고 60fps가 방어되는지 성능 테스트(PoC) 완료.

Phase 2: 지형 생성 및 월드 시스템 (World Generation)

생태계가 살아갈 무대를 절차적으로 생성하는 단계입니다.

MathUtils.js에 Perlin Noise 알고리즘 적용.

TerrainGen.js를 통해 고도/온도/습도 데이터를 조합하여 화면에 1px 단위의 지형 맵(바다, 모래, 잔디, 산 등) 렌더링.

ChunkManager.js를 도입하여 화면에 보이는 영역의 데이터만 메모리에 활성화하는 최적화 작업.

목표: 게임 실행 시 무작위의 거대하고 자연스러운 대륙과 기후가 렌더링됨.

Phase 3: 데이터 주도 설계 및 엔티티 스폰 (Data & Entities)

ECS 구조의 핵심인 컴포넌트 데이터와 팩토리 시스템을 구축합니다.

config 폴더 내 JSON 파일(traits_db.json, species.json) 스키마 설계 및 데이터 작성.

EntityFactory.js 구현: JSON 데이터를 읽어 인간, 레콘, 나가, 동식물 프리팹 조립 로직 완성.

MovementSystem 및 CollisionSystem 구현으로 개체들이 물리 틱에 맞춰 지형 위를 부드럽게 이동하도록(보간 연산 포함) 처리.

목표: 종족 및 동물 픽셀들이 지형 위를 돌아다니며 산맥, 강 등의 충돌 처리가 정상 작동함.

Phase 4: FSM 행동 AI 및 생태계 밸런스 (AI & Economy)

시뮬레이션의 본질인 상호작용과 자원 경제를 구현합니다.

resource_balance.json 적용 및 SpawnerSystem을 통한 식물/광석 자원 배치.

BehaviorSystem 및 개별 상태(IdleState, HuntState, GatherState 등) 구현.

먹이사슬 상호작용(감지 -> 추적 -> 전투/포식) 및 자원 채집(GatheringSystem) 연동.

환경 패널티(EnvironmentSystem) 적용 (레콘의 물 공포증, 나가의 동사 등).

목표: 개체들이 스스로 자원을 찾고 번식하며 굶어 죽는 등 완벽한 생태계 사이클이 자동으로 굴러감.

Phase 5: 문명 발전 및 건축 시스템 (Civilization & Construction)

생존을 넘어선 종족들의 사회/기술적 진보를 구현합니다.

buildings.json, tech_tree.json 스키마 작성 및 적용.

개체들이 자원을 모아 특정 위치에 건물을 짓는 BuildState 및 ConstructionSystem 개발.

군락의 자원/인구수 기반으로 기술이 발전하고 새로운 건축물이 해금되는 ProgressSystem 구현.

지형 픽셀 위에 다중 픽셀로 이루어진 건물 렌더링 처리.

목표: 원시 종족이 점차 자원을 축적해 집을 짓고 마을을 형성하며, 시대에 따라 형태가 변하는 과정을 관찰할 수 있음.

Phase 6: UI 오버레이 및 폴리싱 (UI & Polishing)

시뮬레이션 관찰과 개입을 위한 Vue 기반 사용자 인터페이스를 완성합니다.

Pinia 스토어와 JS 코어 엔진 간의 상태 동기화 파이프라인 구축.

캔버스 픽셀 클릭/터치 시 해당 Entity(생물체 또는 건물)의 StatusPanel.vue 노출.

BottomMenu.vue를 통해 사용자가 직접 재해를 일으키거나 건물을 스폰시키는 "신(God)" 기능 구현.

전체 코드 리팩토링 및 모바일 브라우저 크로스 브라우징/메모리 누수 테스트 진행.

목표: 최종 서비스 가능한 수준의 완성된 모바일 지구 시뮬레이션 모듈 배포.

7. 8방향 모션 및 정밀 렌더링 세부 명세서 (Advanced Rendering Spec) 🌟 신규

지형은 1px 단위로 렌더링되지만, 주요 생명체(인간, 레콘, 나가, 대형 동물 등)의 시각적 디테일과 부드러운 움직임을 표현하기 위해 모듈형 다중 픽셀(Modular Multi-Pixel) 아키텍처와 8방향 렌더링 시스템을 도입합니다.

7.1 8방향 모션 시스템 (8-Directional Motion)

단순한 상하좌우가 아닌, 360도의 이동 벡터를 8개의 기준축으로 양자화하여 애니메이션을 재생합니다.

방향 계산: Velocity 컴포넌트의 벡터(vx, vy) 각도를 계산하여 8방향(N, NE, E, SE, S, SW, W, NW) 중 하나로 변환합니다.

상태별 모션 매핑: BehaviorSystem에서 결정된 현재 상태(걷기, 뛰기, 채집, 공격)와 계산된 '8방향'을 조합하여 sprite_animations.json에 정의된 프레임 데이터를 호출합니다.

예시: state: HUNT, direction: SE -> 우측 하단으로 무기를 휘두르는 애니메이션 프레임 재생.

7.2 정밀한 모듈형 신체 구조 (Modular Body Structure)

생명체를 단순한 하나의 스프라이트 이미지가 아닌, 여러 부위(Part)가 결합된 **계층형 픽셀 뼈대(Skeletal/Modular Pixel)**로 구성합니다.

신체 분리: 머리(Head), 몸통(Torso), 왼팔/오른팔(Arms), 왼다리/오른다리(Legs)를 개별적인 로컬 픽셀 배열(Local Offset)로 정의합니다.

동적 렌더링 (Dynamic Layering):

각 신체 부위는 중심점(Center Pivot)을 기준으로 고유의 Z-index와 상대적 좌표(Offset)를 가집니다.

개체가 무기를 들거나 갑옷을 입으면, 해당 부위(예: 오른팔)의 픽셀 데이터만 무기 픽셀로 교체되거나 덧씌워집니다.

걷기 모션 시 몸통은 고정된 채 팔과 다리의 오프셋 좌표만 주기성(Sine wave 등)을 띄며 앞뒤로 교차 이동하여 매우 자연스러운 모션을 만들어냅니다.

7.3 고성능 버퍼 렌더링 파이프라인 (Buffer Blitting)

수천 마리의 다중 픽셀 생명체가 8방향 모션을 취할 때 발생하는 성능 저하를 막기 위한 기술적 해결책입니다.

Pre-calculated Sprite Atlas: 8방향 신체 부위별 픽셀 오프셋 데이터를 게임 로드 시 1차원 Uint32Array 버퍼 조각으로 미리 계산해 둡니다.

블리팅(Blitting) 연산: AnimationSystem은 프레임마다 개체의 신체 부위별 오프셋을 조합하고, EntityRenderer는 조립된 픽셀 덩어리를 메인 캔버스 버퍼(this.data[index])에 메모리 복사(set) 방식으로 한 번에 찍어냅니다. 이를 통해 복잡한 정밀 구조도 1px 렌더링과 동일한 연산 속도를 보장합니다.