# 🌍 Antigravity 시뮬레이션 엔진 v2.0 기술 명세서 (Harness & Architecture)

요청하신 사항에 따라, 테스트 하네스(Test Harness) 구조의 기존 명세와 최신 고성능 엔진 아키텍처(Phase 10: Zero-Allocation)를 통합하여 재정리했습니다.

---

## 1. 🏗️ 엔진 아키텍처 개요 (Dual-Thread Design)

본 엔진은 메인 스레드의 렌더링 병목을 방지하기 위해 물리 연산과 시각 처리가 분리된 **멀티스레드 아키텍처**를 채택하고 있습니다.

- **Main Thread (UI & Rendering)**: 사용자 입력, 카메라 제어, `RenderSystem`을 통한 고속 비트맵 출력 담당.
- **Worker Thread (Logic & Physics)**: `SharedArrayBuffer` 기반으로 개체 AI, 길 찾기, 물리 연산을 실시간 병렬 처리.

---

## 2. ⚠️ 테스트 케이스 최우선 제약 사항 (Atomic Modification)

시스템 무결성 검증을 위한 절대적인 전제조건입니다. 모든 객체는 **ECS (Entity-Component-System) 혹은 Trait 패턴**을 강제합니다.

- **원자적 동기화 수정 (Atomic Modification)**: 아래 5가지 폴더는 하나의 통제 단위(Set)로 수정되어야 합니다.
    1. `life/`: 개체 베이스 데이터 및 타이머
    2. `emotions/`: 욕구 및 감정 트리거 판단
    3. `action/`: 상태머신 기반 Task 주입
    4. `renders/`: 상태별 프레임 애니메이션 및 출력 로직
    5. `sets/`: 위 요소를 단일 뇌(Brain) 형태로 번들링하여 의존성을 주입하는 팩토리 계층

- **대상 시스템**: `Life Set` (Creature, Animal, Plant), `Society Set` (Village, Building), `World Set` (Engine Loop)

---

## 3. 테스트 하네스 구성 (Test Harness Elements)

### 3.1 테스트 드라이버 (Test Driver)
- **`GameView.vue`**: 메인 엔트리로, 캔버스 및 백그라운드 Worker 간의 상태 동기화 관리.
- **`World.js`**: `requestAnimationFrame` 루프를 통제하는 코어 컨트롤러.

### 3.2 테스트 스텁 및 목 오브젝트 (Test Stub & Mock)
- **`api/gameApi.js`**: 백엔드 통신 전까지 브라우저 메모리 기반으로 동작하는 스텁.
- **Offscreen Canvas**: 정적 지형 및 완공된 건물은 사전 렌더링 후 `drawImage`로 복사하여 Draw Call 부하 최소화.
- **Object Pooling**: 빈번하게 생성/소멸되는 생명체의 GC 부하 방지를 위해 메모리 재사용 풀 운용.

---

## 4. ⚡ 고성능 최적화 및 런타임 제어 (Performance Optimization)

정상적인 60FPS 달성을 위한 핵심 기술 명세입니다.

- **Y-버킷 정렬 (Y-Bucket Sort)**: $O(N \log N)$ 정렬 대신 $O(N)$ 시간 복잡도의 Y-좌표 기반 버킷 정렬 도입. (Array Pool 기반 재사용)
- **비트맵 스탬핑 (Bitmap Stamping)**: 무거운 벡터 그라데이션 연산을 대신하여 전용 텍스처를 찍어내는 방식(Shadow/Light Stamp)으로 전환.
- **쿼드트리 공간 분할 (`QuadTree.js`)**: 3200x3200 월드의 탐색 부하를 $O(\log N)$으로 최적화하여 맵 전체 순회 차단.
- **제로-할당 프록시 (Zero-Allocation Proxy)**: 렌더링 루프 시 신규 객체 생성을 금지하고 `spatialProxies` 풀을 통해 데이터만 동기화.

---

## 5. 테스트 슈트 (Test Suite)

상호작용 검증이 필요한 기능별 유스케이스 그룹입니다.

- **창조 및 상호작용 슈트**: 드래그 패닝, 마우스 휠 타겟 줌 모니터링, 개체 소환 및 건축 상호작용.
- **환경 통제 슈트**: 실시간 지형 업데이트, 날씨 및 재난 강제 발생 트리거 테스트.
- **상태 시각화 (Inspector) 슈트**: 클릭 시 직업, 욕구, 감정 스탯 등이 패널에 정확히 동기화되어 출력되는지 검증.

---

## 6. 핵심 하위 컴포넌트 명세 (Component System Elements)

- **논리적 의사결정 (Behavior)**: `evaluator`가 감정과 주변 상황을 종합해 `DRIVE`를 반환하고, `injectors`가 이를 `TaskQueue`에 주입.
- **액션 유지 (State Transition)**: `stateExecutors`를 통해 이동/충돌 처리 수행. (Wall-Sliding 지형 우회 알고리즘 준수)
- **시각화 (Render Pipelines)**: 상태 전이에 따른 Sprite 프레임 연산 및 말풍선(InteractionSystem) 출력.

---

## 🛡️ 부록: 엔진 기여를 위한 코딩 표준 (Dev Standards)

1. **프레임 루프 내 할당 금지**: `render()` 및 `update()` 루프 내부에서 `[]`, `{}`, `new Map()` 등의 할당을 금지하고 재사용 필드를 활용하십시오.
2. **워커 환경 격리**: Worker 스크립트 내에서 DOM API(`document`, `canvas` 등) 접근 시 ReferenceError가 발생하므로, 환경 체크(`typeof document`)를 반드시 수행하십시오.
3. **불변 상태 준수**: `SharedArrayBuffer` 데이터는 `SharedState.js`에 정의된 `STRIDE`와 `PROPS` 오프셋을 통해서만 접근하십시오.