# WorldBox 성능 고도화 및 작업 계획 (총 40단계)

## 1. 🖼️ 타일 기반 청크 렌더링 (Tiled Rendering & Culling) - 상세 계획

1. **청크 데이터 구조 설계**
   - **수정/생성 파일:** `engine/world/Chunk.js` (생성), `engine/world/ChunkManager.js` (수정)
   - **설명:** 전체 10,000 x 10,000 맵을 512 x 512 단위의 청크 인스턴스로 분할하는 2D 배열 및 관리자 객체를 설계합니다.
   - **점검할 파일:** `engine/world/TerrainGen.js` (기존 전역 배열 초기화 방식이 청크 단위로 호환되는지 확인)

2. **독립된 캔버스 할당**
   - **수정/생성 파일:** `engine/world/Chunk.js`
   - **설명:** 단일 거대 캔버스 대신 각 청크 인스턴스 내에 자신만의 `OffscreenCanvas`를 가지도록 생성자 메모리 구조를 설계합니다.
   - **점검할 파일:** `index.js`, `engine/systems/render/RenderCoordinator.js` (메인 캔버스 렌더링 타겟 확인)

3. **카메라 뷰포트 시스템 확장**
   - **수정 파일:** `engine/core/Camera.js`
   - **설명:** 현재 카메라 시야 영역(AABB, 축 정렬 바운딩 박스) 좌표를 정확히 계산하고 반환하는 `getViewportBounds()` 등의 메서드를 추가합니다.
   - **점검할 파일:** `engine/systems/input/InputSystem.js` (줌 인/아웃 시 Bounds 변화가 정상적으로 반영되는지 확인)

4. **Culling 로직 구현**
   - **수정 파일:** `engine/world/ChunkManager.js`
   - **설명:** 매 프레임마다 Camera의 뷰포트 영역과 각 청크의 범위를 교차 검사하여, 화면에 들어온 청크만 배열로 반환하는 `getVisibleChunks()` 메서드 구현.
   - **점검할 파일:** `engine/utils/MathUtils.js` (AABB 교차 검산용 유틸리티 함수 확인)

5. **선별적 렌더링 루프 적용**
   - **수정 파일:** `engine/systems/render/RenderCoordinator.js`
   - **설명:** 전체 맵을 그리는 방식에서 벗어나, 메인 루프에서 `ChunkManager.getVisibleChunks()`로 얻은 청크들만 메인 캔버스에 `drawImage` 하도록 재작성합니다.
   - **점검할 파일:** `engine/core/Engine.js` (루프 순서 및 렌더 파이프라인 정합성 확인)

6. **청크 풀링(Pooling) 및 캐싱**
   - **수정 파일:** `engine/world/ChunkManager.js`, `engine/world/Chunk.js`
   - **설명:** 지형 변화가 생길 때만 `isDirty` 플래그를 true로 만들고, 시야에서 벗어난 청크는 즉시 파괴하지 않고 캐싱(LRU 구조)하여 재진입 시 연산을 스킵합니다.
   - **점검할 파일:** `engine/core/EventBus.js` (지형 폭발, 브러시 등 지형 변경 이벤트 시 해당 청크에 dirty 마킹이 제대로 되는지 확인)

7. **LOD (Level of Detail) 뼈대 구축**
   - **수정 파일:** `engine/systems/render/RenderCoordinator.js`, `engine/core/Camera.js`
   - **설명:** 카메라 줌 거리(Scale)를 기준으로 LOD 0(원거리), LOD 1(근거리) 상수 임계값을 정의하고 렌더 분기점을 마련합니다.
   - **점검할 파일:** `engine/world/Chunk.js` (LOD별 렌더링 상태를 담을 수 있는 변수 공간 확인)

8. **원거리 저해상도 렌더링 (LOD 0)**
   - **수정 파일:** `engine/world/Chunk.js`
   - **설명:** 멀리서 볼 때 개별 픽셀 연산을 무시하고 청크의 16x16 축소된 텍스처(미니맵 형태)를 빠르게 그려주는 `generateMinimap()` 및 `renderLOD0()` 구현.
   - **점검할 파일:** `engine/systems/render/RenderCoordinator.js` (카메라가 원거리일 때 LOD 0 함수를 호출하는지 검증)

9. **근거리 고해상도 렌더링 (LOD 1)**
   - **수정 파일:** `engine/world/Chunk.js`, `engine/core/EntityManager.js`
   - **설명:** 카메라가 근접했을 때만 개별 픽셀과 엔티티들을 정밀하게 오프스크린 캔버스에 그리는 `renderLOD1()` 구현. 엔티티들도 자신이 속한 청크 위에서 그려지게 합니다.
   - **점검할 파일:** `engine/systems/render/RenderCoordinator.js` (줌인 시 LOD 1로 부드럽게 화면이 전환되며 끊김이 없는지 확인)

10. **렌더링 성능 검증**
    - **수정 파일:** `engine/core/StatsMonitor.js`
    - **설명:** 청크 분할 적용 전후의 FPS, 화면에 렌더링되는 청크 갯수, 드로우 콜(Draw Call) 횟수, 메모리 점유율을 기록하고 화면에 출력하는 모니터링 UI 추가 및 확장.
    - **점검할 파일:** `index.js`, `engine/core/Engine.js` (빠르게 화면 스크롤 시 경계선 잘림, 하얀 빈 공간 노출 등 엣지 케이스 디버깅)

## 2. 🧵 워커 기반 시뮬레이션 (Web Worker Threads) - 상세 계획

11. **시뮬레이션 워커 스크립트 생성**
    - **생성/수정 파일:** `engine/workers/simulationWorker.js` (생성), `engine/core/Engine.js` (수정)
    - **설명:** 로직 연산을 백그라운드 스레드로 분리할 Web Worker 파일을 생성하고, 메인 스레드와 `postMessage` 기반의 양방향 통신 인터페이스를 구축합니다.
    - **점검할 파일:** `vite.config.js` (또는 프로젝트의 번들러 설정, 워커 로더 지원 여부 확인)

12. **데이터 구조 마이그레이션**
    - **수정 파일:** `engine/world/TerrainGen.js`, `engine/world/ChunkManager.js`
    - **설명:** 지형 속성(비옥도, 바이옴, 수질 등) 데이터를 워커와 효율적으로 공유할 수 있도록 기존 일반 객체 배열 구조에서 연속된 `TypedArray` (예: `Uint8Array`, `Float32Array`) 구조로 전면 마이그레이션합니다.
    - **점검할 파일:** `engine/systems/render/RenderCoordinator.js` (TypedArray 포맷에 맞춘 렌더링 호환성 확인)

13. **SharedArrayBuffer 적용**
    - **수정 파일:** `engine/core/Engine.js`, `engine/world/TerrainGen.js`
    - **설명:** `SharedArrayBuffer`를 활용해 메인 스레드와 워커 간에 메모리를 공유하여, 1.6GB에 달하는 거대한 맵 데이터를 복사 오버헤드 없이 즉시 양방향 참조할 수 있는 기반을 마련합니다.
    - **점검할 파일:** `index.html`, 백엔드 서버 설정 (COOP/COEP HTTP 헤더 설정 등 보안 정책으로 인한 차단 여부 점검)

14. **비옥도 전파(Fertility) 로직 이전**
    - **수정 파일:** `engine/workers/simulationWorker.js`, `engine/systems/lifecycle/EnvironmentSystem.js`
    - **설명:** 메인 스레드의 `EnvironmentSystem`에서 처리하던 비옥도 확산 연산을 제거하고, 이를 워커 내부로 옮겨 백그라운드의 독립적인 시뮬레이션 틱(Tick)에서 처리하도록 구현합니다.
    - **점검할 파일:** `engine/components/environment/SoilFertility.js` (데이터 접근 방식이 워커 환경과 호환되는지 확인)

15. **바이옴 확산(Biome) 로직 이전**
    - **수정 파일:** `engine/workers/simulationWorker.js`, `engine/systems/lifecycle/EnvironmentSystem.js`
    - **설명:** 식생 성장 및 바이옴 확산 알고리즘 역시 워커로 이전하며, 비옥도 전파 로직과 병렬로 처리되거나 순차 스케줄링되도록 연산 루프를 통합합니다.
    - **점검할 파일:** `engine/world/zones/ZoneData.js` (바이옴 및 구역 데이터 참조 방식 점검)

16. **수질 오염 및 흐름 계산 이전**
    - **수정 파일:** `engine/workers/simulationWorker.js`, `engine/systems/lifecycle/EnvironmentSystem.js`
    - **설명:** 가장 연산량이 많은 유체의 흐름, 수위 변화 및 오염도 확산 시뮬레이션을 백그라운드 워커에 전담시켜 메인 UI 스레드의 부하를 해소합니다.
    - **점검할 파일:** `engine/components/environment/WaterQuality.js` (수질 데이터 캐싱 방식 확인)

17. **렌더링 동기화**
    - **수정 파일:** `engine/systems/render/RenderCoordinator.js`, `engine/world/ChunkManager.js`
    - **설명:** 워커 스레드가 백그라운드에서 업데이트한 `SharedArrayBuffer` 데이터를 메인 스레드는 오직 "읽기"만 수행하여 화면에 렌더링하도록 두 스레드 간의 읽기/쓰기 역할을 완벽히 분리합니다.
    - **점검할 파일:** `engine/core/Engine.js` (메인 렌더 루프와의 프레임 찢김(Tearing) 현상 방지 동기화 확인)

18. **워커 Tick Rate 스케줄링**
    - **수정 파일:** `engine/workers/simulationWorker.js`, `engine/core/TimeSystem.js`
    - **설명:** 백그라운드 시뮬레이션 연산 주기를 조절하여 CPU 100% 점유를 방지하고, 메인 스레드에서 설정한 게임 배속(1x, 2x, 5x) 명령을 받아 워커 틱을 동적으로 스케줄링합니다.
    - **점검할 파일:** `engine/core/UISystem.js` (UI에서 배속 조절 시 워커로 이벤트 통신이 정상적으로 가는지 확인)

19. **사용자 입력 동기화 큐**
    - **수정 파일:** `engine/core/EventBus.js`, `engine/workers/simulationWorker.js`
    - **설명:** 메인 스레드에서 유저가 브러시(지형 변경, 폭탄 등)를 사용했을 때, 해당 상호작용이 워커의 시뮬레이션 메모리에 즉시 반영되도록 양방향 이벤트 큐(Queue) 통신 구조를 설계합니다.
    - **점검할 파일:** `engine/systems/tools/brushes/BrushStrategy.js` 및 관련 브러시 시스템 (명령이 데이터 수정 대신 큐 발송으로 전환되었는지 확인)

20. **동시성 제어 및 Atomics**
    - **수정 파일:** `engine/workers/simulationWorker.js`, `engine/core/Engine.js`
    - **설명:** `Atomics` API를 활용하여 두 스레드가 동일한 타일 메모리에 동시 접근(Race Condition)하여 발생하는 데이터 오염을 방지하기 위한 동기화 락킹 및 대기 처리 로직을 구현합니다.
    - **점검할 파일:** `engine/utils/MathUtils.js` (Atomics 관련 커스텀 유틸리티 헬퍼 함수 존재/추가 필요 여부 점검)

## 3. 🗺️ 계층적 길찾기 (Hierarchical Pathfinding - HPA*) - 상세 계획

21. **상위 계층 구역(Zone) 분할**
    - **수정 파일:** `engine/world/zones/ZoneData.js`, `engine/utils/Pathfinder.js`
    - **설명:** 수백만 개의 타일을 100x100 크기의 상위 논리적 구역(Zone)들로 묶어 거시적 이동망을 구축하는 데이터 구조 설계.
    - **점검할 파일:** `engine/systems/civilization/ZoneManager.js` (기존 Zone 관리 로직과 충돌 여부 확인)

22. **경계점(Transition Node) 탐색**
    - **수정 파일:** `engine/utils/Pathfinder.js`
    - **설명:** 인접한 Zone 간에 막히지 않고 이동 가능한 통로(게이트) 노드들을 자동으로 찾아내어 상위 계층 그래프 맵 구성.
    - **점검할 파일:** `engine/world/TerrainGen.js` (지형 생성 완료 후 경계점 초기화가 제대로 호출되는지 확인)

23. **동적 Zone Update 시스템**
    - **수정 파일:** `engine/world/ChunkManager.js`, `engine/utils/Pathfinder.js`
    - **설명:** 유저가 장벽을 세우거나 지형이 파괴되어 통로가 막힐 경우, 실시간으로 해당 Zone의 경계점 및 연결망을 재계산하는 업데이트 트리거 구현.
    - **점검할 파일:** `engine/systems/tools/brushes/BrushStrategy.js`, `engine/systems/civilization/ConstructionSystem.js` (건설/파괴 이벤트 발생 시 트리거 확인)

24. **1차 탐색 (거시적 경로 검색)**
    - **수정 파일:** `engine/utils/Pathfinder.js`
    - **설명:** 출발지 Zone에서 목적지 Zone까지 상위 계층 노드만을 활용해 A* 탐색을 수행하여 구역 단위의 Abstract Path를 계산.
    - **점검할 파일:** `engine/components/behavior/Target.js` (경로 데이터를 담을 수 있는 구조인지 확인)

25. **2차 탐색 (미시적 경로 검색)**
    - **수정 파일:** `engine/utils/Pathfinder.js`
    - **설명:** 1차 탐색 결과에 따라 현재 위치한 Zone 내부에서 다음 경계점 출구까지만의 상세한 타일 단위 Local Path를 A*로 계산.
    - **점검할 파일:** `engine/utils/MathUtils.js` (거리 계산 등 휴리스틱 함수 최적화 여부 확인)

26. **실시간 경로 갱신 AI 로직**
    - **수정 파일:** `engine/systems/behavior/states/WanderState.js`, `engine/systems/behavior/states/jobs/BaseJobState.js`
    - **설명:** 캐릭터가 구역의 경계를 넘어서 다음 Zone으로 진입할 때마다, 동적으로 다음 경계점까지의 2차 탐색을 트리거하도록 AI 스테이트 머신 개편.
    - **점검할 파일:** `engine/systems/behavior/AnimalBehaviorSystem.js`, `engine/systems/behavior/HumanBehaviorSystem.js` (스테이트 갱신 사이클 확인)

27. **탐색 요청 Time-Slicing**
    - **수정 파일:** `engine/core/SystemManager.js`, `engine/utils/Pathfinder.js`
    - **설명:** 다수의 엔티티가 동시에 길찾기를 요청할 경우 메인 루프가 정지하지 않도록, 연산을 여러 프레임으로 분산시키는 대기열(Queue) 시스템 적용.
    - **점검할 파일:** `engine/core/Engine.js` (메인 루프의 프레임 드롭 여부 모니터링)

28. **경로 캐싱 (Memoization)**
    - **수정 파일:** `engine/utils/Pathfinder.js`
    - **설명:** 큰 도로 같은 자주 이용되는 특정 Zone 간의 최단 경로는 한 번 계산 후 해시맵에 캐싱해두어 동일 연산을 획기적으로 생략.
    - **점검할 파일:** `engine/core/EventBus.js` (지형 변경 시 캐시 무효화(Invalidation) 이벤트가 정상 작동하는지 확인)

29. **로컬 스티어링 및 충돌 회피**
    - **수정 파일:** `engine/systems/motion/KinematicSystem.js`, `engine/systems/motion/CollisionSystem.js`
    - **설명:** 경로를 따라 이동하는 도중 다른 엔티티와 겹치지 않도록 밀어내는 회피 비헤이비어(Boids Steering)를 계층적 이동 로직과 부드럽게 결합.
    - **점검할 파일:** `engine/components/motion/Velocity.js`, `engine/utils/SpatialHash.js` (근접 엔티티 검색 성능 확인)

30. **대규모 엔티티 병목 테스트**
    - **수정 파일:** `engine/core/StatsMonitor.js`
    - **설명:** HPA* 적용 후 엔티티 수를 1,000마리에서 10,000마리까지 점진적으로 늘려가며 프로파일링을 통해 병목 지점을 찾고 최적화 완료.
    - **점검할 파일:** `ui/components/MapSettings.vue` (엔티티 스폰 테스트용 디버그 UI 컨트롤 확인)

## 4. 💾 데이터 지향 설계 (Data-Oriented Design) - 상세 계획

31. **위치 데이터 배열화 (Position Buffer)**
    - **수정 파일:** `engine/components/motion/Transform.js`, `engine/core/EntityManager.js`
    - **설명:** 모든 엔티티의 x, y 위치 정보를 일반 객체의 프로퍼티가 아닌, 단일 `Float32Array`의 연속된 메모리 공간에 저장하도록 구조 변경.
    - **점검할 파일:** `engine/systems/motion/KinematicSystem.js` (위치 갱신 참조 방식 확인)

32. **물리 데이터 분리 (Velocity Buffer)**
    - **수정 파일:** `engine/components/motion/Velocity.js`, `engine/core/EntityManager.js`
    - **설명:** 물리 이동 연산에 필수적인 속도 및 가속도 데이터를 `Float32Array`로 분리하여 CPU 캐시 친화적인 상태 패킹(Packing) 적용.
    - **점검할 파일:** `engine/systems/motion/CollisionSystem.js` (충돌 후 속도 변화 로직 확인)

33. **상태 데이터 배열화 (Stats Buffer)**
    - **수정 파일:** `engine/components/stats/Health.js`, `engine/components/stats/BaseStats.js`, `engine/core/EntityManager.js`
    - **설명:** 체력, 마나, 스태미나 등 게임 내 로직에 필요한 각 엔티티의 상태 값을 `Int32Array`에 저장하고 고유 Index로 참조하도록 마이그레이션.
    - **점검할 파일:** `engine/systems/behavior/CombatSystem.js` (데미지 계산 시 버퍼 참조 방식 확인)

34. **Data-Oriented 루프 재작성**
    - **수정 파일:** `engine/core/System.js`, `engine/core/SystemManager.js`
    - **설명:** `entity.update()`를 개별적으로 호출하던 기존 OOP 방식을 폐기하고, System 함수 단위로 연속된 Buffer 배열들을 한 번에 순회 연산하는 방식으로 전면 수정.
    - **점검할 파일:** `engine/core/Engine.js` (메인 루프 내 각 시스템 호출 순서 및 방식 점검)

35. **Movement System 통합**
    - **수정 파일:** `engine/systems/motion/KinematicSystem.js`
    - **설명:** 오직 위치와 속도 Buffer만을 인자로 받아 전체 엔티티의 다음 프레임 이동 좌표를 초고속 일괄 계산하는 물리 이동 전담 시스템 구현.
    - **점검할 파일:** `engine/systems/motion/HerdingSystem.js` (그룹 이동 로직과의 호환성 확인)

36. **Render System 최적화**
    - **수정 파일:** `engine/systems/render/EntityRenderer.js`, `engine/systems/render/SpriteManager.js`
    - **설명:** 렌더링 시에도 객체를 순회하지 않고 Position Buffer와 텍스처 인덱스 Buffer를 매칭하여 렌더 파이프라인에 데이터를 스트리밍하도록 최적화.
    - **점검할 파일:** `engine/systems/render/RenderCoordinator.js` (렌더링 드로우 콜 호출 최적화 확인)

37. **엔티티 팩토리 패턴 도입**
    - **수정 파일:** `engine/factories/core/EntityBuilder.js`, `engine/factories/core/FactoryProvider.js`
    - **설명:** 새 엔티티 스폰 시 `new Class()`를 호출하지 않고, Buffer 내의 비어있는 인덱스를 찾아 값을 덮어씌워 재활용하는 팩토리(Factory) 방식 적용.
    - **점검할 파일:** `engine/factories/entities/HumanFactory.js`, `engine/factories/entities/AnimalFactory.js` (기존 생성 방식 대체 확인)

38. **오브젝트 풀링 플래그 관리**
    - **수정 파일:** `engine/utils/ObjectPool.js`, `engine/systems/behavior/DeathProcessor.js`
    - **설명:** 엔티티 사망 시 메모리 배열에서 삭제하지 않고, 별도의 활성화 플래그(Alive) 버퍼를 0으로 만들어 논리적으로 무효화하는 기법 도입.
    - **점검할 파일:** `engine/core/EntityManager.js` (엔티티 식별(ID) 재사용 로직 확인)

39. **비트마스크 컴포넌트 필터링**
    - **수정 파일:** `engine/components/stats/TagBitmask.js`, `engine/utils/BitmaskUtils.js`
    - **설명:** 각 엔티티가 어떤 데이터를 갖는지 비트마스크 정수로 표현하여, 특정 System이 연산해야 할 대상 인덱스를 비트 연산으로 빠르게 필터링하도록 고도화.
    - **점검할 파일:** `engine/core/System.js` (시스템별 요구 컴포넌트 마스크 정의 확인)

40. **DOD 최종 스트레스 테스트**
    - **수정 파일:** `engine/core/StatsMonitor.js`
    - **설명:** 기존 OOP 구조 대비 메모리 파편화 및 가비지 컬렉션(GC) 발생 횟수를 비교 측정하고, 10만 마리 규모의 엔티티 처리 안정성 확인.
    - **점검할 파일:** `ui/components/EntityStatusPanel.vue` (모니터링 데이터가 뷰에 잘 표시되는지 확인)

## 5. 🏛️ 국가 및 영토 시스템 고도화 (Nation & Zone System Enhancement) - 상세 계획
- 국가, 마을, 존(Zone) 시스템을 깊이 있게 고도화하여 세력 간 상호작용 및 영토 관리 알고리즘을 체계적으로 개선합니다.

41. **국가 중앙 집중화 모델 설계**
    - **수정 파일:** `engine/systems/civilization/NationSystem.js`, `engine/systems/civilization/SocialSystem.js`
    - **설명:** 국가 고유 속성 및 외교 상태를 통합 관리하기 위해 구조를 개편합니다.
    - **점검할 파일:** `engine/core/SystemManager.js` (시스템 로드 및 갱신 순서 확인)

42. **마을-국가 종속성 연결**
    - **수정 파일:** `engine/systems/civilization/VillageSystem.js`, `engine/systems/civilization/NationSystem.js`
    - **설명:** 생성된 마을이 특정 국가에 소속되어 자원과 인구를 공유하는 종속적 계층 구조를 구현합니다.
    - **점검할 파일:** `engine/core/EntityManager.js` (마을 및 국가 엔티티의 계층적 관계 설정 확인)

43. **영토(Zone) 확장 알고리즘**
    - **수정 파일:** `engine/systems/civilization/ZoneManager.js`, `engine/world/zones/ZoneData.js`
    - **설명:** 인구와 문화 수준에 따라 마을의 Zone이 주변 빈 타일로 자연스럽게 확장되는 시스템을 추가합니다.
    - **점검할 파일:** `engine/world/ChunkManager.js` (청크 데이터 갱신 시 Zone 변경 영역이 렌더링에 반영되는지 확인)

44. **마을 간 경계 충돌 처리**
    - **수정 파일:** `engine/systems/civilization/ZoneManager.js`, `engine/utils/GridUtils.js`
    - **설명:** 서로 다른 마을의 영토가 확장하며 맞닿을 때의 우선순위 및 병합/충돌 계산 로직을 고도화합니다.
    - **점검할 파일:** `engine/world/TerrainGen.js` (초기 생성 시 경계가 올바르게 설정되는지 확인)

45. **세력권(Influence) 렌더링**
    - **수정 파일:** `engine/systems/render/RenderCoordinator.js`, `engine/world/zones/ZoneData.js`
    - **설명:** 지도 위에 각 국가의 영토와 세력권을 고유한 색상과 알파값으로 시각화하는 오버레이 렌더러를 추가합니다.
    - **점검할 파일:** `engine/systems/render/EntityRenderer.js` (엔티티 렌더링과 오버레이 간의 Z-index 및 투명도 충돌 확인)

46. **국가 간 외교 시스템 기초**
    - **수정 파일:** `engine/systems/civilization/SocialSystem.js`, `engine/systems/civilization/NationSystem.js`
    - **설명:** 두 국가의 관계(동맹, 중립, 적대)를 결정하는 수치(우호도) 기반 외교 스탯을 도입합니다.
    - **점검할 파일:** `engine/components/civilization/SocialComponent.js` (개별 엔티티가 소속 국가의 외교 상태를 정상적으로 참조하는지 확인)

47. **전쟁 선포 및 영토 점령**
    - **수정 파일:** `engine/systems/civilization/NationSystem.js`, `engine/systems/civilization/ZoneManager.js`
    - **설명:** 적대 상태 시 상대의 마을 및 영토(Zone)를 침략하여 점령 상태로 전환하는 병합 기능을 구현합니다.
    - **점검할 파일:** `engine/systems/behavior/CombatSystem.js` (전쟁 상태 시 적군 타겟팅이 즉시 활성화되는지 확인)

48. **자원 조공 및 분배**
    - **수정 파일:** `engine/systems/economy/EconomyManager.js`, `engine/systems/civilization/VillageSystem.js`
    - **설명:** 마을이 모은 잉여 자원을 소속 국가의 중앙 창고로 납부하고 필요한 곳에 재분배하는 경제 순환을 구축합니다.
    - **점검할 파일:** `engine/components/resource/Storage.js` (국가 창고와 마을 창고 간의 자원 이동 동기화 확인)

49. **반란 및 독립 시스템**
    - **수정 파일:** `engine/systems/civilization/SocialSystem.js`, `engine/systems/civilization/NationSystem.js`
    - **설명:** 마을의 충성도가 낮아질 경우 기존 국가에서 탈퇴하여 새로운 국가를 세우는 이탈 알고리즘을 적용합니다.
    - **점검할 파일:** `engine/core/EventBus.js` (독립 선언 시 글로벌 이벤트 전파 및 UI 갱신 트리거 확인)

50. **세력 통계 및 디버그 UI**
    - **수정 파일:** `ui/components/NationDetailPanel.vue`, `ui/store/worldboxStore.js`
    - **설명:** 실시간 영토 크기, 인구 변동, 외교 상태를 모니터링할 수 있는 UI 패널을 구현합니다.
    - **점검할 파일:** `ui/views/WorldboxView.vue` (패널 마운트 및 Vuex(또는 Pinia) 데이터 바인딩 렌더링 상태 확인)

## 6. 👷 직업 시스템 확장 및 세분화 (Job System Expansion) - 상세 계획
- 기존 직업의 행동 패턴을 고도화하고, 사회 발전에 발맞춘 다양한 신규 직업군을 추가하여 생태계를 풍부하게 만듭니다.

51. **직업 팩토리 및 상태 분리**
    - **수정 파일:** `engine/components/behavior/JobController.js`, `engine/systems/roles/RoleFactory.js`
    - **설명:** 직업별 고유 행동 트리를 쉽게 확장하기 위해 모듈화 및 팩토리 패턴으로 개편합니다.
    - **점검할 파일:** `engine/systems/behavior/HumanBehaviorSystem.js` (직업 할당 및 상태 전환 처리 확인)

52. **농부(Farmer) 직업 강화**
    - **수정 파일:** `engine/systems/economy/FarmingSystem.js`, `engine/systems/behavior/states/jobs/FarmerState.js` (생성)
    - **설명:** 씨앗 뿌리기, 성장 대기, 수확까지 농업 사이클을 전담하는 체계적인 농부 AI를 구현합니다.
    - **점검할 파일:** `engine/components/environment/SoilFertility.js` (비옥도에 따른 작물 성장 속도 연계 확인)

53. **채굴자(Miner) 직업 추가**
    - **수정 파일:** `engine/systems/roles/MinerRole.js`, `engine/systems/behavior/states/jobs/MinerState.js` (생성)
    - **설명:** 산이나 바위 지형에서 광물 자원 노드를 찾아 이동하고 채굴하는 전문 광부 로직을 추가합니다.
    - **점검할 파일:** `engine/components/environment/MineralDensity.js` (광물 자원 고갈 시 타겟 재설정 확인)

54. **병사(Soldier) 및 경비병 로직**
    - **수정 파일:** `engine/systems/roles/SoldierRole.js` (생성), `engine/systems/behavior/CombatSystem.js`
    - **설명:** 국가 간 전쟁이나 맹수로부터 마을을 지키는 전투 특화 병사의 순찰 및 방어 비헤이비어를 구현합니다.
    - **점검할 파일:** `engine/systems/behavior/TargetManager.js` (적대적 엔티티 자동 스캔 및 어그로 전환 확인)

55. **운반자(Transporter) 역할 고도화**
    - **수정 파일:** `engine/systems/roles/OtherRoles.js`, `engine/systems/behavior/states/jobs/TransporterState.js`
    - **설명:** 채집된 자원을 마을 창고나 건설 현장으로 나르는 전담 운반자의 효율적인 물류 이동 AI를 구축합니다.
    - **점검할 파일:** `engine/components/resource/Storage.js` (운반자의 인벤토리 용량과 창고 수납 제한 확인)

56. **건축가(Architect) 비헤이비어**
    - **수정 파일:** `engine/systems/roles/ArchitectRole.js`, `engine/systems/civilization/ConstructionSystem.js`
    - **설명:** 마을의 발전 단계에 맞춰 새 건물 위치를 선정하고 자원을 소비해 건물을 짓는 건설 전담 AI를 추가합니다.
    - **점검할 파일:** `engine/components/civilization/Builder.js` (건축 진행률 및 건물 완성 상태 확인)

57. **지도자(Chief) 시스템**
    - **수정 파일:** `engine/systems/roles/ChiefRole.js`, `engine/systems/civilization/SocialSystem.js`
    - **설명:** 마을의 충성도와 작업 효율에 버프를 주고 외교적 방향에 영향을 미치는 이장(지도자) 직업을 도입합니다.
    - **점검할 파일:** `engine/components/civilization/SocialComponent.js` (버프 적용에 따른 작업 속도 변화 확인)

58. **직업 동적 스케줄링**
    - **수정 파일:** `engine/systems/civilization/VillageSystem.js`, `engine/systems/roles/RoleFactory.js`
    - **설명:** 마을 내 자원 상황이나 외부 위협에 따라 실시간으로 잉여 인력을 필요한 직업으로 재배치하는 전직 시스템을 구현합니다.
    - **점검할 파일:** `engine/components/behavior/JobController.js` (직업 전환 시 이전 상태의 안전한 종료 확인)

59. **직업별 요구 도구(Tool) 장착**
    - **수정 파일:** `engine/components/resource/Inventory.js`, `engine/systems/behavior/states/jobs/BaseJobState.js`
    - **설명:** 벌목꾼의 도끼, 병사의 창처럼 특정 장비 컴포넌트를 장착하여 작업 효율이나 전투력이 증가하는 로직을 추가합니다.
    - **점검할 파일:** `engine/components/resource/DroppedItem.js` (도구 제작 및 장착에 필요한 자원 소모 확인)

60. **직업 행동 모니터링**
    - **수정 파일:** `engine/core/StatsMonitor.js`, `engine/systems/roles/BaseRole.js`
    - **설명:** 캐릭터가 부여받은 직업에 맞춰 정상적으로 Task를 수행하고 완료 시 리셋하는지 검증하는 시뮬레이션 테스트를 진행합니다.
    - **점검할 파일:** `ui/components/EntityStatusPanel.vue` (각 개체의 현재 직업 및 Task 진행도 UI 업데이트 확인)

## 7. 🧠 시스템 통합 및 유기적 상호작용 (System Integration & AI Polish) - 상세 계획
- 앞서 고도화된 국가, 마을, 직업 시스템들이 서로 톱니바퀴처럼 완벽히 연계되어 자연스럽게 동작하는 완성도 높은 군집 AI를 구축합니다.

61. **HPA*와 직업 이동 통합**
    - **수정 파일:** `engine/systems/behavior/HumanBehaviorSystem.js`, `engine/utils/Pathfinder.js`
    - **설명:** 직업 AI가 장거리 이동을 할 때 3단계에서 구현한 계층적 길찾기를 호출하도록 연동합니다.
    - **점검할 파일:** `engine/systems/behavior/states/WanderState.js` (기존 단순 이동 로직과 HPA*의 전환점 확인)

62. **DOD 기반 직업 연산 맵핑**
    - **수정 파일:** `engine/core/EntityManager.js`, `engine/components/behavior/JobController.js`
    - **설명:** 4단계 데이터 지향 설계 버퍼에 직업 상태 플래그를 편입시켜, 직업 연산 스캔 속도를 비약적으로 최적화합니다.
    - **점검할 파일:** `engine/systems/behavior/AnimalBehaviorSystem.js` (동물 비헤이비어도 DOD 버퍼를 동일하게 참조하는지 확인)

63. **국가 상태에 따른 직업 수요 반영**
    - **수정 파일:** `engine/systems/civilization/NationSystem.js`, `engine/systems/civilization/VillageSystem.js`
    - **설명:** 전쟁 시 병사 강제 징집, 자원 부족 시 채집가 증원 등 국가 외교/경제 상태와 직업 수요를 양방향으로 연동합니다.
    - **점검할 파일:** `engine/systems/roles/RoleFactory.js` (수요 변화에 따른 직업 즉각 할당 로직 확인)

64. **생태계-문명 상호작용 심화**
    - **수정 파일:** `engine/systems/lifecycle/EnvironmentSystem.js`, `engine/workers/simulationWorker.js`
    - **설명:** 벌목이나 오염으로 인한 환경 파괴가 동물 생태계와 워커(Worker)의 바이옴 확산 시스템에 실시간 영향을 주도록 결합합니다.
    - **점검할 파일:** `engine/world/zones/ZoneData.js` (오염도에 따른 바이옴 변형 로직 확인)

65. **건축물-영토 시너지 구축**
    - **수정 파일:** `engine/components/civilization/Structure.js`, `engine/systems/civilization/ZoneManager.js`
    - **설명:** 방어탑, 성벽 등 특정 건물을 건설하면 해당 Zone의 국지적 방어력과 영토(Influence) 범위가 즉시 상승하도록 병합합니다.
    - **점검할 파일:** `engine/systems/behavior/CombatSystem.js` (방어탑 범위 내에서 방어력 보너스 적용 확인)

66. **자원 가치 동적 변동 알고리즘**
    - **수정 파일:** `engine/systems/economy/EconomyManager.js`, `engine/systems/economy/ConsumptionSystem.js`
    - **설명:** 국가별 자원 보유량에 따라 희소성을 계산하여, 수요가 가장 높은 자원에 우선적으로 인력을 배치하도록 마을 AI를 수정합니다.
    - **점검할 파일:** `engine/config/resource_balance.json` (기본 자원 가치 데이터와 동적 변동폭의 한계치 확인)

67. **군집 전투 비헤이비어 융합**
    - **수정 파일:** `engine/systems/motion/HerdingSystem.js`, `engine/systems/behavior/CombatSystem.js`
    - **설명:** 대규모 병사가 격돌할 때 Boids 알고리즘(회피/정렬)과 군집 단체 타겟팅 시스템을 통합하여 자연스러운 대규모 전투를 연출합니다.
    - **점검할 파일:** `engine/systems/motion/CollisionSystem.js` (유닛 간 과도한 겹침 방지 확인)

68. **이벤트 드리븐 커플링 분리**
    - **수정 파일:** `engine/core/EventBus.js`, 전역 시스템 파일들
    - **설명:** 영토 확장, 직업 전환 등 주요 변화 시 강결합을 피하고 `EventBus`를 통해 다른 시스템들이 즉각적으로 반응하도록 리팩토링합니다.
    - **점검할 파일:** `engine/core/SystemManager.js` (이벤트 리스너의 중복 등록 방지 및 메모리 누수 확인)

69. **데이터 직렬화 및 세이브/로드**
    - **수정 파일:** `engine/core/Engine.js`, `ui/store/worldboxStore.js`
    - **설명:** 국가, 영토, 직업 분포 등 얽혀있는 복합적인 시뮬레이션 상태를 안전하게 스냅샷 덤프하고 복원하는 로직을 통합합니다.
    - **점검할 파일:** `engine/world/ChunkManager.js` (세이브 데이터 로드 후 렌더링 상태 동기화 확인)

70. **장기 런타임 안정성 검증**
    - **수정 파일:** `engine/core/StatsMonitor.js`
    - **설명:** 맵 전체에 국가를 분산 배치하고 고배속으로 장시간 시뮬레이션을 실행하여 메모리 누수 및 데드락(교착 상태)이 없는지 최종 검증합니다.
    - **점검할 파일:** `ui/components/MapSettings.vue` (테스트용 고배속 조절 및 자동 저장 옵션 확인)

## 8. 🎨 디자인 및 시각 효과 고도화 (Design & Rendering Polish)
- 텍스처, 동적 조명 및 파티클 등 렌더링 시각 효과를 극대화하여 화면의 생동감을 불어넣습니다.
71. **고해상도 텍스처 시스템 도입**: 엔티티와 지형의 텍스처 해상도를 높여 시각적 디테일을 개선합니다.
72. **동적 조명 및 그림자 효과**: 광원(불, 마법 등)에 따른 실시간 그림자 렌더링을 추가하여 입체감을 부여합니다.
73. **기상 효과 파티클 구현**: 눈, 비, 모래바람 등 날씨 변화에 따른 파티클 시스템을 렌더 파이프라인에 통합합니다.
74. **시간대(낮밤) 변화 연출**: 낮과 밤의 흐름에 따라 맵 전체의 색조(Color Tint)와 밝기가 자연스럽게 전환되도록 수정합니다.
75. **바이옴별 고유 에셋 매핑**: 사막, 설원, 숲 등 환경에 따라 식생 및 흙 바닥 렌더링 에셋을 세분화합니다.
76. **물결 애니메이션 및 반사**: 수역(Water) 타일에 애니메이션 프레임과 반사 효과를 적용하여 생동감을 높입니다.
77. **손상된 건물 스프라이트**: 건물의 내구도가 깎일 때마다 파손된 스프라이트로 전환되어 시각적 피드백을 제공합니다.
78. **개체 방향성(8방향) 렌더링**: 이동 방향에 따라 캐릭터 스프라이트가 8방향으로 자연스럽게 회전하도록 구현합니다.
79. **UI/UX 테마 전면 개편**: 게임 내 인터페이스, 미니맵, 상태 패널의 디자인을 WorldBox 컨셉에 맞게 리뉴얼합니다.
80. **시각 효과 벤치마크 테스트**: 새롭게 추가된 렌더링 효과들이 활성화된 상태에서 드로우 콜(Draw Call) 부하를 측정합니다.

## 9. 🎬 모션 및 인터랙션 강화 (Motion & Interaction Polish)
- 액션과 이동 과정에 보간 애니메이션 및 물리 효과를 부여해 역동적이고 쾌적한 조작감을 구현합니다.
81. **부드러운 카메라 보간(Lerp)**: 유저가 맵을 스크롤하거나 줌할 때 뚝뚝 끊기지 않고 부드럽게 감속하는 카메라 움직임을 적용합니다.
82. **동적 엔티티 스케일링 모션**: 캐릭터가 공격하거나 자원을 캘 때 크기가 미세하게 변하며 타격감을 주는 스쿼시 앤 스트레치 모션을 추가합니다.
83. **트레일 렌더러(Trail) 고도화**: 화살이나 투사체가 날아갈 때 궤적을 그리는 Trail 컴포넌트의 부드러움을 개선합니다.
84. **파편(Debris) 물리 효과**: 건물 파괴나 지형 폭발 시 파편들이 물리 법칙에 따라 포물선을 그리며 튀어오르는 모션을 구현합니다.
85. **군중 회피(Boids) 부드러운 회전**: 여러 개체가 뭉쳐 이동할 때 방향을 틀면 즉각 돌지 않고 곡선을 그리며 회전하도록 모션을 보완합니다.
86. **드롭 아이템 획득 애니메이션**: 바닥에 떨어진 자원을 주울 때 아이템이 캐릭터 쪽으로 빨려들어가는 포물선 렌더링을 추가합니다.
87. **이펙트 흔들림(Camera Shake)**: 강력한 폭발이나 대형 몬스터의 공격 시 카메라 전체가 짧게 진동하는 화면 흔들림 효과를 부여합니다.
88. **상태 이상 시각적 피드백**: 독, 불타음 등 상태 이상에 걸린 개체 위에 아이콘 팝업과 깜빡임(Blink) 효과를 출력합니다.
89. **동물 및 몬스터 고유 공격 모션**: 곰의 할퀴기, 늑대의 물기 등 각 생물마다 고유의 준비 및 타격 애니메이션 프레임을 분리합니다.
90. **모션 렌더링 프레임 보간**: 틱 레이트와 모니터 주사율 간의 차이로 생기는 버벅거림을 막기 위해 프레임 간 위치를 선형 보간합니다.

## 10. 🚀 최종 성능 최적화 및 안정화 (Final Performance Optimization)
- 병목이 발생하는 남은 영역들을 극한으로 깎아내어 20만 마리 규모의 압도적인 스케일에서도 흔들림 없는 성능을 달성합니다.
91. **렌더링 드로우 콜 배칭(Batching)**: 동일한 텍스처를 사용하는 엔티티들을 하나의 드로우 콜로 묶어서 렌더링 파이프라인의 CPU 병목을 해소합니다.
92. **공간 해시(Spatial Hash) 최적화**: 충돌 검사 및 근접 엔티티 탐색에 사용되는 Spatial Hash 그리드의 크기를 동적으로 조절하여 메모리 낭비를 줄입니다.
93. **WebAssembly(Wasm) 마이그레이션**: 길찾기 및 물리 연산의 코어 로직을 WebAssembly로 포팅하여 자바스크립트 실행 속도의 한계를 돌파합니다.
94. **워커 스레드 동기화 오버헤드 감소**: 메인 스레드와 워커 간의 SharedArrayBuffer 락 대기 시간을 줄이기 위해 락프리(Lock-free) 알고리즘을 도입합니다.
95. **데이터 지향 메모리 패킹 고도화**: 사용되지 않는 버퍼 메모리 빈 공간을 실시간으로 압축(Defragmentation)하여 캐시 히트율을 극대화합니다.
96. **이벤트 버스 풀링(Pooling)**: 프레임당 수천 개씩 발생하는 이벤트를 가비지 컬렉션 없이 재사용할 수 있도록 이벤트 객체 풀을 설계합니다.
97. **오프스크린 캔버스 렌더링 캐시**: 변동이 없는 지형 청크는 오프스크린 캔버스에 렌더링된 상태 그대로 GPU 메모리에 캐싱하여 렌더 비용을 0에 가깝게 만듭니다.
98. **엔티티 틱 슬라이싱(Tick Slicing)**: 시야 밖(Off-screen)에 있는 엔티티들의 로직 업데이트 빈도를 낮추어 백그라운드 연산량을 대폭 감소시킵니다.
99. **초기 로딩 속도 최적화**: 맵 생성 및 초기화 시 데이터를 직렬화하고 지연 로딩(Lazy Loading)을 적용하여 게임 진입 시간을 단축합니다.
100. **최종 마스터 릴리즈 테스트**: 맵 전체에 20만 마리 이상의 엔티티를 생성하고 장시간 방치하며 60 FPS 유지가 가능한지 프로파일링하고 마무리합니다.
