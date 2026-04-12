# Material Management (MM) DB Table Specification

자재 관리(MM) 모듈의 데이터베이스 테이블 명세서입니다.
전사적 자원 관리(ERP)의 표준 자재 마스터 구조를 따르며, 기초(BAS), 구매(PUR), 재고 수불(INV) 모듈과 독립적으로 운영될 수 있도록 고도로 정규화된 마스터 데이터를 정의합니다.

> **[공통 규칙 적용 사항]**
> - 모든 테이블은 `id` (BIGINT AUTO_INCREMENT)를 기본 키(PK)로 가집니다.
> - 인덱스 및 제약조건은 `U1`, `U2` (Unique), `IDX1`, `IDX2` (Non-Unique) 네이밍 룰을 따릅니다.
> - 시스템 공통 컬럼(`useYn`, `createdBy`, `createdAt`, `changedBy`, `changedAt`)이 모든 테이블에 포함됩니다.

---

## 1. 자재 기본 정보 (Material Basic Data)

### 1.1 `mmMaterial` (자재 마스터 - 글로벌 기본 뷰)
자재의 전사 공통 속성(명칭, 유형, 기본 단위, 중량 등)을 관리합니다.

| 컬럼명            | 데이터 타입   | Null | Key  | 기본값   | 설명                                     |
| :---------------- | :------------ | :--- | :--- | :------- | :--------------------------------------- |
| `id`              | BIGINT        | N    | PK   | AUTO_INC | 일련번호                                 |
| `materialCd`      | VARCHAR(45)   | N    | U1   |          | 자재 코드                                |
| `materialNm`      | VARCHAR(100)  | N    |      |          | 자재명                                   |
| `materialType`    | VARCHAR(20)   | N    | IDX1 |          | 자재 유형 (ROH, HALB, FERT 등)           |
| `matGroup`        | VARCHAR(45)   | Y    | IDX2 |          | 자재 그룹 (분류 체계)                    |
| `baseUnit`        | VARCHAR(20)   | N    |      |          | 기본 측정 단위 (Base UOM)                |
| `netWeight`       | DECIMAL(10,3) | Y    |      |          | 순 중량                                  |
| `grossWeight`     | DECIMAL(10,3) | Y    |      |          | 총 중량 (포장 포함)                      |
| `weightUnit`      | VARCHAR(20)   | Y    |      |          | 중량 단위                                |
| `volume`          | DECIMAL(10,3) | Y    |      |          | 부피                                     |
| `volumeUnit`      | VARCHAR(20)   | Y    |      |          | 부피 단위                                |
| `oldMaterialCd`   | VARCHAR(45)   | Y    | IDX3 |          | 구 자재 코드 (레거시 매핑용)             |
| `industryStd`     | VARCHAR(100)  | Y    |      |          | 산업 표준 규격명                         |
| `lifeCycleStatus` | VARCHAR(20)   | Y    |      | 'ACTIVE' | 수명주기 상태 (ACTIVE, BLOCKED, DELETED) |
| `useYn`           | INT           | Y    |      | 1        | 사용 여부                                |
| 공통              | -             | Y    |      |          | `createdBy/At`, `changedBy/At`           |

### 1.2 `mmMatUom` (자재 다중 단위 변환)
기본 단위(EA) 외에 구매(BOX), 재고(PALLET) 등 다중 단위(Alternative UOM)의 변환 계수를 관리합니다.

| 컬럼명             | 데이터 타입 | Null | Key  | 기본값   | 설명                            |
| :----------------- | :---------- | :--- | :--- | :------- | :------------------------------ |
| `id`               | BIGINT      | N    | PK   | AUTO_INC | 일련번호                        |
| `materialCd`       | VARCHAR(45) | N    | U1   |          | 자재 코드                       |
| `altUnit`          | VARCHAR(20) | N    | U1   |          | 대체 단위 (Alternative UOM)     |
| `numerator`        | INT         | N    |      | 1        | 분자 (예: 10 EA = 1 BOX에서 10) |
| `denominator`      | INT         | N    |      | 1        | 분모 (예: 10 EA = 1 BOX에서 1)  |
| `isPurchasingUnit` | INT         | Y    |      | 0        | 기본 구매 단위 지정 여부        |
| `isIssueUnit`      | INT         | Y    |      | 0        | 기본 출고 단위 지정 여부        |
| `useYn`            | INT         | Y    |      | 1        | 사용 여부                       |
| 공통               | -           | Y    |      |          | `createdBy/At`, `changedBy/At`  |

---

## 2. 자재 확장 뷰 (Plant / MRP / Accounting)

### 2.1 `mmMatPlant` (플랜트 자재 뷰)
특정 공장/지사(Plant)에 종속된 자재의 속성(입출고 로케이션, 특별 조달 방식 등)을 관리합니다.

| 컬럼명          | 데이터 타입 | Null | Key      | 기본값   | 설명                           |
| :-------------- | :---------- | :--- | :------- | :------- | :----------------------------- |
| `id`            | BIGINT      | N    | PK       | AUTO_INC | 일련번호                       |
| `materialCd`    | VARCHAR(45) | N    | U1       |          | 자재 코드                      |
| `plantCd`       | VARCHAR(45) | N    | U1, IDX1 |          | 플랜트(공장) 코드              |
| `profitCenter`  | VARCHAR(45) | Y    |          |          | 수익 센터 매핑                 |
| `batchMngYn`    | INT         | Y    |          | 0        | 배치(Batch) 관리 대상 여부     |
| `serialMngYn`   | INT         | Y    |          | 0        | 시리얼(Serial) 관리 대상 여부  |
| `issueSlocCd`   | VARCHAR(45) | Y    |          |          | 기본 출고 재고위치 (SLoc)      |
| `receiptSlocCd` | VARCHAR(45) | Y    |          |          | 기본 입고 재고위치 (SLoc)      |
| `useYn`         | INT         | Y    |          | 1        | 플랜트 내 사용 여부            |
| 공통            | -           | Y    |          |          | `createdBy/At`, `changedBy/At` |

### 2.2 `mmMatMrp` (자재 MRP 및 계획 뷰)
자재 소요량 계획(MRP)을 위한 플랜트별 제어 매개변수를 관리합니다.

| 컬럼명          | 데이터 타입   | Null | Key  | 기본값   | 설명                                          |
| :-------------- | :------------ | :--- | :--- | :------- | :-------------------------------------------- |
| `id`            | BIGINT        | N    | PK   | AUTO_INC | 일련번호                                      |
| `materialCd`    | VARCHAR(45)   | N    | U1   |          | 자재 코드                                     |
| `plantCd`       | VARCHAR(45)   | N    | U1   |          | 플랜트 코드                                   |
| `mrpType`       | VARCHAR(20)   | N    |      | 'ND'     | MRP 유형 (PD: MRP, ND: 계획없음 등)           |
| `mrpController` | VARCHAR(45)   | Y    | IDX1 |          | MRP 담당자/그룹                               |
| `lotSize`       | VARCHAR(20)   | Y    |      | 'EX'     | 로트 크기 결정 방식 (EX: 로트별, FX: 고정 등) |
| `minLotSize`    | DECIMAL(15,3) | Y    |      | 0        | 최소 발주/생산 로트 크기                      |
| `maxLotSize`    | DECIMAL(15,3) | Y    |      | 0        | 최대 발주/생산 로트 크기                      |
| `reorderPoint`  | DECIMAL(15,3) | Y    |      | 0        | 재주문점 (Reorder Point)                      |
| `safetyStock`   | DECIMAL(15,3) | Y    |      | 0        | 안전 재고 수량                                |
| `leadTime`      | INT           | Y    |      | 0        | 계획 납품/생산 리드타임 (Days)                |
| `useYn`         | INT           | Y    |      | 1        | 사용 여부                                     |
| 공통            | -             | Y    |      |          | `createdBy/At`, `changedBy/At`                |

### 2.3 `mmMatAccounting` (자재 회계/원가 뷰)
자재의 평가, 원가 계산 및 회계 연동(FI/CO)을 위한 매개변수를 관리합니다.

| 컬럼명           | 데이터 타입   | Null | Key  | 기본값   | 설명                                           |
| :--------------- | :------------ | :--- | :--- | :------- | :--------------------------------------------- |
| `id`             | BIGINT        | N    | PK   | AUTO_INC | 일련번호                                       |
| `materialCd`     | VARCHAR(45)   | N    | U1   |          | 자재 코드                                      |
| `plantCd`        | VARCHAR(45)   | N    | U1   |          | 플랜트 코드                                    |
| `valClass`       | VARCHAR(20)   | N    | IDX1 |          | 평가 클래스 (Valuation Class - G/L계정 매핑용) |
| `priceControl`   | VARCHAR(10)   | N    |      | 'V'      | 가격 제어 (S: 표준원가, V: 이동평균가)         |
| `standardPrice`  | DECIMAL(15,2) | Y    |      | 0.00     | 표준 원가 (Standard Price)                     |
| `movingAvgPrice` | DECIMAL(15,2) | Y    |      | 0.00     | 이동 평균가 (Moving Average Price)             |
| `priceUnit`      | INT           | Y    |      | 1        | 가격 결정 단위 (예: 100개당 단가면 100)        |
| `currency`       | VARCHAR(10)   | N    |      | 'KRW'    | 통화 코드                                      |
| `useYn`          | INT           | Y    |      | 1        | 사용 여부                                      |
| 공통             | -             | Y    |      |          | `createdBy/At`, `changedBy/At`                 |

---

## 3. BOM (자재명세서) 마스터

### 3.1 `mmBomHead` (BOM 헤더)
| 컬럼명       | 데이터 타입   | Null | Key      | 기본값       | 설명                                          |
| :----------- | :------------ | :--- | :------- | :----------- | :-------------------------------------------- |
| `id`         | BIGINT        | N    | PK       | AUTO_INC     | 일련번호                                      |
| `bomId`      | VARCHAR(45)   | N    | U1       |              | BOM 시스템 채번 ID                            |
| `materialCd` | VARCHAR(45)   | N    | U2, IDX1 |              | 모품목(Parent) 자재 코드                      |
| `plantCd`    | VARCHAR(45)   | N    | U2       |              | 플랜트 코드                                   |
| `bomUsage`   | VARCHAR(20)   | N    | U2       | '1'          | BOM 용도 (1: 생산, 2: 엔지니어링, 3: 영업 등) |
| `altBom`     | VARCHAR(10)   | N    | U2       | '01'         | 대체 BOM 번호                                 |
| `baseQty`    | DECIMAL(15,3) | N    |          | 1            | 기준 수량 (Base Quantity)                     |
| `validFrom`  | DATE          | N    |          |              | 유효 시작일                                   |
| `validTo`    | DATE          | N    |          | '9999-12-31' | 유효 종료일                                   |
| `bomStatus`  | INT           | Y    |          | 1            | BOM 상태 (1: 활성, 0: 비활성)                 |
| 공통         | -             | Y    |          |              | `createdBy/At`, `changedBy/At`                |

### 3.2 `mmBomItem` (BOM 상세 컴포넌트)
| 컬럼명        | 데이터 타입   | Null | Key      | 기본값       | 설명                                 |
| :------------ | :------------ | :--- | :------- | :----------- | :----------------------------------- |
| `id`          | BIGINT        | N    | PK       | AUTO_INC     | 일련번호                             |
| `bomId`       | VARCHAR(45)   | N    | U1, IDX1 |              | BOM 헤더 ID                          |
| `itemNode`    | INT           | N    | U1       |              | 품목 노드 번호 (항목 순번 10, 20...) |
| `componentCd` | VARCHAR(45)   | N    | IDX2     |              | 하위 컴포넌트(Child) 자재 코드       |
| `compQty`     | DECIMAL(15,3) | N    |          |              | 투입 소요량                          |
| `compUnit`    | VARCHAR(20)   | N    |          |              | 투입 단위                            |
| `scrapPct`    | DECIMAL(5,2)  | Y    |          | 0.00         | 스크랩(불량) 예상 할증률 (%)         |
| `validFrom`   | DATE          | N    |          |              | 항목 유효 시작일 (ECM 연동용)        |
| `validTo`     | DATE          | N    |          | '9999-12-31' | 항목 유효 종료일                     |
| `useYn`       | INT           | Y    |          | 1            | 사용 여부                            |
| 공통          | -             | Y    |          |              | `createdBy/At`, `changedBy/At`       |

---

## 4. 창고 및 저장 위치 토폴로지 (Warehouse & SLOC)

### 4.1 `mmWarehouse` (창고 마스터)
| 컬럼명        | 데이터 타입  | Null | Key  | 기본값   | 설명                           |
| :------------ | :----------- | :--- | :--- | :------- | :----------------------------- |
| `id`          | BIGINT       | N    | PK   | AUTO_INC | 일련번호                       |
| `warehouseCd` | VARCHAR(45)  | N    | U1   |          | 창고 코드 (Warehouse Number)   |
| `warehouseNm` | VARCHAR(100) | N    |      |          | 창고명                         |
| `plantCd`     | VARCHAR(45)  | N    | IDX1 |          | 소속 플랜트 코드               |
| `location`    | VARCHAR(200) | Y    |      |          | 물리적 주소/설명               |
| `manager`     | VARCHAR(45)  | Y    |      |          | 창고 담당자                    |
| `useYn`       | INT          | Y    |      | 1        | 사용 여부                      |
| 공통          | -            | Y    |      |          | `createdBy/At`, `changedBy/At` |

### 4.2 `mmStorageLoc` (재고 위치/저장 위치)
플랜트 및 창고 하위의 논리적 재고 구분 단위입니다.

| 컬럼명        | 데이터 타입  | Null | Key      | 기본값   | 설명                                    |
| :------------ | :----------- | :--- | :------- | :------- | :-------------------------------------- |
| `id`          | BIGINT       | N    | PK       | AUTO_INC | 일련번호                                |
| `warehouseCd` | VARCHAR(45)  | N    | U1, IDX1 |          | 소속 창고 코드                          |
| `slocCd`      | VARCHAR(45)  | N    | U1       |          | 재고 위치 (Storage Location) 코드       |
| `slocNm`      | VARCHAR(100) | N    |          |          | 위치명 (예: 원자재 A구역, 완제품 창고)  |
| `storageType` | VARCHAR(20)  | Y    |          |          | 위치 속성 (일반, 냉동, 검사대기구역 등) |
| `useYn`       | INT          | Y    |          | 1        | 사용 여부                               |
| 공통          | -            | Y    |          |          | `createdBy/At`, `changedBy/At`          |

### 4.3 `mmStorageBin` (물리적 빈/랙 마스터)
WMS 확장을 대비한 창고 내 최소 물리적 적재 공간을 정의합니다.

| 컬럼명        | 데이터 타입   | Null | Key      | 기본값   | 설명                           |
| :------------ | :------------ | :--- | :------- | :------- | :----------------------------- |
| `id`          | BIGINT        | N    | PK       | AUTO_INC | 일련번호                       |
| `warehouseCd` | VARCHAR(45)   | N    | U1, IDX1 |          | 창고 코드                      |
| `slocCd`      | VARCHAR(45)   | N    | U1       |          | 재고 위치 코드                 |
| `binCd`       | VARCHAR(45)   | N    | U1       |          | 빈 번호 (예: 01-A-03-B)        |
| `maxWeight`   | DECIMAL(10,2) | Y    |          | 0        | 최대 적재 가능 중량            |
| `maxVolume`   | DECIMAL(10,2) | Y    |          | 0        | 최대 적재 가능 부피            |
| `binStatus`   | VARCHAR(20)   | Y    |          | 'EMPTY'  | 빈 상태 (EMPTY, FULL, BLOCKED) |
| `useYn`       | INT           | Y    |          | 1        | 사용 여부                      |
| 공통          | -             | Y    |          |          | `createdBy/At`, `changedBy/At` |

### 4.4 `mmMatFixedBin` (자재-빈 고정 매핑)
자재가 창고에 들어올 때 고정적으로 보관될 기본 빈(Fixed Bin)을 지정합니다.

| 컬럼명        | 데이터 타입 | Null | Key      | 기본값   | 설명                             |
| :------------ | :---------- | :--- | :------- | :------- | :------------------------------- |
| `id`          | BIGINT      | N    | PK       | AUTO_INC | 일련번호                         |
| `materialCd`  | VARCHAR(45) | N    | U1, IDX1 |          | 자재 코드                        |
| `warehouseCd` | VARCHAR(45) | N    | U1       |          | 창고 코드                        |
| `slocCd`      | VARCHAR(45) | N    | U1       |          | 재고 위치 코드                   |
| `fixedBinCd`  | VARCHAR(45) | N    | U1       |          | 고정 할당된 빈 번호              |
| `minBinQty`   | INT         | Y    |          | 0        | 빈 내 유지 최소 수량 (보충 기준) |
| `maxBinQty`   | INT         | Y    |          | 0        | 빈 내 최대 적재 수량             |
| 공통          | -           | Y    |          |          | `createdBy/At`, `changedBy/At`   |

---

## 5. 배치(Batch) 및 시리얼(Serial) 마스터

### 5.1 `mmBatch` (배치/로트 마스터)
| 컬럼명          | 데이터 타입 | Null | Key      | 기본값       | 설명                                 |
| :-------------- | :---------- | :--- | :------- | :----------- | :----------------------------------- |
| `id`            | BIGINT      | N    | PK       | AUTO_INC     | 일련번호                             |
| `materialCd`    | VARCHAR(45) | N    | U1, IDX1 |              | 자재 코드                            |
| `batchNo`       | VARCHAR(45) | N    | U1       |              | 배치/로트 번호                       |
| `plantCd`       | VARCHAR(45) | N    | IDX2     |              | 플랜트 코드                          |
| `mfgDate`       | DATE        | Y    |          |              | 제조/생산일                          |
| `expDate`       | DATE        | Y    |          |              | 만료/유통기한일                      |
| `batchStatus`   | VARCHAR(20) | Y    |          | 'RESTRICTED' | 배치 상태 (UNRESTRICTED, BLOCKED 등) |
| `vendorBatchNo` | VARCHAR(45) | Y    |          |              | 공급업체 부여 원본 로트 번호         |
| `useYn`         | INT         | Y    |          | 1            | 사용 여부                            |
| 공통            | -           | Y    |          |              | `createdBy/At`, `changedBy/At`       |

### 5.2 `mmSerial` (시리얼 번호 마스터)
| 컬럼명          | 데이터 타입 | Null | Key      | 기본값    | 설명                                    |
| :-------------- | :---------- | :--- | :------- | :-------- | :-------------------------------------- |
| `id`            | BIGINT      | N    | PK       | AUTO_INC  | 일련번호                                |
| `materialCd`    | VARCHAR(45) | N    | U1, IDX1 |           | 자재 코드                               |
| `serialNo`      | VARCHAR(45) | N    | U1       |           | 개별 시리얼 일련번호                    |
| `equipmentNo`   | VARCHAR(45) | Y    | IDX2     |           | 설비 관리 연동 번호 (PM 모듈 확장용)    |
| `serialStatus`  | VARCHAR(20) | Y    |          | 'INSTOCK' | 시리얼 상태 (INSTOCK, ISSUED, SCRAPPED) |
| `warrantyStart` | DATE        | Y    |          |           | 보증(Warranty) 시작일                   |
| `warrantyEnd`   | DATE        | Y    |          |           | 보증 종료일                             |
| 공통            | -           | Y    |          |           | `createdBy/At`, `changedBy/At`          |

---

## 6. 자재 특수 속성 (MPN, 대체, 위험물, 특별재고)

### 6.1 `mmMpn` (제조업체 부품 번호 - MPN/AML)
| 컬럼명       | 데이터 타입  | Null | Key      | 기본값     | 설명                                     |
| :----------- | :----------- | :--- | :------- | :--------- | :--------------------------------------- |
| `id`         | BIGINT       | N    | PK       | AUTO_INC   | 일련번호                                 |
| `materialCd` | VARCHAR(45)  | N    | U1, IDX1 |            | 내부 자재 코드                           |
| `mfrCd`      | VARCHAR(45)  | N    | U1       |            | 실제 제조업체(Maker) 코드                |
| `mfrPartNo`  | VARCHAR(100) | N    | U1       |            | 제조사 부품 번호 (MPN)                   |
| `amlStatus`  | VARCHAR(20)  | N    |          | 'APPROVED' | AML(승인제조사) 상태 (APPROVED, BLOCKED) |
| `priority`   | INT          | Y    |          | 1          | 구매 우선순위                            |
| 공통         | -            | Y    |          |            | `createdBy/At`, `changedBy/At`           |

### 6.2 `mmMatReplace` (대체 자재 관리)
| 컬럼명          | 데이터 타입 | Null | Key      | 기본값   | 설명                                       |
| :-------------- | :---------- | :--- | :------- | :------- | :----------------------------------------- |
| `id`            | BIGINT      | N    | PK       | AUTO_INC | 일련번호                                   |
| `materialCd`    | VARCHAR(45) | N    | U1, IDX1 |          | 원본 자재 코드                             |
| `altMaterialCd` | VARCHAR(45) | N    | U1, IDX2 |          | 대체 가능 자재 코드                        |
| `replaceType`   | VARCHAR(10) | N    |          | '2-WAY'  | 대체 방식 (1-WAY: 단방향, 2-WAY: 상호대체) |
| `validFrom`     | DATE        | N    |          |          | 유효 시작일                                |
| `priority`      | INT         | Y    |          | 1        | 대체 우선순위                              |
| `useYn`         | INT         | Y    |          | 1        | 규칙 사용 여부                             |
| 공통            | -           | Y    |          |          | `createdBy/At`, `changedBy/At`             |

### 6.3 `mmHazardous` (유해 물질 / MSDS)
| 컬럼명          | 데이터 타입  | Null | Key      | 기본값   | 설명                             |
| :-------------- | :----------- | :--- | :------- | :------- | :------------------------------- |
| `id`            | BIGINT       | N    | PK       | AUTO_INC | 일련번호                         |
| `materialCd`    | VARCHAR(45)  | N    | U1, IDX1 |          | 자재 코드                        |
| `hazClass`      | VARCHAR(45)  | N    |          |          | 위험 등급 (가연성, 부식성 등)    |
| `casNo`         | VARCHAR(45)  | Y    |          |          | 화학물질 등록번호 (CAS No)       |
| `msdsUrl`       | VARCHAR(255) | Y    |          |          | 물질안전보건자료(MSDS) 링크/경로 |
| `handlingGuide` | TEXT         | Y    |          |          | 취급 및 보관 주의사항            |
| 공통            | -            | Y    |          |          | `createdBy/At`, `changedBy/At`   |

### 6.4 `mmSpecialStock` (특별 재고 속성 식별자)
| 컬럼명         | 데이터 타입  | Null | Key      | 기본값   | 설명                                           |
| :------------- | :----------- | :--- | :------- | :------- | :--------------------------------------------- |
| `id`           | BIGINT       | N    | PK       | AUTO_INC | 일련번호                                       |
| `materialCd`   | VARCHAR(45)  | N    | U1, IDX1 |          | 자재 코드                                      |
| `specStockInd` | VARCHAR(10)  | N    | U1       |          | 특별 재고 구분자 (K: 벤더위탁, Q: 프로젝트 등) |
| `referenceId`  | VARCHAR(45)  | N    | U1       |          | 참조 ID (벤더 코드 또는 WBS 번호 등)           |
| `description`  | VARCHAR(200) | Y    |          |          | 특기 사항                                      |
| `useYn`        | INT          | Y    |          | 1        | 사용 여부                                      |
| 공통           | -            | Y    |          |          | `createdBy/At`, `changedBy/At`                 |

---

## 7. 설계 변경 및 문서 연동 (ECM & DMS)

### 7.1 `mmMatRevision` (자재 리비전 / ECM 이력)
| 컬럼명       | 데이터 타입 | Null | Key      | 기본값   | 설명                                    |
| :----------- | :---------- | :--- | :------- | :------- | :-------------------------------------- |
| `id`         | BIGINT      | N    | PK       | AUTO_INC | 일련번호                                |
| `materialCd` | VARCHAR(45) | N    | U1, IDX1 |          | 자재 코드                               |
| `revisionNo` | VARCHAR(20) | N    | U1       |          | 리비전 번호 (Rev A, Rev B 등)           |
| `ecmNo`      | VARCHAR(45) | Y    | IDX2     |          | 설계 변경(Engineering Change) 문서 번호 |
| `validFrom`  | DATE        | N    |          |          | 해당 리비전의 생산/구매 유효 시작일     |
| `reason`     | TEXT        | Y    |          |          | 변경 사유                               |
| 공통         | -           | Y    |          |          | `createdBy/At`, `changedBy/At`          |

### 7.2 `mmMatDoc` (자재 문서 매핑 - DMS)
| 컬럼명       | 데이터 타입  | Null | Key      | 기본값   | 설명                                   |
| :----------- | :----------- | :--- | :------- | :------- | :------------------------------------- |
| `id`         | BIGINT       | N    | PK       | AUTO_INC | 일련번호                               |
| `materialCd` | VARCHAR(45)  | N    | U1, IDX1 |          | 자재 코드                              |
| `docType`    | VARCHAR(20)  | N    | U1       |          | 문서 유형 (DRW: 도면, SPEC: 시방서 등) |
| `docNo`      | VARCHAR(45)  | N    | U1       |          | DMS 시스템의 원본 문서 번호            |
| `docVersion` | VARCHAR(10)  | N    | U1       |          | 문서 버전                              |
| `fileUrl`    | VARCHAR(255) | Y    |          |          | 파일 다운로드/열람 경로                |
| `useYn`      | INT          | Y    |          | 1        | 사용(매핑 유지) 여부                   |
| 공통         | -            | Y    |          |          | `createdBy/At`, `changedBy/At`         |

---

## 8. 품질 검사 기준 (QM Setup)

### 8.1 `mmMatQm` (자재 품질 검사 설정)
| 컬럼명         | 데이터 타입 | Null | Key      | 기본값   | 설명                                                   |
| :------------- | :---------- | :--- | :------- | :------- | :----------------------------------------------------- |
| `id`           | BIGINT      | N    | PK       | AUTO_INC | 일련번호                                               |
| `materialCd`   | VARCHAR(45) | N    | U1, IDX1 |          | 자재 코드                                              |
| `plantCd`      | VARCHAR(45) | N    | U1       |          | 플랜트 코드                                            |
| `inspType`     | VARCHAR(20) | N    | U1       |          | 검사 유형 (01: 수입검사, 04: 공정검사 등)              |
| `isPostToInsp` | INT         | Y    |          | 1        | 입고 시 재고를 '품질검사 중' 상태로 자동 할당할지 여부 |
| `aqlLevel`     | VARCHAR(20) | Y    |          |          | 합격 품질 수준 (AQL)                                   |
| `inspInterval` | INT         | Y    |          | 0        | 정기 재검사 주기 (Days)                                |
| `useYn`        | INT         | Y    |          | 1        | 검사 활성화 여부                                       |
| 공통           | -           | Y    |          |          | `createdBy/At`, `changedBy/At`                         |