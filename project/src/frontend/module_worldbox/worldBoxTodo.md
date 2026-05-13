# WorldBox 게임 최적화 5단계 계획 (코드 리뷰 기반 구체화)

본 문서는 `module_worldbox`의 실제 코드(`SpriteManager`, `ChunkManager`, `SpatialHash`, `Pathfinder`, `TerrainGen` 등)를 심층 리뷰하여, 이미 적용된 최적화 기법(DOD, HPA*, SharedArrayBuffer)을 바탕으로 한 단계 더 나아가는 구체적인 성능 극대화 로드맵입니다.

## 1단계: 렌더링 파이프라인 및 특수 효과 Culling (Rendering Optimization)
*   **현황:** `ChunkManager`의 가시 영역 기반 렌더링, `SpriteManager`의 거리 기반 LOD(프레임 스킵) 및 `SharedArrayBuffer` 기반 지형 렌더링이 이미 훌륭하게 구현되어 있습니다.
*   **구체적 실행 계획:**
    *   현재 정적 지형(`Chunk.js`)과 동적 스프라이트는 최적화되어 있으나, `ParticleSystem.js` 및 `Trail.js`와 같은 동적 시각 효과에 대해 `Camera.js` 뷰포트 AABB 기반의 정밀한 Frustum Culling이 누락될 수 있습니다. 이를 완전히 배제하도록 수정합니다.
    *   Web API의 캔버스 2D `drawImage` 호출 오버헤드를 줄이기 위해, 동일한 텍스처를 사용하는 엔티티들을 모아서 한 번에 렌더링하는 Draw Call Batching(렌더링 큐 정렬) 로직을 `TextureManager`에 추가합니다.

## 2단계: Data-Oriented Design(DOD) 확장 및 메모리 풀링 적용 (Memory & ECS Tuning)
*   **현황:** `Transform`, `State`, `Visual` 일부 데이터가 `tBuffer`, `sBuffer`, `rBuffer` 같은 `TypedArray`로 관리되는 고도화된 DOD가 적용되어 있으며, `ObjectPool`과 `SpatialHash`의 `queryBuffers` 풀링도 사용 중입니다.
*   **구체적 실행 계획:**
    *   여전히 자바스크립트 객체 형태로 빈번하게 생성/소멸되는 길찾기 결과(Path Array), `TargetManager`의 `pendingRequests` 객체, 동적 파티클 객체 등에 `ObjectPool.js`를 전면 적용합니다.
    *   이벤트 시스템(`EventBus.emit`)에서 발생하는 페이로드 객체 생성을 줄이기 위해, 자주 발생하는 이벤트(예: `TARGET_ASSIGNED`, 이동 상태 변경)에 대해서도 객체 풀링이나 DOD 기반 상태 버퍼 확장을 적용합니다.

## 3단계: 공간 분할 해시(SpatialHash) 갱신 비용 최소화 (Physics & Spatial Optimization)
*   **현황:** `SpatialHash.js`는 `Int32` 키 캐싱 및 나선형 탐색(`eachInSpiral`) 등 최고 수준으로 최적화되어 있으나, 매 프레임 동적 엔티티 영역을 비우고(`clearDynamic`) 전체를 재삽입(`insertDynamic`)하는 구조일 확률이 높습니다.
*   **구체적 실행 계획:**
    *   매 프레임 전체를 지우고 다시 넣는 대신, 개체의 `Transform` 컴포넌트에 `lastCellKey`를 기록합니다. 
    *   물리 이동(`KinematicSystem`) 처리 시, 이전 프레임과 현재 프레임의 공간 해시 셀이 달라졌을 때만 `SpatialHash`에서 기존 키를 지우고 새 키로 업데이트하도록 로직을 변경하여 O(N) 업데이트 비용을 O(이동한 개체 수)로 대폭 줄입니다.

## 4단계: SharedArrayBuffer 기반 Web Worker 오프로딩 (Worker Offloading)
*   **현황:** `TerrainGen.js`에 `SharedArrayBuffer`가 완벽히 세팅되어 있으나, `generateProgressive`의 Perlin Noise 연산이 메인 스레드(`requestAnimationFrame`)에서 비동기로 쪼개져 돌아가고 있습니다.
*   **구체적 실행 계획:**
    *   이미 구현된 `simulationWorker.js`로 `TerrainGen`의 지형 생성 루프를 완전히 위임(Offload)합니다. 공유 버퍼(`getSharedBuffers`)를 통해 메인 스레드 블로킹 없이 지형 데이터를 채우도록 합니다.
    *   동일하게 `EnvironmentSystem`의 비옥도(`SoilFertility`) 및 수질 확산 Cellular Automata 연산을 Worker 스레드로 넘겨 틱(Tick) 단위 프레임 드랍을 원천 방지합니다.

## 5단계: HPA* 그래프 재계산 및 AI 탐색 지연 처리 (AI & Pathfinding Tuning)
*   **현황:** `Pathfinder.js`와 `TargetManager.js`가 A* 및 자원 탐색을 훌륭히 수행 중이나 메인 스레드 부하 위험이 내재되어 있습니다.
*   **구체적 실행 계획:**
    *   **Pathfinder:** `ConstructionSystem.js`의 건물 완공이나 `ToolManager.js`의 지형 파괴로 지형이 변경될 때 발생하는 HPA* 구역 경계 재계산(`rebuildAllTransitions`) 작업을 `simulationWorker.js`로 완전히 오프로딩하여 틱(Tick) 멈춤을 방지합니다.
    *   **TargetManager:** `ZoneManager.js`의 파티셔닝 영역을 벗어나 특정 자원을 찾지 못했을 때 2000픽셀 밖을 찾는 원거리 Fallback(`forceGlobal`) 탐색 요청은 `SystemManager.js`의 업데이트 페이즈에서 제한된 횟수만 실행되도록 저우선순위 큐(Low-priority Queue)에 담아 시분할(Time-slicing) 처리합니다.

## 6단계: 게임 로직 및 생태계 시뮬레이션 지연 평가 (Gameplay Logic Optimization)
*   **목표:** ECS 비즈니스 로직 시스템들의 불필요한 전체 순회를 줄이고 이벤트/캐싱 기반으로 전환합니다.
*   **구체적 실행 계획:**
    *   **마을 영입 최적화 (`VillageSystem.js`):** 무소속 인간(`State: Wander`)이 새 마을을 찾을 때, 모든 `Civilization` 컴포넌트를 순회하는 $O(V)$ 연산을 폐기하고 마을 중심점을 `SpatialHash.js`에 등록하여 $O(1)$ 수준의 근접 탐색만으로 영입시킵니다.
    *   **농작물 인덱싱 (`FarmingSystem.js`):** 매 틱 전체 `Structure.js`를 검사하는 낭비를 막고, 진행 중인 농장만 담긴 고속 인덱스 큐(`activeFarmIds`)를 `EntityManager.js` 레벨에서 제공받아 $O(N)$ 낭비를 차단합니다.
    *   **생명주기 지연 (`MetabolismSystem.js`):** 노화(`Age.js`), 허기, 소화(`Digestion.js`) 및 배설물 생성과 같은 느린 주기의 생태 변화는 매 프레임 업데이트할 필요가 없으므로 3초 주기(Staggering)로 늦춰 연산량을 획기적으로 낮춥니다.

## 7단계: 자원 물류 및 채집 시스템 압축 (Gathering & Economy Tuning)
*   **목표:** 벌목, 사냥 후 `PickupState.js`로 아이템을 주워 창고(`Storage.js`)로 나르는 경제 흐름 연산을 축소합니다.
*   **구체적 실행 계획:**
    *   **논리적 묶음(Batch) 처리:** `GatheringSystem.js`나 `DeathProcessor.js`에 의해 `drops: []` 배열 기반으로 대량의 자원이 쏟아질 때, 개별 `DroppedItem.js` 엔티티로 생성하지 않고 동일 위치의 동일 자원(`category`)은 논리적으로 하나의 '묶음 컨테이너'로 통합합니다.
    *   시각적으로는 `ResourceRenders.js`에서 파티클이 흩어지게 그리되, AI의 `TargetManager.js` 탐색 및 `SpatialHash.js`의 물리 충돌 판정 부하를 O(아이템 수)에서 O(1)로 단축합니다.

## 8단계: 전투 및 추적 레이더 캐싱 (Combat & Hunting Tuning)
*   **목표:** `CombatSystem.js`와 맹수(`CarnivoreBrain.js`)의 락온 탐색 시 발생하는 프레임 병목을 완화합니다.
*   **구체적 실행 계획:**
    *   **타겟 캐싱 (Target Lock-on):** 교전 중 사거리 확인을 위해 매번 `SpatialHash.js`를 검색하는 대신, 한 번 락온된 적의 `Transform.js` 좌표 참조(Reference)를 공격자의 `Target.js` 컴포넌트에 로컬 캐싱합니다.
    *   적이 시야를 벗어나거나 `EventBus.js`를 통해 `ENTITY_DIED` 이벤트가 수신되었을 때만 `SpatialHash.js` 재검색을 트리거하여, 대규모 난전 시 엔진 과부하를 방지합니다.

## 9단계: 번식 및 인구 시뮬레이션 지연 병합 (Reproduction & Population Tuning)
*   **목표:** 인구 증가 곡선과 유전 확률 등 기획 의도는 유지하면서 연산량만 제거합니다.
*   **구체적 실행 계획:**
    *   **Batch Evaluation 기반 번식 판정:** `ReproductionSystem.js`가 매 프레임 모든 성체의 짝짓기 가능성을 평가하는 $O(N)$ 연산을 제거합니다.
    *   대신 1초 주기마다 후보군(`eligibleBreeders`)을 이벤트 기반으로 취합한 뒤, 해당 소속 마을의 인구수용량(`Housing.js`) 한계치와 주변 환경 비옥도(`EnvironmentSystem.js`)를 일괄(Batch) 비교하여 아기 스폰 여부를 한 번에 결정합니다.

## 10단계: 시스템 안정화 및 버그 수정 필요 항목 (Pending Bug Fixes)

### 생태계 스폰(SpawnerSystem) 관련 오류 조사
- **`clearTreeOccupancy` 인덱스 래핑 오류**: 점유 맵 접근 시 좌표 경계를 이탈해 배열 오염 위험 존재.
- **맵 해상도 참조 일관성 부족**: `initializeWorld` 메서드가 `this.terrainGen.mapWidth`가 아닌 값을 참조하여 암묵적 스폰 중단 발생 위험 확인.
- **SharedArrayBuffer 크래시 문제**: 환경(COOP/COEP 미설정 등)에 따라 `Atomics.store` 호출 시 `TypeError` 발생 가능성 확인, Fallback 처리 필요.
- **자동 식생 생성 시 병목/동결 이슈**: `autoSpawnResources`의 배치 사이즈가 과도하게 확장되면 프레임 단위 스폰 폭증(Tick당 수백 개)으로 인한 게임 프리징(멈춤) 버그가 존재함. 고정값 15 또는 스로틀링(Throttling)으로 원복 필요.
- **초기 맵 생성 시 나무 겹침(Overlap) 버그**: 배열(`treeOccupancyBuffer`)이 `terrainGen.mapWidth`가 0일 때 초기화되어 생성 루프에서 밀도 체크가 전부 실패(나무 겹침)하는 현상 발생. 맵 크기 확정 이후 동적 할당(Re-allocation)하는 구조로 변경해야 함.

- [x] **10단계: 안정성 확보 및 버그 수정 (Stability & Bug Fixes)**
    - SharedArrayBuffer 미지원 환경(일반 모바일 등)에서의 Atomics 관련 TypeError 수정 완료.
    - safeAtomicsLoad / safeAtomicsStore 래퍼 구현 및 적용.
    - VillageSystem, SpawnerSystem 내 인덱스 경계 검사 강화.
    - [완료] 2026-05-10

- [x] **11단계: 나무 소환 시 프리징 해결 (Tree Spawn Performance)**
    - SpatialHash.js 내 `includes()` 중복 체크 제거 (O(N) -> O(1)).
    - EntityManager 내 `_updateSpatialHash` 도입으로 이중 삽입(Factory + Manager) 근본적 해결.
    - SpawnerSystem 자원 소환 배치화 (BATCH_SIZE = 15) 적용.
    - **(이후 발생한 급격한 성능 저하 원인 파악 및 추가 수정)**
        - `EntityManager.js`의 `removeEntity`에서 `this.spatialHash.remove(id, cellKey)` 호출 시 인자 불일치(y좌표 누락)로 인해 개체가 해시에서 영구히 지워지지 않고 좀비 데이터로 무한 증식하던 버그를 `removeFromCell(id, cellKey, layer)`로 수정하여 근본 해결.
        - `SpatialHash.js`의 `_getTargetCells(layer)`에서 `switch`문의 엄격한 비교(`===`)로 인해 `isStatic=true`가 `1`과 매칭되지 않아 모든 정적 개체(나무 등)가 `dynamicCells`에 삽입되어 AI 길찾기 연산을 폭증시키던 버그 수정.
        - `AnimalFactory` 및 `HumanFactory` 내 매뉴얼 `spatialHash.insert` 호출 중복 제거로 초기 생성 시 동적 개체 이중 삽입 문제 해결.
    - [완료] 2026-05-11

- [x] **12단계: 카메라 줌/아웃 시 화면 튕김 현상 수정 (Camera Zoom Panning Issue)**
    - **원인 분석**: `Engine/core/Camera.js`의 `update(dt)` 함수에서 위치(`this.x`, `this.y`)와 축척(`this.zoom`)을 각각 독립적으로 단순 선형 보간(Lerp)하기 때문에 발생합니다. 마우스 앵커 기반 월드 좌표 계산 시 `zoom` 나눗셈이 포함되므로 독립된 선형 보간은 앵커 포인트를 옆으로 미끄러지게 만듭니다. 또한 보간 도중에 매 프레임 `clamp()`가 실행되면서 경계에 닿을 경우 화면이 강하게 튕기는 현상(Bouncing)이 발생합니다.
    - **해결 계획**: 
        - `handleWheel`에서 저장하는 마우스 앵커 정보(`lastAnchorWorldX`, `lastAnchorMouseX` 등)를 `update(dt)`에서 적극 활용해야 합니다.
        - `update()`에서 위치와 줌을 독립적으로 Lerp 하는 로직을 제거하고, `zoom`을 먼저 보간한 후 **보간된 현재 `zoom` 값**을 바탕으로 앵커 포인트(월드 좌표)가 화면의 마우스 위치에 일치하도록 `this.x`와 `this.y`를 매 프레임 동적으로 역산하여 보정하는 방식으로 수정합니다.    - [Ϸ] 2026-05-11

- [x] **13단계: 성능 병목 조사 (Pathfinder HPA* Graph Update)**
    - **현상**: 어디선가 엄청나게 부하를 일으키고 있으며 `7Pathfinder.js:906 🗺️ [Pathfinder] HPA* Graph updated from Worker.` 부근으로 추정됨.
    - **조사 및 해결 계획**: 해당 로직을 깊게 조사하여 병목 원인을 파악하고 부하를 완화하는 최적화를 수행합니다.
    - **원인 분석**: 맵 내 동적 개체(예: 나무의 생성, 파괴)로 인해 지형 통행 가능 여부가 변경될 때 `Pathfinder.markClusterDirty()`가 호출됩니다. `updateHierarchy`는 `dirtyClusters`가 쌓일 때마다 **매 프레임** 워커에 `REBUILD_HPA_GRAPH` 명령(전체 맵 HPA* 그래프 재계산)을 보내는 버그가 있었습니다. 워커는 매 프레임 전체 맵을 재계산하고 거대한 직렬화 데이터를 반환하여 메인 스레드의 `applyRebuiltGraph`에서 수천 개의 Map 객체를 반복 초기화하므로 심각한 프리징이 발생했습니다.
    - **해결 방안**: 
        1. **재계산 스로틀링(Throttling)**: `this._isWorkerRebuilding` 플래그를 추가하여 이전 재계산이 진행 중일 때는 중복 요청을 차단하고 dirty 상태를 배치(Batch) 처리하도록 수정했습니다.
        2. **증분 업데이트(Incremental Update)**: 전체 맵을 재계산하는 대신 **변경된 구역(Dirty Clusters)만 선별적으로 재계산**하여 워커 부하와 데이터 전송량을 최소화했습니다.
        3. **부분 병합(Partial Merge)**: 메인 스레드에서 전체 그래프를 `clear()`하고 다시 채우는 대신, 변경된 구역의 노드들만 교체(Merge)하는 방식으로 수천 개의 객체 생성을 억제하여 프리징을 근본적으로 해결했습니다.
    - [완료] 2026-05-11

- [x] **14단계: 브러시 툴 연속 사용 시 Pathfinder 증분 업데이트 폭주 (Throttling 누락)**
    - **현상**: `isBrush: true`인 툴(예: 나무 소환)로 드래그 시, 맵에 동적 개체가 연속으로 생성되면서 프레임이 심각하게 끊어지고 `🗺️ [Pathfinder] HPA* Graph incrementally updated from Worker.` 로그가 무한히 찍힙니다.
    - **원인 분석**: 13단계 최적화로 `_isWorkerRebuilding` 중복 방지는 적용되었으나, 워커 처리가 워낙 빨라 플래그가 금방 해제됩니다. 마우스 드래그 중 매 프레임 `markClusterDirty`가 호출되므로 워커가 끝날 때마다 1초에 수십 번씩 재계산을 요청합니다. 잦은 객체 직렬화/역직렬화 및 `applyRebuiltGraph` 호출이 심각한 병목을 유발합니다.
    - **해결 방안**: 
        1. **시간 기반 쿨다운(500ms)**: `updateHierarchy`에 `performance.now()`를 이용한 최소 대기 시간을 도입하여 드래그 중에도 초당 최대 2회까지만 그래프를 갱신하도록 제한했습니다.
        2. **AI 시각화 강화**: `aipath` 디버그 모드에서 각 개체의 **탐색 범위(Search Range)**를 레이더/소나 스타일의 확산 파동 효과로 시각화하고, 타겟 방향에 애니메이션 점선을 추가하여 생동감을 더했습니다.
    - [완료] 2026-05-11

- [ ] **15단계: 숲 밀집 지역 나무 투명화(X-Ray) 오작동 및 깜빡임 개선**
    - **현상**: 인간이나 큰 동물이 지나가지 않음에도 불구하고, 나무들이 밀집된 곳에서 서로 투명해지는 것처럼 보이는 현상(깜빡임)이 발생합니다.
    - **원인 분석**: 
        1. `engine/systems/render/EntityRenderer.js`의 `drawTreeCached` 함수를 보면, 나무 렌더링 시 반경 25px 이내(`t.y - 20, 25`)에 `Human` 또는 `Animal` 컴포넌트를 가진 개체가 나무 뒤(`entT.y < t.y`)에 있으면 나무 전체의 알파값을 `0.4`로 투명하게 만듭니다.
        2. 이 때 사용자는 인지하기 힘든 **아주 작은 동물(예: 벌통에서 나온 벌, 토끼, 새 등)**이 숲을 돌아다니기만 해도, 25px이라는 넓은 탐색 반경 때문에 주변의 여러 나무들이 동시에 투명해지는 현상이 발생합니다. 사용자는 이를 "나무들끼리 서로 투명하게 만든다"고 시각적으로 오해하게 됩니다.
        3. 매 프레임 모든 나무가 `spatialHash.query`를 호출하여 주변 개체를 탐색하므로 렌더링 병목(CPU 과부하)의 주요 원인이기도 합니다.
    - **개선 방안 (완료)**:
        1. **탐색 로직 제거**: 나무에서 매 프레임 실행되던 `spatialHash.query`와 투명도 계산 로직을 삭제하여 성능 병목과 깜빡임을 원천적으로 해결했습니다.
        2. **실루엣 시스템 도입**: 모든 개체를 그린 후 가려진 개체만 골라 하얀색 실루엣으로 덧그리는 **Silhouette Pass**를 구현했습니다. 줌 레벨에 따른 최적화와 소형 동물(벌, 새 등) 제외 로직이 포함되어 있습니다.
    - [완료] 2026-05-11

- [x] **16단계: 마을 고도화 및 울타리 시스템 도입 (Village Upgrade & Fence System)**
    - **목표**: 마을 영역을 시각적으로 명확히 하고, 확장 및 방어의 기반이 되는 울타리 시스템을 도입합니다.
    - **세부 계획**:
        1. **울타리 엔티티 구조 설계 (Fence Entity & Data)**
            - 체력(HP) 시스템 추가: 외부 요인에 의해 파괴될 수 있도록 체력 속성 부여.
            - 업그레이드 구조: 나무, 돌, 철 등 발전 단계에 따른 교체(철거 후 상위 재질로 재건설)가 가능하도록 유연한 상태(State) 및 컴포넌트 구조 설계.
        2. **건설 및 확장 로직 (Building & Expansion Logic)**
            - 초기 상태에는 울타리 없이 시작하며, 촌장(Chief)의 '마을 영역 확장' 판단 시 경계선에 울타리 건설을 지시하도록 마을 AI(`VillageSystem`) 개선.
            - 건설가(Builder) 직업 AI 고도화: 인벤토리나 창고(Storage)에서 적절한 자원(나무 등)을 직접 가져와 지시된 위치에 차근차근(점진적으로) 울타리를 짓는 행동 트리/상태 머신 구현.
        3. **고품질 렌더링 (High-Quality Rendering)**
            - 단순한 큐브/도형 형태를 지양하고 실제 울타리 형태를 띄어야 함.
            - 주변 인접한 울타리(상하좌우 연결 상태)에 맞춰 스프라이트가 자연스럽게 이어지는 오토 타일링(Auto-Tiling) 혹은 연결망 렌더링 처리 적용.
        4. **유저 개입 도구 지원 (User Tool Integration)**
            - 도구모음창(Toolbar)에 '울타리 건설' 툴을 추가.
            - 마우스 드래그(시작점 클릭 후 끝점까지 드래그)를 통해 원하는 경로에 일직선 혹은 영역 테두리로 울타리 건설을 예약/설치하는 도구(Tool) 로직 구현.
    - **검토 결과 (Review - 2026-05-12)**:
        - 1번(엔티티/데이터): `FenceFactory.js`에 재질별(나무/돌/철) 최대 체력을 설정하는 `Health` 컴포넌트와 `Fence` 컴포넌트가 잘 적용되어 있습니다.
        - 2번(확장 로직): `VillageSystem.js`의 `_manageFences`에서 영토(Territory) 경계를 계산하여 청사진을 배치하고, `BuildState.js`에서 건설가(Builder)가 자원을 가져와 점진적으로 건설(`progress`)하는 로직이 정상적으로 구현되었습니다.
        - 3번(렌더링): `FenceRenderer.js`를 통해 주변 연결 상태(상하좌우)에 따른 Bitmask(`connections`)를 계산하여 오토 타일링(Auto-Tiling) 렌더링을 훌륭하게 처리하고 있습니다.
        - 4번(도구 지원): `ToolRegistry.js`에 `FenceTool`이 추가되어 드래그 방식의 울타리 설치 및 돌 성벽/울타리 문 등 다양한 도구 지원이 완벽하게 연동되었습니다.
        - **총평**: 계획하신 4가지 세부 목표가 코드베이스에 완벽하게 반영되어 있습니다. 잘 구현되었습니다!

- [ ] **17단계: 건물 시스템 종합 구조 검토 (Blueprints, Builder & Professions)**
    - **목표**: 건물 청사진 배치, 건축가의 건설 조건, 직업별 건물 기능 연동 등 전반적인 건축 라이프사이클이 구조적으로 잘 구현되어 있는지 면밀히 검토합니다.
    - **검토 내용 (Review)**:
        1. **청사진(Blueprint) 출력 및 건축 가능 여부**:
            - `VillageSystem.js`(`createBlueprint`)를 통해 건물 스폰 시 `isBlueprint: true` 속성을 가진 청사진이 정상적으로 배치됩니다.
            - `ArchitectRole.js`가 마을 과업(Task) 할당 시스템을 통해 이 청사진 ID(`targetId`)를 수주하며, `BuildState.js`에 진입하여 Pathfinder를 통해 건물 앞까지 도달 후 실제 건설 행위를 수행하는 흐름이 매끄럽게 연결되어 있습니다.
        2. **건물 건설 조건 및 재료 조달 메커니즘**:
            - 건물 종류(`house`, `well`, `blacksmith`, `fence` 등)와 진행도(`progress`)에 따라 필요한 재료(`wood`, `stone`, `iron_ore`)를 다르게 요구하는 조건이 잘 구현되어 있습니다.
            - 건축가(Builder)가 인벤토리에 해당 자원이 없을 경우, `ArchitectRole.js`가 주변에 떨어진 아이템을 줍거나 창고(Storage)에서 자원을 가져오고, 심지어 직접 채집까지 시도하는 유기적 자원 조달 AI가 완벽하게 갖춰져 있습니다.
        3. **완공 후 직업별 제기능 연동 여부**:
            - `BuildingFactory.js`에서 각 건물이 완공될 때 특수한 컴포넌트가 부여되는 것을 확인했습니다.
                - **농장(`farm`)**: `Storage`와 `Farm` 컴포넌트 추가 (농부 `Farmer` 연동 기능)
                - **대장간(`blacksmith`)**: `Storage`와 `Production` 컴포넌트 추가 (대장장이 `Blacksmith` 연동 기능)
                - **목장(`pasture`)**: `LivestockHousing` 컴포넌트 부여 (가축 사육 기능)
                - **신전(`temple`)/우물(`well`)**: `BuffSource` 컴포넌트를 통한 광역 버프(행복도/권위) 제공
                - **창고(`storage`/`warehouse`)**: 대용량 `Storage` 컴포넌트를 통한 마을 물류 허브 기능
            - 이를 통해 완공 시 건물들이 단순한 장식이 아닌 각 직업(Role/State) AI와 상호작용하는 핵심 작업장(Workplace) 및 인프라로 완벽히 기능할 수 있는 구조적 기반이 마련되어 있습니다.
    - **총평**: 건물의 청사진 배치, 재료를 소비하는 점진적 건설 로직, 완공 후 각 직업별(Role) 특수 컴포넌트 부여까지 건축 시스템의 라이프사이클이 설계도에 맞게 매우 잘 구현되어 있습니다. 별도의 코드 수정이나 추가 구조 설계 없이도 현재 로직만으로 훌륭히 동작할 것으로 확인되었습니다.

- [ ] **18단계: SOLID 원칙 기반 건축 및 자원 시스템 리팩토링 (Decoupling & Cohesion)**
    - **목표**: `module_worldbox` 내 결합도가 높고 응집도가 낮은 자원 검사 로직과 건물 요구사항 하드코딩을 분리하여 SOLID 원칙(SRP, OCP)을 준수하는 구조로 리팩토링합니다.
    - **문제점 (현황)**: 
        - `Inventory.js` 컴포넌트 내에 `hasFlexible`이라는 특정 자원(stone, wood 등)의 카테고리 매칭 로직이 하드코딩되어 있어, 데이터 컨테이너 역할(SRP)을 위반하고 있습니다.
        - `ArchitectRole.js` 내에 건물 종류(`house`, `well` 등) 및 건설 진행도(`progress`)에 따른 필요 자원 조건이 하드코딩되어 있으며, 드롭 아이템 매칭 로직(`droppedCondition`)에도 자원 카테고리 로직이 중복되어 결합도가 매우 높습니다.
    - **리팩토링 계획 (상세)**:
        1. **분해 및 신규 생성 할 폴더/파일**:
            - **신규 폴더**: `d:\ERP\project\src\frontend\module_worldbox\engine\data` (게임 기획 데이터 분리용)
            - **신규 파일 1 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\data\ResourceRegistry.js`
                - **역할**: `Inventory.js`와 `ArchitectRole.js`에 흩어져 있던 자원 속성, 유사어(Alias), 카테고리 매칭 로직을 분해하여 중앙화합니다.
                - **내용**: `isMatch(type, category)` 등의 유틸리티 메서드 제공.
            - **신규 파일 2 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\data\BlueprintRegistry.js`
                - **역할**: `ArchitectRole.js`에 하드코딩된 '건물별/진행도별 요구 자원' 규칙을 분해하여 독립된 데이터 레지스트리로 생성합니다.
                - **내용**: `getRequiredResource(buildingType, progress)` 메서드를 통해 요구 자원(`wood`, `stone` 등)을 반환.
        2. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\components\resource\Inventory.js`: `hasFlexible` 로직을 분리 제거하고 순수 데이터 저장 및 입출력 컴포넌트로 응집도를 높입니다.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\roles\ArchitectRole.js`: `type === 'house'` 등의 하드코딩된 분기문을 모두 제거하고, `BlueprintRegistry.getRequiredResource()`를 호출하여 자원을 파악하도록 변경합니다. `droppedCondition`의 검색 로직도 `ResourceRegistry`를 사용하도록 수정.
        3. **이동 할 폴더/파일**:
            - 기획(Config) 및 데이터 매칭 로직이 하드코딩된 시스템 폴더(`engine\components\resource`, `engine\systems\roles`)에서 신규 데이터 전용 폴더(`engine\data`)로 논리적인 이동이 발생합니다.
            - (물리적인 기존 파일의 경로 이동은 없으며, 코드 내 로직을 분해하여 새로운 폴더의 레지스트리 파일로 이전(Move)하는 형태입니다.)

- [ ] **19단계: SOLID 원칙 기반 AI 타겟 탐색 시스템 리팩토링 (Strategy Pattern 적용)**
    - **목표**: `TargetManager.js` 내에 강하게 결합된 타겟 탐색 분기문과 세부 구현 로직을 분리하여 SOLID 원칙(OCP, SRP)을 준수하는 전략 패턴(Strategy Pattern)으로 리팩토링합니다.
    - **문제점 (현황)**: 
        - `TargetManager.js` 내의 `_processRequest` 메서드에 `switch (targetType)` (RESOURCE, STORAGE, BLUEPRINT 등) 분기문이 하드코딩되어 있습니다. 새로운 탐색 타입이 추가될 때마다 핵심 시스템 클래스를 수정해야 하므로 OCP(개방-폐쇄 원칙)를 위반합니다.
        - `_findBestResource`, `_findBestStorage` 등의 방대한 탐색 알고리즘이 하나의 `TargetManager` 안에 모두 혼재되어 있어 SRP(단일 책임 원칙)를 크게 위반하며 코드가 비대합니다.
    - **리팩토링 계획 (상세)**:
        1. **분해 및 신규 생성 할 폴더/파일**:
            - **신규 폴더**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies`
            - **신규 파일 1 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies\TargetStrategy.js` (전략 베이스 클래스/인터페이스 역할)
            - **신규 파일 2 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies\ResourceTargetStrategy.js` (`_findBestResource` 로직 이관)
            - **신규 파일 3 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies\StorageTargetStrategy.js` (`_findBestStorage` 로직 이관)
            - **신규 파일 4 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies\BlueprintTargetStrategy.js` (`_findBestBlueprint` 로직 이관)
            - **신규 파일 5 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\strategies\StrategyRegistry.js` (각 전략을 런타임에 등록하고 반환하는 팩토리/레지스트리)
        2. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\TargetManager.js`: 
                - 하드코딩된 `switch(targetType)` 문을 삭제합니다.
                - `const strategy = StrategyRegistry.get(targetType); bestTargetId = strategy.execute(...);` 형태로 다형성을 활용하여 탐색 위임(Delegation) 처리합니다.
                - 내부에 혼재되어 있던 방대한 `_findBest...` 프라이빗 메서드들을 모두 삭제합니다.
        3. **이동 할 폴더/파일**:
            - `TargetManager.js` 시스템 내부에 묶여있던 거대한 조건별 탐색 로직 수백 줄을 신규 생성된 `strategies` 폴더 산하의 개별 Strategy 클래스 파일들로 논리적 분할 및 이전(Move)합니다.

- [ ] **20단계: SOLID 원칙 기반 ECS 렌더링 로직 분리 (Presentation & Logic Decoupling)**
    - **목표**: 데이터 시뮬레이션을 담당하는 게임 핵심 시스템(`VillageSystem.js`, `ZoneManager.js`) 내부에 혼재된 Canvas 렌더링 코드를 분리하여 단일 책임 원칙(SRP)과 관심사 분리(SoC)를 완벽히 달성합니다.
    - **문제점 (현황)**: 
        - `ZoneManager.js` (구역 데이터 관리) 및 `VillageSystem.js` (마을 비즈니스 로직) 내부에 Canvas API(`ctx.fillStyle`, `ctx.fillRect`, `ctx.fillText` 등)를 직접 호출하는 `render()` 함수가 존재합니다.
        - 이는 상태(State)와 표현(View)을 명확히 분리해야 하는 Data-Oriented Design(DOD) 및 ECS 패턴의 철학에 크게 위배되며 코드가 거대해지는 원인이 됩니다.
    - **리팩토링 계획 (상세)**:
        1. **분해 및 신규 생성 할 폴더/파일**:
            - **신규 폴더**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\overlays`
            - **신규 파일 1 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\overlays\VillageOverlayRenderer.js`
                - **역할**: `VillageSystem.js`에 있던 마을 영토 색상화 및 촌장 텍스트 렌더링 로직을 이관받아 화면에 그립니다.
            - **신규 파일 2 (분해 생성)**: `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\overlays\ZoneOverlayRenderer.js`
                - **역할**: `ZoneManager.js`에 있던 주거, 벌목, 농사 등 구역(Zone) 타일 및 아이콘 시각화 로직을 이관받아 화면에 그립니다.
        2. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\VillageSystem.js`: 내부에 포함된 `render()`, `_renderTerritory()` 등의 뷰 관련 로직을 모두 삭제하여 순수 로직 컨트롤러로 남깁니다.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\ZoneManager.js`: 내부에 포함된 `render()` 함수를 삭제하여 순수 구역 데이터 매니저로 남깁니다.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\RenderCoordinator.js`: 기존에 `zm.render()`를 직접 호출하던 부분을 삭제하고, 새로 생성한 `VillageOverlayRenderer.render(ctx, engine.systemManager.villageSystem)` 방식으로 오버레이 렌더러에 위임(Delegation)하도록 수정합니다.
        3. **이동 할 폴더/파일**:
            - 비즈니스 논리(Logic) 폴더인 `engine\systems\civilization` 산하에 묶여있던 모든 화면 그리기(Presentation) 코드를 논리적으로 뜯어내어, 렌더링 전용 구역인 `engine\systems\render\overlays` 산하의 렌더러 파일들로 완벽히 분할 및 이전(Move)합니다.
