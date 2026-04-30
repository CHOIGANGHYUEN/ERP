# 🌍 WorldBox 동물 상태(State) 및 렌더링 고도화 작업 완료 내역

## Phase 8: 동물 AI 상태 및 렌더링 고도화 (완료)

### 31. 동물 상태(State) 정의 및 컴포넌트 확장
- `State.js`에 `AnimalStates` (IDLE, SLEEP, WALK, RUN, FLEE, EVADE, HUNT, EAT, DIE) 정의.
- `DietType` 정의 (HERBIVORE, CARNIVORE, OMNIVORE).
- `BaseStats` 컴포넌트 구현: hunger, fatigue, health, diet 필드 추가.
- `Visual` 컴포넌트 확장: `alpha` 필드 추가 및 ECS 클래스화.

### 32. 상태별 비헤이비어 로직 구현
- `AnimalBehaviorSystem` 내 상태별 핸들러 구현.
- `handleEatState`: 식성에 따른 섭취 및 포만감 회복.
- `handleEvadeState`: 위협으로부터 반대 방향 도주 벡터 계산.
- `handleSleepState`: 피로도 누적 시 수면 및 회복 로직.
- `updateEntityAI`: 목적지 거리 기반 속도 조절 및 FSM 연동.

### 33. 사망 및 생태계 환원 로직 구현
- `handleDieState`: 사망 시 서서히 페이드아웃(`alpha` 감소).
- `TerrainGen.fertilityBuffer` 연동: 사망 지점의 비옥도 환원 및 `ChunkManager` 더티 마킹.
- 개체 소멸(`EntityManager.removeEntity`) 처리.

### 34. 상태 기반 렌더링 및 애니메이션
- `EntityRenderer.renderAnimal`: 상태별 분기 렌더링.
- `SLEEP`: 'Zzz' 텍스트 애니메이션 파티클 추가.
- `RUN/FLEE`: 애니메이션 속도 1.5배 가속.
- `DIE`: 0번 프레임(사체) 고정 렌더링.
- **절차적 애니메이션**: `drawSheep` 등 모든 동물 그리기에 `Math.sin(time)` 기반 다리 교차 로직 추가.

### 35. 엔티티 생성 팩토리 업데이트
- `EntityFactory.js`에서 새 컴포넌트(`BaseStats`, `State`, `Visual` 클래스)를 사용하여 엔티티를 생성하도록 수정.
- 초기 허기 및 피로도에 무작위성을 부여하여 활동 패턴 다양화.

## Phase 9: AI 안정화 및 생태계 시뮬레이션 정밀 튜닝 (완료)

### 36. AI 탐색 로직 안정화 및 버그 수정
- `findFood` 시 발생하는 런타임 에러 해결 및 탐색 성능 개선.
- 예외 처리 강화: `findFood` 내에서 `targetStats`가 없을 경우에 대한 방어 코드(`?.`) 추가.
- 잡식(Omnivore) 동물 탐색 로직 고도화: 식물과 동물 모두를 검색하되 거리/효율에 따른 가중치 적용.
- HUNT 상태 가속: 먹이를 추적할 때 RUN 상태와 동일하게 1.5배 가속 로직 적용.

### 37. 스트레스 테스트 및 밸런스 조정
- 허기/피로도 감쇠율 조정: 동물의 생존 시간을 약 2.5배 늘려 관찰 용이성 확보.
- 자원 순환 루프 완성: 배설물(`poop`)의 비옥도 환원(Decomposition) 로직 구현.
- 식생 재생성 속도 연동: 비옥도에 따른 식물 성장 확률 상향(5% -> 10%).

### 38. 디버그 시각화 도구 추가
- **상태 텍스트 렌더링**: 동물 머리 위에 현재 FSM 모드 표시.
- **타겟 라인 그리기**: 사냥/이동 중인 타겟까지 점선(Dashed Line) 표시.
- **디버그 플래그**: `Engine.viewFlags.debugAI`를 통한 일괄 토글 기능 구현.