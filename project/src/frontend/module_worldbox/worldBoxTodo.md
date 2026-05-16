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

- [x] **18단계: SOLID 원칙 기반 건축 및 자원 시스템 리팩토링 (Decoupling & Cohesion)**
    - **목표**: `module_worldbox` 내 결합도가 높고 응집도가 낮은 자원 검사 로직과 건물 요구사항 하드코딩을 분리하여 SOLID 원칙(SRP, OCP)을 준수하는 구조로 리팩토링합니다.
    - **성과**:
        - `ResourceRegistry.js`: 자원 별칭 및 카테고리 매칭 로직 중앙화 (SRP 달성).
        - `BlueprintRegistry.js`: 건물별 요구 자원 데이터 분리 (OCP 달성).
        - `Inventory.js`: 순수 데이터 컨테이너로 경량화.
        - `ArchitectRole.js`: 하드코딩된 조건문 수백 줄 제거 및 레지스트리 위임.
    - [완료] 2026-05-13

- [x] **19단계: SOLID 원칙 기반 AI 타겟 탐색 시스템 리팩토링 (Strategy Pattern 적용)**
    - [x] Setup Strategy Infrastructure
        - [x] Create `engine/systems/behavior/strategies` directory
        - [x] Implement `TargetStrategy.js` (Base class)
        - [x] Implement `StrategyRegistry.js`
    - [x] Extract Search Strategies
        - [x] Implement `ResourceTargetStrategy.js`
        - [x] Implement `StorageTargetStrategy.js`
        - [x] Implement `BlueprintTargetStrategy.js`
    - [x] Refactor `TargetManager.js`
        - [x] Replace `switch` with registry delegation
        - [x] Remove legacy private search methods
    - [x] Final Verification
        - [x] Test resource and blueprint search
        - [x] Update `worldBoxTodo.md` with completion status
    - [완료] 2026-05-13

- [x] **20단계: SOLID 원칙 기반 ECS 렌더링 로직 분리 (Presentation & Logic Decoupling)**
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
    - [완료] 2026-05-13
        3. **이동 할 폴더/파일**:
            - 비즈니스 논리(Logic) 폴더인 `engine\systems\civilization` 산하에 묶여있던 모든 화면 그리기(Presentation) 코드를 논리적으로 뜯어내어, 렌더링 전용 구역인 `engine\systems\render\overlays` 산하의 렌더러 파일들로 완벽히 분할 및 이전(Move)합니다.

- [x] **21단계: SOLID 원칙 기반 마을 시스템 (God Class) 리팩토링 (SRP, SoC 적용)**
    - **목표**: `module_worldbox` 내에서 결합도가 가장 높고 응집도가 낮은 대표적인 God Class인 `VillageSystem.js`를 해체하여, 역할별로 독립적인 서브 시스템으로 분할합니다.
    - **문제점 (현황)**:
        - `VillageSystem.js`는 현재 마을 생성, 거주민 영입, 직업 스케줄링, 건물 건설 계획(Blueprint), 국가 간 세력 버프(Nation Buff), 자원 동기화 등 너무 많은 책임을 단일 파일에서 수행하고 있습니다. (SRP 위배)
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\village_modules`
        2. **분해 및 신규 생성 할 파일**:
            - `VillageRecruitmentSystem.js`: `_tryJoinNearestVillage`, `_recruitVillagers` 등 거주민 영입 및 인구 관리 로직 분리 생성 [완료]
            - `VillagePlanningSystem.js`: `_updateVillagePlanning`, `createBlueprint`, `_recalculateNeeds` 등 마을 발전 및 청사진 배치 로직 분리 생성 [완료]
            - `VillageEconomySystem.js`: 직업 스케줄링(긴급 재배치), 자원 동기화(`syncResources`), 생산/소비 이벤트 처리 로직 분리 생성 [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\VillageSystem.js`: 기존 방대한 로직을 삭제하고, 위 3개의 신규 서브 시스템을 조율(Orchestration)하는 최소한의 상태 데이터 컨테이너 역할로 축소 수정. [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\core\SystemManager.js`: 분할된 신규 서브 시스템들을 등록하고 실행 순서를 맞추도록 의존성 주입 코드 수정. [완료]
    - [완료] 2026-05-13
        4. **이동 할 폴더 및 파일**:
            - `VillageSystem.js`의 논리적 코드 블록(메서드)들이 신규 생성된 `village_modules` 폴더 산하의 각 클래스 파일들로 이동(Move)됩니다. (단, 물리적인 원본 파일 통째 이동은 없음)

- [x] **22단계: SOLID 원칙 기반 국가 시스템 (God Class) 리팩토링 (SRP 적용)**
    - **목표**: `VillageSystem.js`와 함께 모듈 내에서 가장 비대하고 결합도가 높은 God Class인 `NationSystem.js`를 논리적 책임에 따라 분할합니다.
    - **문제점 (현황)**:
        - 현재 `NationSystem.js`는 외교(평화/전쟁 선포), 군사(전투 및 점령 연산), 내부 정치(반란, 왕 선출, 충성도), 그리고 경제(세금, 공물, 마을 투자)라는 4가지 이상의 거대한 도메인 책임을 단일 파일이 모두 통제하고 있어, 유지보수가 어렵고 SRP(단일 책임 원칙)를 심각하게 위배하고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\nation_modules`
        2. **분해 및 신규 생성 할 파일**:
            - `NationDiplomacySystem.js`: `getRelationship`, `declareWar`, `makePeace`, `_syncDiplomaticSets` 등 외교 관계 및 여론(Opinion) 수치 관리 로직 분리. [완료]
            - `NationMilitarySystem.js`: `_processWars`, `_tryWarAdvance`, `_captureBorderTile`, `captureVillage` 등 전쟁 시뮬레이션 및 영토 점령 로직 분리. [완료]
            - `NationPoliticsSystem.js`: `_checkRebellions`, `_updateVillageLoyalty`, `_electKing`, `declareIndependence` 등 내부 결속 및 리더십 로직 분리. [완료]
            - `NationEconomySystem.js`: `_collectTaxes`, `_investInVillages`, `_processNationalTribute`, `_updateNationalProgress` 등 세금 징수 및 국가 발전도 로직 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\NationSystem.js`: 핵심 도메인 로직을 모두 덜어내고, 국가 생성(`createNation`)과 기초 정보 저장 및 4개의 하위 시스템을 통합 중계하는 얇은 퍼사드(Facade) 또는 상태 컨테이너로 수정. [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\core\SystemManager.js`: 분리된 국가 관련 4개의 서브 시스템 모듈들을 등록하고, `update` 페이즈에서의 실행 순서를 조정. [완료]
    - [완료] 2026-05-13
        4. **이동 할 폴더 및 파일**:
            - 기존 `NationSystem.js` 안에 섞여있던 거대한 로직 덩어리들이 논리적으로 완전히 분해되어 새로 생성된 `nation_modules` 폴더 산하의 전용 클래스들로 이동(Move)됩니다.

- [x] **23단계: SOLID 원칙 기반 AI 길찾기 시스템(Pathfinder) God Class 리팩토링 (SRP 적용)**
    - **목표**: `module_worldbox` 내에서 가장 복잡한 알고리즘과 자료구조가 혼재되어 있는 900줄 이상의 `Pathfinder.js`를 해체하여, 역할별로 독립적인 서브 모듈로 분할합니다.
    - **문제점 (현황)**:
        - 현재 `Pathfinder.js`는 A* 탐색 알고리즘, HPA*(계층적 길찾기) 클러스터 관리, MinHeap 자료구조 내장, 워커 스레드 갱신 파싱, 프레임당 길찾기 요청 대기열(Queue) 관리, 심지어 물리적인 이동 로직(`followPath`)까지 모든 책임을 단일 파일의 거대한 `static` 메서드들로 감당하고 있습니다. 이는 SRP를 명백히 위배하며 테스트 및 유지보수를 불가능하게 만듭니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\utils\pathfinding`
        2. **분해 및 신규 생성 할 파일**:
            - `MinHeap.js`: 파일 최상단에 숨겨져 있던 `MinHeap` 자료구조 클래스를 별도 파일로 분리. [완료]
            - `AStarSearch.js`: `findPath`, `findPathToZone` 등 순수 A* 기반 그리드 탐색 알고리즘 분리. [완료]
            - `HPAClusterManager.js`: `initHierarchy`, `updateHierarchy`, `markClusterDirty`, `applyRebuiltGraph` 등 계층적 노드망 관리 및 워커 스레드 통신 파싱 로직 분리. [완료]
            - `PathRequestQueue.js`: `requestPath`, `processQueue`, 캐시(Memoization) 및 오브젝트 풀링(`ObjectPool`) 관리 로직 분리. [완료]
            - `PathFollower.js`: `followPath` 메서드 등 엔티티의 실제 `Transform`과 `Velocity`를 수정하여 이동시키는 물리 제어 로직 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\utils\Pathfinder.js`: 거대한 내부 로직을 모두 덜어내고, 위 5개의 신규 서브 모듈들을 인스턴스화하거나 정적으로 연결하여 기존 외부 호출 인터페이스(API)를 그대로 유지시켜주는 얇은 퍼사드(Facade) 래퍼(Wrapper)로 축소 수정. [완료]
    - [완료] 2026-05-13

- [x] **24단계: SOLID 원칙 기반 지형 생성 시스템(TerrainGen) God Class 리팩토링 (SRP, SoC 적용)**
    - **목표**: `module_worldbox`에서 30KB가 넘는 방대한 크기와 수많은 책임을 지닌 `TerrainGen.js`를 해체하여, 상태 보관, 수학 연산, 맵 생성 로직, 렌더링 캐시 등을 명확히 분리합니다.
    - **문제점 (현황)**:
        - `TerrainGen.js`는 `SharedArrayBuffer` 기반의 환경 데이터(비옥도, 수질 등) 상태 보관, Perlin Noise 등의 수학적 생성 알고리즘, 단계별 프로그레시브 맵 생성 로직, 그리고 `colorLUT` 및 `packedPixel` 등의 뷰(View)/렌더링 데이터 준비 로직까지 한 파일에 모두 결합되어 있어 관심사 분리(SoC)와 단일 책임 원칙(SRP)을 심각하게 위배하고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\world\terrain_modules`
        2. **분해 및 신규 생성 할 파일**:
            - `TerrainDataBuffers.js`: `fertilityBuffer`, `occupancyBuffer` 등 `SharedArrayBuffer` 기반 환경 데이터 상태 보관 및 원자적(Atomic) 접근 로직 분리. [완료]
            - `NoiseGenerator.js`: `_perlin`, `_initNoise` 등 수학적인 노이즈 생성 알고리즘과 순열(Permutation) 테이블 분리. [완료]
            - `TerrainGenerator.js`: 바이옴 할당, Cellular Automata 수질/강 생성, 고도 생성 등 실제 프로그레시브 지형 생성 파이프라인 로직 분리. [완료]
            - `TerrainColorCache.js`: `colorLUT` 생성, `syncPackedPixel`, `villageColorBuffer` 등 렌더링 전용 색상 팩킹 및 시각적 매핑 로직 분리 (표현 계층 분리). [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\world\TerrainGen.js`: 거대한 내부 로직을 덜어내고, 생성된 서브 모듈들을 인스턴스화하여 외부 시스템(워커, 렌더러 등)과의 기존 인터페이스 브리지 역할만 담당하는 퍼사드(Facade) 구조로 수정. [완료]
    - [완료] 2026-05-13

- [x] **25단계: SOLID 원칙 기반 스폰 시스템(SpawnerSystem) God Class 리팩토링 (SRP, SoC 적용)**
    - **목표**: `module_worldbox` 내에서 초기 세계 생성과 실시간 인게임 스폰 로직이 강하게 결합된 `SpawnerSystem.js`를 해체하여, 역할별로 독립적인 스폰 모듈로 분할합니다.
    - **문제점 (현황)**:
        - `SpawnerSystem.js`는 게임 시작 시 한 번만 실행되어야 할 거대한 `initializeWorld`(초기 생태계 및 자원 생성) 로직과 매 프레임 실행되는 `autoSpawnResources`, 그리고 특정 엔티티 조립(`spawnEntity`, `spawnBee` 등) 로직을 단일 클래스 내에서 모두 처리하고 있어, 메모리 관리 측면과 단일 책임 원칙(SRP)에서 심각한 구조적 문제를 가지고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\economy\spawner_modules`
        2. **분해 및 신규 생성 할 파일**:
            - `WorldInitializer.js`: 게임 로드 시 1회만 동작하는 `initializeWorld` 루프(자연물, 광물, 인간 초기 스폰) 로직 전면 분리. [완료]
            - `DynamicSpawner.js`: 인게임 루프에서 주기적으로 호출되는 `autoSpawnResources` 및 이벤트(`SPAWN_POOP`, 브러시 툴 상호작용 등) 기반 동적 스폰 제어 분리. [완료]
            - `EcosystemAssembler.js`: `spawnGenericResource`, `spawnEntity`, `spawnBee` 등 구체적인 엔티티 타입 파악 및 하위 팩토리 매핑(Assembler) 역할 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\economy\SpawnerSystem.js`: 비대했던 메서드들을 모두 제거하고, 위의 신규 생성된 3개 서브 모듈 간의 의존성 주입(DI)과 외부 이벤트 수신만 담당하는 매우 가벼운 퍼사드(Facade) 역할로 변경. [완료]
    - [완료] 2026-05-13

- [x] **26단계: SOLID 원칙 기반 엔티티 매니저(EntityManager) God Class 리팩토링 (SRP 적용)**
    - **목표**: `module_worldbox` 아키텍처의 심장부 역할을 하며 모든 객체 수명 주기를 관리하는 `EntityManager.js`를 해체하여, 메모리 할당, 컴포넌트 버퍼 제어, 인덱싱 역할을 분리합니다.
    - **문제점 (현황)**:
        - `EntityManager.js`는 현재 엔티티의 ID 발급 및 재사용(Pool) 관리, 수십 개의 거대한 `TypedArray` 기반 컴포넌트 데이터 버퍼 할당 및 동적 확장, `DenseEntitySet`을 통한 동물/인간/건물 등 유형별 고속 검색 인덱스 갱신, 그리고 `SpatialHash` 위치 매핑 등 ECS 엔진의 모든 하부 제어를 단일 파일에서 통제하고 있습니다. 이는 극단적인 강결합과 단일 책임 원칙(SRP) 위배를 보여줍니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\core\entity_modules`
        2. **분해 및 신규 생성 할 파일**:
            - `EntityMemoryPool.js`: `createEntity`, `removeEntity`, `_ensureBufferCapacity`, 가비지 콜렉션용 `freeIds` 등 저수준의 ID 수명 주기 및 풀링 로직 분리. [완료]
            - `ComponentBufferManager.js`: `statsBuffer`, `renderBuffer`, `transformBuffer` 등 물리적인 `TypedArray` 선언 및 메모리 레이아웃 관리, 컴포넌트 추가/삭제 데이터 맵핑 로직 분리. [완료]
            - `EntityQueryIndex.js`: `DenseEntitySet` 클래스를 이동시키고, `animalIds`, `humanIds`, `buildingIds` 등 종족/유형별 고속 순회를 위한 인덱스 분류 및 상태 추적 로직 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\core\EntityManager.js`: 메모리 및 버퍼 제어 로직을 걷어내고, 위 3개의 모듈을 생성자에서 묶어서 하위 시스템들에 ECS 인터페이스를 노출하는 코디네이터(Coordinator) 역할로만 사용되도록 대폭 축소 수정. [완료]
    - [완료] 2026-05-13

- [x] **27단계: SOLID 원칙 기반 렌더링 코디네이터(RenderCoordinator) God Class 리팩토링 (SRP, SoC 적용)**
    - **목표**: `module_worldbox` 렌더링 시스템의 허브 역할을 하지만 코드가 1,000줄 이상 비대해진 `RenderCoordinator.js`를 해체하여, UI, 환경 효과, 디버그 오버레이 등 화면 요소별로 렌더링 책임을 분할합니다.
    - **문제점 (현황)**:
        - `RenderCoordinator.js`는 오프스크린 캔버스 더블 버퍼링 제어라는 본연의 책임을 넘어, 시간 표시 HUD(`renderTimeHUD`), 마우스 툴팁(`renderFertilityTooltip`), 파티클/플로팅 텍스트 풀링, 국가 영향력 버퍼 캐싱(`renderInfluenceOverlay`), 바람/광원 오버레이, 심지어 매우 복잡한 AI 디버그 시각화(`renderDebugAI`) 로직까지 모든 그리기 명령(Canvas API)을 단일 파일에 쑤셔넣어 단일 책임 원칙(SRP)과 관심사 분리(SoC)를 심각하게 위반하고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\ui` [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\overlays` [완료]
        2. **분해 및 신규 생성 할 파일**:
            - `HUDOverlayRenderer.js`: `renderTimeHUD`, 툴팁, 플로팅 텍스트 등 Screen Space UI 로직 분리. [완료]
            - `InfluenceOverlayRenderer.js`: 국가 영향력 반경 및 영토 오버레이 렌더링 분리. [완료]
            - `DebugAIOverlayRenderer.js`: AI 디버그 라인 및 탐색 범위 시각화 로직 분리. [완료]
            - `EnvironmentOverlayRenderer.js`: 바람 및 글로벌 일루미네이션(낮/밤) 렌더링 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\RenderCoordinator.js`: 비대한 그리기 메서드들을 모두 제거하고, 4개의 하위 렌더러를 조율하여 Z-Index 레이어 순서대로 렌더링을 중계하는 퍼사드(Facade) 구조로 수정. [완료]
    - [완료] 2026-05-13

- [x] **28단계: SOLID 원칙 기반 동식물 디자인/모션 렌더러(AnimalRenders, NatureRenders) God Class 리팩토링 (SRP, OCP 적용)**
    - **목표**: 수십 종의 동식물 그래픽과 특수 물리 모션(Squash & Stretch, 사망 연출 등)을 단일 `switch` 문으로 관리하여 개방-폐쇄 원칙(OCP)을 심각하게 위반하는 `AnimalRenders.js`와 `NatureRenders.js`를 전략(Strategy) 및 레지스트리 패턴으로 분해합니다.
    - **문제점 (현황)**:
        - `AnimalRenders.js`는 단순히 캐싱과 그리기를 넘어 `applyAdvancedStateMotion`, `Squash & Stretch` 등 물리적 애니메이션 변환까지 직접 수행하며, 새로운 동물(사자, 호랑이 등)이 추가될 때마다 거대한 `switch` 문을 지속적으로 수정해야 하는 전형적인 God Class입니다. `NatureRenders.js` 역시 식물, 암석, 특수 아이템(`cactus`, `bones`)에 대해 동일한 안티 패턴을 보이고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\objects\renders\strategies\animal` [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\objects\renders\strategies\nature` [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\animation` [완료]
        2. **분해 및 신규 생성 할 파일**:
            - `AnimalRenderRegistry.js` / `NatureRenderRegistry.js`: 종족명(type)과 그에 대응하는 구체적인 렌더링 전략(Strategy) 객체를 매핑하는 중앙 저장소 분리 생성. [완료]
            - `MotionAnimator.js`: `AnimalRenders.js` 내부에 하드코딩 되어 있던 타격, 사망 연출, 스쿼시 앤 스트레치 등 물리 애니메이션 로직을 분리. [완료]
            - `CactusRenderer.js`, `BonesRenderer.js`: `NatureRenders.js` 안에 하드코딩된 그리기 함수들을 독립적인 전략 클래스로 분리. [완료]
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\objects\renders\AnimalRenders.js`: 방대한 `switch(type)` 조건문을 모두 삭제하고, `AnimalRenderRegistry`와 `MotionAnimator`에 책임을 위임하는 경량화된 퍼사드(Facade)로 수정. [완료]
            - `d:\ERP\project\src\frontend\module_worldbox\engine\objects\renders\NatureRenders.js`: 동일하게 OCP를 준수하여 레지스트리에 위임하는 형태로 수정. [완료]
    - [완료] 2026-05-13

- [ ] **29단계: SOLID 원칙 기반 ECS 순회 병목(O(N)) 최적화 및 이벤트 주도(Event-Driven) 아키텍처 전환**
    - **목표**: `ProgressSystem`, `DeathProcessor` 등 매 프레임 전체 엔티티(`em.entities`)를 순회하는 God Loop을 제거하고, 상태 캐싱 및 이벤트 기반 업데이트로 전환합니다.
    - **문제점 (현황)**: 
        - `ProgressSystem`은 인구수와 총 목재량을 파악하기 위해 매 틱(Tick)마다 수만 개의 전체 엔티티를 순회(`for (const [id, entity] of em.entities)`)하고 있습니다.
        - `DeathProcessor`, `TargetManager` 등에서 방대한 배열의 역순 순회나 선형 큐 탐색이 잦아 프레임 드랍(Bottleneck)의 핵심 원인이 되고 있습니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더경로**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\core\events`
        2. **분해 및 신규 생성 할 파일**:
            - `GlobalStatsCache.js`: `humanCount`, `totalWood`, `activeBuildings` 등 전역 통계 데이터를 캐싱하고, 이벤트 리스너(`ENTITY_CREATED`, `ENTITY_DIED`)를 통해 증감만 $O(1)$로 계산하는 독립 모듈 생성.
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\ProgressSystem.js`: `em.entities` 순회 루프 완전 제거. `GlobalStatsCache.js`를 주입받아 즉시 조건 검사만 수행하도록 변경.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\DeathProcessor.js` & `TargetManager.js`: 배열 선형 탐색 로직을 이벤트 트리거 방식이나 `SpatialHash` 반경 쿼리 기반 처리로 변경.
        4. **이동 할 폴더/파일**:
            - 전역 통계 및 배열 순회 로직을 시스템 컨트롤러 내부에서 뜯어내어 `core/events` 폴더 산하의 전용 상태 캐시 파일들로 이동시킵니다.

- [x] **30단계: 동식물 물리/행동 연산(Kinematic/Herding) 공간 최적화 및 LOD 강화 (SRP, SoC 적용)** [완료] 2026-05-14
    - **목표**: `KinematicSystem`과 `HerdingSystem` 내부에 하드코딩된 중복 거리 연산을 분리하고, Boids 군집 알고리즘을 캡슐화합니다.
    - **문제점 (현황)**:
        - 물리 위치(`nextX`, `nextY`), 카메라 가시 영역 제외(LOD Tick Slicing) 및 충돌 회피(Separation) 등 복잡한 벡터 수학 연산이 시스템 내부 루프(`update`)에 섞여 결합도가 매우 높고 응집도가 떨어집니다. 특히 밀집 구역에서 군집 연산의 O(N^2) 폭주 위험이 존재합니다.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더경로**: 
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\motion\lod`
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\motion\physics`
        2. **분해 및 신규 생성 할 파일**:
            - `SpatialLODManager.js`: 화면 좌표와 엔티티 위치 기반 틱 슬라이싱(Tick Slicing) 및 원거리 계산 건너뛰기 연산 모듈 분할.
            - `FlockingSolver.js`: `HerdingSystem`의 리더 추종 및 Boids(응집/정렬) 로직 전면 분리.
            - `CollisionResolver.js`: `KinematicSystem`의 Separation 충돌 회피 수학 계산 로직 캡슐화 분리.
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\motion\KinematicSystem.js`: 하드코딩된 카메라 프러스텀 컬링(Frustum Culling) 계산 삭제 후 `SpatialLODManager`에 위임.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\motion\HerdingSystem.js`: 플로킹 연산을 `FlockingSolver`에 위임하여 순수 상태 컨트롤러로 축소.
        4. **이동 할 폴더/파일**:
            - 시스템 루프를 가득 채웠던 거리 계산식과 벡터 연산식 전체를 `motion/lod` 및 `motion/physics` 폴더 내의 단일 책임 객체(Strategy/Solver)들로 추출하여 이전합니다.

- [ ] **31단계: SOLID 원칙 기반 촌장(Chief) 시스템 안정화 및 버그 유발 요인 제거 (SRP, SoC 적용)**
    - **목표**: `module_worldbox` 내 촌장(Chief) 관련 상태 동기화 문제를 해결하고, `ChiefRole`에 집중된 과도한 책임(God Object)을 시스템 레벨로 분산하여 성능 저하 및 '직업 스래싱(Job Thrashing)' 버그를 원천 차단합니다.
    - **문제점 (현황)**:
        - **변수 불일치 및 단일 장애점(SPOF)**: 촌장 임명/사망 시 `village.chiefId`, `civ.jobType`, `civ.role`, `jobCtrl.currentJob` 4곳의 상태가 동시에 변경되어야 하나 트랜잭션이 보장되지 않아 유령 촌장 버그나 승계 불가 현상 발생 가능. 촌장이 없거나 버그에 걸리면 마을 전체의 직업 할당과 자원 수집이 영구 정지됨.
        - **God Object (과도한 책임)**: 개별 엔티티의 AI 역할인 `ChiefRole.js`가 매초마다 전체 마을 인구 루프(`_assignJob`), 전체 건물 루프(`_updateVillageTaskBoard`), 전체 영토 타일 루프(`_processTerritoryExpansion`) 등 매크로 연산을 강행하여 심각한 프레임 드랍 병목 유발. (SRP 위배)
        - **직업 전쟁(Job Thrashing)**: 촌장이 주민의 직업 점수를 매초 평가하여 다른 직업을 강제 할당하므로, 주민 행동이 끊임없이 초기화(`interrupt`)되어 아무것도 하지 못하는 데드락 현상(Job War) 발생.
    - **리팩토링 계획 (상세)**:
        1. **신규 생성 할 폴더경로**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\village_modules\jobs`
        2. **분해 및 신규 생성 할 파일**:
            - `VillageJobManager.js`: `ChiefRole`에 있던 자원 긴급도 파악(`_analyzeVillageNeeds`), T/O 계산(`_getWorkforceQuotas`), 작업게시판(`TaskBoard`) 갱신 등 **마을의 매크로 직업/경제 통제 로직**을 분리.
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\roles\ChiefRole.js`: 모든 마을 관리 매크로 로직 삭제. 촌장 캐릭터의 **물리적 행동(마을 회관 순찰, 리더십 아우라 전파 등)**만 담당하도록 대폭 축소.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\village_modules\VillagePlanningSystem.js`: 촌장의 `_processTerritoryExpansion`(영토 확장) 로직을 시스템 레벨 틱(Tick) 단위로 이관.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\civilization\village_modules\VillageRecruitmentSystem.js`: 촌장 사망 시 4가지 변수(`chiefId`, `jobType`, `role`, `JobController`)가 트랜잭션처럼 완벽히 원자적으로 동기화되게끔 구조화하고, 생존자 0명 시 `village.chiefId = null` 명시적 초기화 로직 추가.
        4. **동작 원리 및 구현 방향**:
            - 직업 배분 권한을 촌장(엔티티)에서 **시스템(VillageJobManager)**으로 격상. `VillageJobManager`가 2~3초 간격으로 `TaskBoard`에 직업 T/O를 게시하고, 각 실업자(`UNEMPLOYED`)가 자발적으로 직업을 받아가는 **Pull 기반(Event-Driven)** 시스템으로 전환하여 직업 스래싱 완전 방지. 촌장 엔티티는 이 시스템 효율에 보너스(Buff)를 주는 역할로 한정.

- [ ] **32단계: SOLID 원칙 기반 주민(Villager) 행동 AI 및 직업 상태 안정화 (SRP, State Pattern 적용)**
    - **목표**: 촌장(Chief)이 직업부여를 하게되면 각 주민들이 부여받은 직업을 바탕으로 업무를 하러 가는지 검토하고, 그 업무가 정상적으로 수행될 수 있는지, 그에 따라 상태변화가 잘 이뤄지는지, 또 그 상태가 명확하게 잘 정의되어 있는지 상세히 검증하고 안정화합니다. 나아가, 정의된 상태(State)에 따라 **애니메이션, 모션, 렌더링, 시각적 디자인이 완벽하게 동기화되어 게임상에 시각적으로 잘 표출되는지** 확인합니다. 촌장의 직업 할당부터 주민의 작업 수행 완료까지의 파이프라인에서 발생하는 불안정성 요소를 파악하고 상태 패턴을 적용해 설계적 결함과 시각적 불일치를 해결합니다.
    - **문제점 및 상세 검토 (현황 및 버그 유발 요소)**:
        - **직업 부여와 실행의 단절 (상태 전이 불량 및 변수 파편화)**: 
            - 촌장 또는 `VillageJobManager`가 직업을 부여할 때, 주민의 상태가 `civ.jobType`, `civ.role`, `jobCtrl.currentJob` 3곳에 중복으로 할당됩니다. 직업 전직 시 이 3가지가 원자적으로(Atomically) 동기화되지 않아 상태 전이가 비정상적으로 이뤄지면, "데이터 상으론 농부인데 행동 상태(AI)는 건축가"인 **유령 주민 버그**가 발생합니다.
            - **상태의 모호성 및 시각적 렌더링 불일치**: 직업을 부여받은 후 작업장으로 이동 중인 상태(`MOVING_TO_WORK`), 작업 중인 상태(`WORKING`), 자원이 없어 대기 중인 상태(`WAITING_FOR_RESOURCE`) 등이 하나의 `IDLE`이나 `WANDER` 상태에 모호하게 섞여 있습니다. 이로 인해 AI는 작업을 한다고 연산하지만 화면의 스프라이트(Sprite)는 그저 가만히 서있거나 무의미하게 걷는 모션만 반복하여, 유저가 볼 때 버그에 걸린 것으로 오인하는 **심각한 시각적/렌더링 괴리**가 발생합니다.
            - 타겟 소실: 직업을 부여받은 후, 주민이 실제로 해당 작업장(농장, 벌목장 등)으로 이동하기 위해 `TargetManager`와 `Pathfinder`를 호출하는 과정에서 타겟 ID(`targetId`)가 소실되면 상태 변화가 일어나지 않고 제자리에 멈춰버리는 데드락이 발생합니다.
        - **생존 vs 작업 충돌에 따른 상태 붕괴 (무한 루프 데드락)**: 
            - 작업 중 허기(`hunger`)가 임계치 이하로 떨어져 `HumanBrain`이 강제로 식사(`EAT/FORAGE`) 상태를 주입하면, 기존 업무 상태가 안전하게 저장되지 않고 `JobController.interrupt()`가 호출되어 작업 진행 데이터(`this.data`, 진행 타겟, 수집량 등)가 전부 증발합니다. 
            - 밥을 먹고 업무 상태로 복귀하려 할 때 올바른 상태 복원 로직이 없어, 이전에 진행 중이던 작업을 잃어버리고 처음부터 다시 시작해야 하는 심각한 무한 루프 병목과 자원 소실 버그가 존재합니다.
    - **리팩토링 및 구현 계획 (상세)**:
        1. **신규 생성 할 폴더경로**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\jobs`
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\render\jobs` (상태 기반 렌더링 폴더)
        2. **분해 및 신규 생성 할 파일**:
            - `JobStateSynchronizer.js`: 촌장의 직업 배정 시 발생하는 `civ.jobType`, `civ.role`, `jobCtrl` 동기화를 단일 트랜잭션으로 묶어 완벽한 일관성을 보장하는 Facade 클래스.
            - `JobStateDefinitions.js`: 기존에 모호했던 행동들을 `MOVING_TO_WORK`, `WORKING`, `WAITING_FOR_RESOURCE`, `INTERRUPTED_BY_NEEDS` 등의 명확한 Enum 상태(State)로 엄격하게 분리하고 재정의하는 모듈.
            - `JobTaskContext.js`: 직업 수행 중 중단 시 증발하던 임시 데이터(`data`, 타겟, 자원량)를 캡슐화하여, 생존 욕구로 인한 작업 이탈 시 상태(State)를 메모리에 보존(Save/Load)하는 스택(Stack) 기반 컨텍스트 래퍼.
            - `JobExecutionValidator.js`: 주민이 부여받은 직업 상태에 맞게 실제 타겟에 도달했는지 매 틱(Tick) 검증하고, 정상적으로 수행이 불가한 엣지 케이스(경로 막힘, 대상 소멸 등) 발생 시 상태 전이(State Transition) 오류를 감지하여 촌장/시스템에 재할당 요청을 보내는 모니터링 모듈.
            - `JobVisualRenderer.js`: `JobStateDefinitions.js`의 엄격한 상태(State)를 구독하여, 상태에 1:1로 대응하는 **도구 렌더링(곡괭이, 낫 등 장착)**, **작업 모션 애니메이션(내리치기, 씨앗 뿌리기 등)**, **플로팅 이모티콘(자원 부족 시 물음표 띄우기 등)**을 시각적으로 강제 매핑하여 그리는 Presentation 전담 모듈.
        3. **수정 할 파일**:
            - `d:\ERP\project\src\frontend\module_worldbox\engine\components\behavior\JobController.js`: 데이터를 날리는 `interrupt()` 함수를 제거하고, `JobTaskContext`를 활용해 진행 중인 작업을 일시 정지/재개하는 `pauseJob()` 및 `resumeJob()` 인터페이스로 전면 개편. 내부 로직은 `JobStateDefinitions.js`를 참조해 명확한 상태 변화를 일으키도록 수정.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\systems\behavior\HumanBehaviorSystem.js`: 밥을 먹거나 잠을 잔 후(FORAGE, SLEEP), 원래 직업 상태(IDLE 및 작업 재개)로 복귀 시 보존된 타겟을 다시 `AIState`에 복원해주는 연결 로직 추가.
            - `d:\ERP\project\src\frontend\module_worldbox\engine\objects\renders\HumanRenders.js`: 기존에 이동/대기 모션만 처리하던 렌더링 로직에 `JobVisualRenderer.js`를 연결하여, `WORKING` 상태일 때는 Squash & Stretch 모션의 폭을 키우고 특정 작업 스프라이트 프레임으로 렌더링되도록 시각적 디자인 코드를 대폭 보강.
        4. **촌장(Chief)의 세부 동작 및 직업 관리 구현 계획**:
            - **직업 할당 감사자(Job Auditor) 역할**: 촌장은 `VillageJobManager`와 연계하여 매 5초마다 실업자나 작업이 막힌 주민을 식별하는 `InspectState`에 돌입합니다. 직업을 부여받았으나 특정 상태(예: `WAITING_FOR_RESOURCE` 또는 타겟 도달 실패)에 10초 이상 머물러 업무를 정상적으로 수행하지 못하는 주민을 발견하면, 해당 주민의 상태를 강제로 초기화(`RESET`)하고 새 작업을 부여하여 데드락을 해소합니다.
            - **마을 회관 및 인프라 순찰 (PatrolState)**: `ChiefRole` 내부에 순찰 상태를 신설. 촌장이 마을의 `VillageCenter`, `Storage`, `Farm` 등 주민들이 실제 작업하는 주요 거점을 방문하여 작업 진행도를 눈으로 확인(Survey)하는 듯한 목적 지향 이동을 구현합니다.
            - **물리적 리더십 아우라 발산**: 촌장이 작업장을 순찰하며 이동할 때, 반경 200px 내에서 일하고 있는(상태가 `WORKING`인) 주민들에게 `spatialHash`를 통해 접근, O(1) 비용으로 `WorkSpeedBuff` (작업/이동 속도 20% 증가)를 즉각 부여합니다. 이 때 **버프를 받는 주민의 몸에 황금색 입자(Particle) 효과**가 나타나고 작업 애니메이션의 재생 속도(FPS)가 빨라지는 등 촌장의 감독이 시각적인 디자인/렌더링으로 완벽하게 표출되도록 구현합니다.
            - **솔선수범 (Emergency Assist)**: 마을 내 식량/목재의 긴급도가 최고조에 달할 경우, 촌장이 직접 도구를 들고 현장에 투입되어 채집(Gather) 작업을 수행하는 긴급 행동 패턴(`EmergencyWorkingState`)을 추가합니다. (이때 촌장의 외형에 땀방울 애니메이션 추가)

## 도시 진화 및 인프라 발전 5단계 마스터 플랜 (Phase 1 ~ 5)

- [x] **33단계 (Phase 1): 마을 영토 확장 및 구역(Zone) 동기화 안정화 (SRP, Event-Driven)**
    - **목표**: 소규모 정착지에서 마을로 성장하는 과정에서 발생하는 영토 데이터 불일치를 해결하고, 촌장의 주도적인 영토 확장 프로세스를 확립합니다.
    - **문제점 (현황 및 변수 불일치)**:
        - `VillageSystem.js`의 `village.territory`(Set) 확장과 `ZoneManager.js`의 AABB 바운딩 박스(Zone 크기) 갱신이 개별적으로 동작합니다. 영토 타일은 늘어났으나 Zone이 갱신되지 않으면, 벌목꾼(Logger)이나 농부(Farmer)가 새로 확장된 영토에서 일하지 못하고 AI가 정지하는 데드락(Deadlock)이 발생합니다.
    - **구현 계획 (상세)**:
        - `VillageTerritoryManager.js` 모듈을 신설하여 영토 확장 트랜잭션을 전담합니다. 영토가 확장될 때 반드시 `ZoneManager.rebalanceVillageZones`를 콜백(Callback) 또는 이벤트로 동기 호출하도록 강제합니다.
        - **촌장(Chief)의 동작 구현**: 촌장은 매 30초마다 마을 인구 밀도(`members.size / territory.size`)를 계산하는 `SurveyState`에 진입합니다. 밀도가 높을 경우, 촌장이 직접 영토 외곽 경계선으로 걸어가 "영토 확장(Expand)" 애니메이션(깃발 꽂기 등)을 취합니다. 애니메이션이 완료되는 시점에 원자적(Atomically)으로 영토 변수와 Zone 변수가 동시에 갱신됩니다.

- [x] **34단계 (Phase 2): 건축 청사진 및 자원 조달 파이프라인 무결성 확보 (State Pattern)**
    - **목표**: 집, 대장간 등 건물이 늘어나는 과정에서 자원 증발 버그를 막고 건축가의 작업 상태를 완벽히 보존합니다.
    - **문제점 (현황 및 변수 불일치)**:
        - 건축가(Architect)가 창고에서 자원을 꺼내(`inventory.items`) 청사진(`Structure.progress`)에 투입하러 가는 도중 맹수에게 공격받아 사망하거나 밥을 먹으러 가면, `Inventory`와 청사진 간의 트랜잭션이 끊어져 자원이 공중에서 증발하는 버그가 발생합니다.
    - **구현 계획 (상세)**:
        - `ResourceTransaction.js` 클래스를 도입하여 "창고 출고 -> 인벤토리 보관 -> 건물 투입" 과정을 묶습니다. 중단 시 인벤토리의 자원을 그 자리에 드랍(`DroppedItem`)시켜 자원 보존을 강제합니다.
        - **촌장(Chief)의 동작 구현**: 촌장은 순찰(Patrol) 중 미완성 청사진(Blueprint) 근처를 지나갈 때 `InspectState`로 전환합니다. 만약 해당 청사진이 일정 시간 이상 방치되어 있다면, 촌장이 즉시 근처의 잉여 자원을 주워 직접 청사진에 투입(솔선수범)하여 건축 병목을 강제로 해소합니다.

- [x] **35단계 (Phase 3): 도시 인프라 및 도로망(Road Network) 구축 설계 (Observer Pattern)**
    - **목표**: 흙길에서 돌길로 이어지는 교통 인프라를 구축하고, 길찾기(Pathfinder) 속도를 최적화합니다.
    - **문제점 (현황 및 변수 불일치)**:
        - 건물 사이에 도로를 건설하여 지형(`TerrainGen.js` 버퍼)이 변경될 때, `Pathfinder.js`의 HPA* 그래프 모서리(Edge) 비용 갱신이 누락되어, 주민들이 도로를 무시하고 숲을 가로지르는 인지 부조화 및 길찾기 비효율이 발생합니다.
    - **구현 계획 (상세)**:
        - 도로 건설 완료 이벤트를 옵저버(Observer)가 수신하여, 해당 타일 좌표의 `Pathfinder` 이동 가중치(Cost)를 대폭 낮추고 HPA* 클러스터를 즉각 증분 업데이트(Incremental Update) 하도록 연결합니다.
        - **촌장(Chief)의 동작 구현**: 촌장의 경로 자체가 "도로 건설"의 기준이 됩니다. 촌장이 마을회관, 창고, 주요 작업장을 오가는 궤적(Trail)을 `VillageSystem`이 백그라운드에서 추적합니다. 이 궤적의 밟힌 횟수가 임계치를 넘으면 촌장이 도로 건설 청사진을 자동으로 배치하여 "인프라 발전"을 주도합니다.

- [x] **36단계 (Phase 4): 국가 창설 및 타 마을 간의 외교 상태 동기화 (Facade Pattern)**
    - **목표**: 마을이 거대해져 국가(Nation)로 승격될 때, 소속 개체들의 진영 데이터 불일치로 인한 아군 공격(Friendly Fire) 버그를 방지합니다.
    - **문제점 (현황 및 변수 불일치)**:
        - 반란이나 국가 합병 발생 시, `NationSystem.js`에서는 국가의 영유권이 바뀌었으나, 수백 명의 주민(Villager) 개별 엔티티의 `civ.nationId` 변수가 전부 업데이트되기 전에 교전 AI(`CombatSystem`)가 실행되면, 어제까지 이웃이던 주민끼리 서로 공격하는 치명적인 상태 불일치가 발생합니다.
    - **구현 계획 (상세)**:
        - `NationStateSynchronizer.js`를 신설하여, 국가 상태 변경 시 틱(Tick)을 정지(Pause)시키고 해당 국가 소속 모든 엔티티의 `civ.nationId`와 `AIState.targetId`(적군 타겟핑)를 일괄 초기화하는 동기화 배치를 수행합니다.
        - **촌장(Chief)의 동작 구현**: 국가 합병이나 독립 등 중대한 외교 이벤트가 발생하면, 촌장(또는 영주)은 마을 회관(Village Center)으로 이동하여 `SpeechState`에 돌입합니다. 촌장이 선언 이펙트(말풍선 및 파티클)를 띄우는 순간, 반경 내 주민들이 모여들어 환호하며 일제히 `civ.nationId`가 원자적으로 동기화되는 장관을 연출합니다.

- [x] **37단계 (Phase 5): 고급 인프라 창고 물류 및 경제 순환망 구축 (Mediator Pattern)**
    - **목표**: 1차 자원(나무, 돌)을 가공품(철, 빵)으로 변환하는 고급 인프라와 분산된 창고 간의 물류 데드락을 방지합니다.
    - **문제점 (현황 및 변수 불일치)**:
        - 창고(Storage) 엔티티가 여러 개일 때, 운반자(Gatherer/Merchant)가 꽉 찬 A 창고로 이동하던 중 A 창고가 파괴되거나 가득 차면, 목적지(`targetId`) 불일치로 인해 물건을 들고 제자리에서 무한 대기하는 좀비 AI 버그가 발생합니다.
    - **구현 계획 (상세)**:
        - `LogisticsMediator.js`를 신설하여 마을 내 모든 창고 용량을 가상(Virtual)으로 통합 관리합니다. 운반자의 목적지가 무효화되면 즉시 다른 여유 창고로 `targetId`를 재할당(Re-routing)하는 안전망을 구축합니다.
        - **촌장(Chief)의 동작 구현**: 경제가 고도화되면 촌장은 직접 자원을 캐지 않고 '물류 감독관' 역할을 수행합니다. 마을 전체의 `resources` 총량을 모니터링하다가 식량이나 목재가 불균형하게 편중되면, 촌장이 인벤토리가 빈 상태의 상인(Merchant)이나 잉여 인력을 직접 지정 호출하여 "A 창고에서 B 작업장으로 운송하라"는 하이 레벨 지시(`DispatchState`)를 내립니다.
