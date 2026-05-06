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

## 3. 🗺️ 계층적 길찾기 (Hierarchical Pathfinding - HPA*)
21. **상위 계층 구역(Zone) 분할**: 수백만 개의 타일을 100x100 크기의 상위 논리적 구역(Zone)들로 묶어 거시적 이동망을 구축하는 데이터 구조 설계.
22. **경계점(Transition Node) 탐색**: 인접한 Zone 간에 막히지 않고 이동 가능한 통로(게이트) 노드들을 자동으로 찾아내어 상위 계층 그래프 맵 구성.
23. **동적 Zone Update 시스템**: 유저가 장벽을 세우거나 지형이 파괴되어 통로가 막힐 경우, 실시간으로 해당 Zone의 경계점 및 연결망을 재계산하는 업데이트 트리거 구현.
24. **1차 탐색 (거시적 경로 검색)**: 출발지 Zone에서 목적지 Zone까지 상위 계층 노드만을 활용해 A* 탐색을 수행하여 구역 단위의 Abstract Path를 계산.
25. **2차 탐색 (미시적 경로 검색)**: 1차 탐색 결과에 따라 현재 위치한 Zone 내부에서 다음 경계점 출구까지만의 상세한 타일 단위 Local Path를 A*로 계산.
26. **실시간 경로 갱신 AI 로직**: 캐릭터가 구역의 경계를 넘어서 다음 Zone으로 진입할 때마다, 동적으로 다음 경계점까지의 2차 탐색을 트리거하도록 AI 스테이트 머신 개편.
27. **탐색 요청 Time-Slicing**: 다수의 엔티티가 동시에 길찾기를 요청할 경우 메인 루프가 정지하지 않도록, 연산을 여러 프레임으로 분산시키는 대기열(Queue) 시스템 적용.
28. **경로 캐싱 (Memoization)**: 큰 도로 같은 자주 이용되는 특정 Zone 간의 최단 경로는 한 번 계산 후 해시맵에 캐싱해두어 동일 연산을 획기적으로 생략.
29. **로컬 스티어링 및 충돌 회피**: 경로를 따라 이동하는 도중 다른 엔티티와 겹치지 않도록 밀어내는 회피 비헤이비어(Boids Steering)를 계층적 이동 로직과 부드럽게 결합.
30. **대규모 엔티티 병목 테스트**: HPA* 적용 후 엔티티 수를 1,000마리에서 10,000마리까지 점진적으로 늘려가며 프로파일링을 통해 병목 지점을 찾고 최적화 완료.

## 4. 💾 데이터 지향 설계 (Data-Oriented Design)
31. **위치 데이터 배열화 (Position Buffer)**: 모든 엔티티의 x, y 위치 정보를 일반 객체의 프로퍼티가 아닌, 단일 `Float32Array`의 연속된 메모리 공간에 저장하도록 구조 변경.
32. **물리 데이터 분리 (Velocity Buffer)**: 물리 이동 연산에 필수적인 속도 및 가속도 데이터를 `Float32Array`로 분리하여 CPU 캐시 친화적인 상태 패킹(Packing) 적용.
33. **상태 데이터 배열화 (Stats Buffer)**: 체력, 마나, 스태미나 등 게임 내 로직에 필요한 각 엔티티의 상태 값을 `Int32Array`에 저장하고 고유 Index로 참조하도록 마이그레이션.
34. **Data-Oriented 루프 재작성**: `entity.update()`를 개별적으로 호출하던 기존 OOP 방식을 폐기하고, System 함수 단위로 연속된 Buffer 배열들을 한 번에 순회 연산하는 방식으로 전면 수정.
35. **Movement System 통합**: 오직 위치와 속도 Buffer만을 인자로 받아 전체 엔티티의 다음 프레임 이동 좌표를 초고속 일괄 계산하는 물리 이동 전담 시스템 구현.
36. **Render System 최적화**: 렌더링 시에도 객체를 순회하지 않고 Position Buffer와 텍스처 인덱스 Buffer를 매칭하여 렌더 파이프라인에 데이터를 스트리밍하도록 최적화.
37. **엔티티 팩토리 패턴 도입**: 새 엔티티 스폰 시 `new Class()`를 호출하지 않고, Buffer 내의 비어있는 인덱스를 찾아 값을 덮어씌워 재활용하는 팩토리(Factory) 방식 적용.
38. **오브젝트 풀링 플래그 관리**: 엔티티 사망 시 메모리 배열에서 삭제하지 않고, 별도의 활성화 플래그(Alive) 버퍼를 0으로 만들어 논리적으로 무효화하는 기법 도입.
39. **비트마스크 컴포넌트 필터링**: 각 엔티티가 어떤 데이터를 갖는지 비트마스크 정수로 표현하여, 특정 System이 연산해야 할 대상 인덱스를 비트 연산으로 빠르게 필터링하도록 고도화.
40. **DOD 최종 스트레스 테스트**: 기존 OOP 구조 대비 메모리 파편화 및 가비지 컬렉션(GC) 발생 횟수를 비교 측정하고, 10만 마리 규모의 엔티티 처리 안정성 확인.
