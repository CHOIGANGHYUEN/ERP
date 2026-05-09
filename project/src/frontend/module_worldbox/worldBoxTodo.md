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

## 5단계: HPA* 그래프 재계산 및 AI Fallback 탐색 최적화 (AI & Pathfinding)
*   **현황:** `Pathfinder.js`에 계층적 길찾기(HPA*)와 캐싱, 큐잉이 이미 훌륭하게 구현되어 있으며, `TargetManager` 또한 Spiral 탐색과 Zone 기반 탐색을 지원합니다.
*   **구체적 실행 계획:**
    *   **Pathfinder:** 지형이 변경될 때(`markClusterDirty`) 발생하는 `rebuildAllTransitions` (HPA* 구역 경계 재계산)는 무거운 작업입니다. 이를 `simulationWorker.js`로 분산시켜 지형 파괴/건설 시 프레임이 멈추는 현상을 해결합니다.
    *   **TargetManager:** 특정 자원을 찾지 못했을 때 2000 픽셀 반경을 탐색하는 Fallback(전역 탐색) 로직(`forceGlobal`)이 여전히 메인 스레드에 부하를 줄 수 있습니다. 전역 탐색 요청은 즉시 처리하지 않고 별도의 저우선순위 큐(Low-priority Queue)로 빼내어 프레임당 탐색 반경을 분할(Time-slicing)하여 처리합니다.

## 6단계: 게임 로직 및 생태계 시뮬레이션 경량화 (Gameplay Logic Optimization)
*   **목표:** 게임의 규칙이나 플레이어의 시각적 경험은 전혀 훼손하지 않으면서, 내부적인 시뮬레이션 연산 횟수와 복잡도를 줄입니다.
*   **구체적 실행 계획:**
    *   **마을 영입 최적화 (`VillageSystem`):** 현재 무소속 인간이 마을을 찾을 때 모든 마을 리스트를 순회하며 거리를 비교($O(V)$)합니다. 마을 중심점도 `SpatialHash`에 정적 노드로 등록하여, $O(1)$ 수준의 근거리 탐색으로 영입 로직 부하를 없앱니다.
    *   **농사 및 생산 시스템 인덱싱 (`FarmingSystem`):** 농작물 성장을 5초마다 체크하지만, 전체 건물(`buildingIds`)을 순회하며 농장인지 검사하는 낭비가 있습니다. 작동 중인 농장 전용 큐(`activeFarmIds`)를 유지하여 불필요한 엔티티 순회를 원천 차단합니다.
    *   **대사 및 분해 시스템 지연 처리 (`MetabolismSystem`):** 배설물 분해 로직이나 미세한 노화(Age) 연산 등 1프레임 단위의 즉각적인 렌더링이 필요 없는 생태계 데이터들은 업데이트 주기를 더 크게(예: 3초) 늘리고, 매 프레임 한도(Max)치만큼만 처리하도록 Staggering 큐를 고도화합니다.