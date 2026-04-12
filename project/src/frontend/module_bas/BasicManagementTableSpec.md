# Basic Master Data (BAS) DB Table Specification

전사 공통 기준 정보(BAS) 모듈의 데이터베이스 테이블 명세서입니다.
모든 모듈의 최상위 기준이 되는 조직 구조, 거래처(BP), 환율 데이터를 고도로 정규화하여 정의합니다.

> **[공통 규칙 적용 사항]**
> - 모든 테이블은 `id` (BIGINT AUTO_INCREMENT)를 기본 키(PK)로 가집니다.
> - 인덱스 및 제약조건은 `U1`, `U2` (Unique), `IDX1`, `IDX2` (Non-Unique) 네이밍 룰을 따릅니다.
> - 시스템 공통 컬럼(`useYn`, `createdBy`, `createdAt`, `changedBy`, `changedAt`)이 모든 테이블에 포함됩니다.

---

## 1. 조직 마스터 (Organization)

### 1.1 `basCompany` (회사/법인 마스터)
최상위 독립 법인 또는 회사 단위입니다.

| 컬럼명         | 데이터 타입  | Null | Key  | 기본값   | 설명                           |
| :------------- | :----------- | :--- | :--- | :------- | :----------------------------- |
| `id`           | BIGINT       | N    | PK   | AUTO_INC | 일련번호                       |
| `compCd`       | VARCHAR(45)  | N    | U1   |          | 회사(법인) 코드                |
| `compNm`       | VARCHAR(100) | N    |      |          | 회사명                         |
| `regNo`        | VARCHAR(20)  | Y    | IDX1 |          | 사업자등록번호                 |
| `corpNo`       | VARCHAR(20)  | Y    |      |          | 법인등록번호                   |
| `ceoNm`        | VARCHAR(50)  | Y    |      |          | 대표자명                       |
| `bizType`      | VARCHAR(100) | Y    |      |          | 업태                           |
| `bizItem`      | VARCHAR(100) | Y    |      |          | 종목                           |
| `baseCurrency` | VARCHAR(10)  | N    |      | 'KRW'    | 법인 기본 통화                 |
| `useYn`        | INT          | Y    |      | 1        | 사용 여부                      |
| 공통           | -            | Y    |      |          | `createdBy/At`, `changedBy/At` |

### 1.2 `basPlant` (사업장/플랜트 마스터)
회사 산하의 물리적/논리적 사업장, 공장, 지사 단위입니다.

| 컬럼명    | 데이터 타입  | Null | Key      | 기본값   | 설명                                   |
| :-------- | :----------- | :--- | :------- | :------- | :------------------------------------- |
| `id`      | BIGINT       | N    | PK       | AUTO_INC | 일련번호                               |
| `compCd`  | VARCHAR(45)  | N    | U1, IDX1 |          | 소속 회사 코드                         |
| `plantCd` | VARCHAR(45)  | N    | U1       |          | 사업장(플랜트) 코드                    |
| `plantNm` | VARCHAR(100) | N    |          |          | 사업장명                               |
| `regNo`   | VARCHAR(20)  | Y    |          |          | 사업장별 종속 사업자번호 (종사업장 등) |
| `address` | VARCHAR(200) | Y    |          |          | 사업장 주소                            |
| `useYn`   | INT          | Y    |          | 1        | 사용 여부                              |
| 공통      | -            | Y    |          |          | `createdBy/At`, `changedBy/At`         |

### 1.3 `basDept` (부서/조직도 마스터)
회사의 조직도(Tree) 구성을 위한 부서 마스터입니다.

| 컬럼명         | 데이터 타입  | Null | Key      | 기본값   | 설명                           |
| :------------- | :----------- | :--- | :------- | :------- | :----------------------------- |
| `id`           | BIGINT       | N    | PK       | AUTO_INC | 일련번호                       |
| `compCd`       | VARCHAR(45)  | N    | U1, IDX1 |          | 소속 회사 코드                 |
| `deptCd`       | VARCHAR(45)  | N    | U1       |          | 부서 코드                      |
| `deptNm`       | VARCHAR(100) | N    |          |          | 부서명                         |
| `parentDeptCd` | VARCHAR(45)  | Y    | IDX2     |          | 상위 부서 코드 (최상위는 NULL) |
| `plantCd`      | VARCHAR(45)  | Y    |          |          | 물리적 소속 사업장 (옵션)      |
| `costCenter`   | VARCHAR(45)  | Y    |          |          | CO 모듈 매핑용 코스트 센터     |
| `useYn`        | INT          | Y    |          | 1        | 사용 여부                      |
| 공통           | -            | Y    |          |          | `createdBy/At`, `changedBy/At` |

---

## 2. 거래처 마스터 (Business Partner)
공급사(Vendor)와 고객사(Customer)를 분리하지 않고 비즈니스 파트너(BP) 형태로 통합 관리합니다.

### 2.1 `basBizPartner` (거래처 기본 정보)
| 컬럼명         | 데이터 타입   | Null | Key  | 기본값   | 설명                                               |
| :------------- | :------------ | :--- | :--- | :------- | :------------------------------------------------- |
| `id`           | BIGINT        | N    | PK   | AUTO_INC | 일련번호                                           |
| `bpCd`         | VARCHAR(45)   | N    | U1   |          | 거래처(BP) 코드                                    |
| `bpNm`         | VARCHAR(100)  | N    | IDX1 |          | 거래처명                                           |
| `bpType`       | VARCHAR(20)   | N    | IDX2 |          | 파트너 유형 (CUST: 고객, VEND: 공급사, BOTH: 겸용) |
| `regNo`        | VARCHAR(20)   | Y    | IDX3 |          | 사업자등록번호                                     |
| `ceoNm`        | VARCHAR(50)   | Y    |      |          | 대표자명                                           |
| `bizCondition` | VARCHAR(100)  | Y    |      |          | 업태/종목                                          |
| `phone`        | VARCHAR(20)   | Y    |      |          | 대표 연락처                                        |
| `address`      | VARCHAR(200)  | Y    |      |          | 본사 주소                                          |
| `creditLimit`  | DECIMAL(15,2) | Y    |      | 0.00     | 여신 한도 (SD 연동용)                              |
| `useYn`        | INT           | Y    |      | 1        | 사용 여부                                          |
| 공통           | -             | Y    |      |          | `createdBy/At`, `changedBy/At`                     |

### 2.2 `basBpBank` (거래처 은행/계좌 정보)
지급(AP) 및 수금(AR)을 위한 거래처의 은행 계좌 정보를 관리합니다.

| 컬럼명      | 데이터 타입  | Null | Key      | 기본값   | 설명                           |
| :---------- | :----------- | :--- | :------- | :------- | :----------------------------- |
| `id`        | BIGINT       | N    | PK       | AUTO_INC | 일련번호                       |
| `bpCd`      | VARCHAR(45)  | N    | U1, IDX1 |          | 거래처 코드                    |
| `bankCd`    | VARCHAR(20)  | N    | U1       |          | 은행 코드 (공통코드 연동)      |
| `accountNo` | VARCHAR(45)  | N    | U1       |          | 계좌번호                       |
| `depositor` | VARCHAR(100) | N    |          |          | 예금주명                       |
| `isDefault` | INT          | Y    |          | 0        | 기본 결제 계좌 여부            |
| `useYn`     | INT          | Y    |          | 1        | 사용 여부                      |
| 공통        | -            | Y    |          |          | `createdBy/At`, `changedBy/At` |

---

## 3. 환율 마스터 (Exchange Rate)

### 3.1 `basExRate` (일자별 환율 정보)
다중 통화 거래를 지원하기 위한 일자별 환율을 관리합니다.

| 컬럼명      | 데이터 타입   | Null | Key      | 기본값   | 설명                                        |
| :---------- | :------------ | :--- | :------- | :------- | :------------------------------------------ |
| `id`        | BIGINT        | N    | PK       | AUTO_INC | 일련번호                                    |
| `fromCur`   | VARCHAR(10)   | N    | U1, IDX1 |          | 대상 통화 (예: USD)                         |
| `toCur`     | VARCHAR(10)   | N    | U1       |          | 기준 통화 (예: KRW)                         |
| `validFrom` | DATE          | N    | U1, IDX2 |          | 적용 시작일                                 |
| `exRate`    | DECIMAL(15,5) | N    |          |          | 환율 (Exchange Rate)                        |
| `rateType`  | VARCHAR(10)   | N    | U1       | 'M'      | 환율 유형 (M: 매매기준율, B: 송금보낼때 등) |
| `useYn`     | INT           | Y    |          | 1        | 사용 여부                                   |
| 공통        | -             | Y    |          |          | `createdBy/At`, `changedBy/At`              |

---

## 4. 전사 문서 및 첨부파일 관리 (DMS)
MM, SD, FI 등 모든 하위 모듈에서 공통으로 참조하고 재사용할 수 있는 중앙 집중형 문서 및 물리적 파일 마스터입니다.

### 4.1 `basDocument` (문서 마스터)
도면, 계약서, 시방서 등 논리적인 문서의 메타데이터와 버전을 관리합니다.

| 컬럼명      | 데이터 타입  | Null | Key  | 기본값   | 설명                                     |
| :---------- | :----------- | :--- | :--- | :------- | :--------------------------------------- |
| `id`        | BIGINT       | N    | PK   | AUTO_INC | 일련번호                                 |
| `docNo`     | VARCHAR(45)  | N    | U1   |          | 문서 번호 (자동 채번)                    |
| `docType`   | VARCHAR(20)  | N    | IDX1 |          | 문서 유형 (CONTRACT, DRAWING, MANUAL 등) |
| `docNm`     | VARCHAR(200) | N    |      |          | 문서명 / 제목                            |
| `version`   | VARCHAR(20)  | N    | U1   | '1.0'    | 문서 버전 (리비전 관리용)                |
| `docStatus` | VARCHAR(20)  | N    |      | 'DRAFT'  | 문서 상태 (DRAFT, APPROVED, OBSOLETE)    |
| `owner`     | VARCHAR(45)  | Y    |      |          | 문서 소유자 / 책임자                     |
| `useYn`     | INT          | Y    |      | 1        | 사용 여부                                |
| 공통        | -            | Y    |      |          | `createdBy/At`, `changedBy/At`           |

### 4.2 `basFile` (첨부파일 마스터)
실제 스토리지(S3, NAS 등)에 저장되는 물리적 파일의 경로와 다형성(Polymorphic) 참조를 관리합니다.

| 컬럼명       | 데이터 타입  | Null | Key  | 기본값   | 설명                                        |
| :----------- | :----------- | :--- | :--- | :------- | :------------------------------------------ |
| `id`         | BIGINT       | N    | PK   | AUTO_INC | 일련번호                                    |
| `fileId`     | VARCHAR(45)  | N    | U1   |          | 고유 파일 ID (UUID 등)                      |
| `refTable`   | VARCHAR(45)  | N    | IDX1 |          | 참조 테이블명 (예: basDocument, mmMaterial) |
| `refId`      | VARCHAR(45)  | N    | IDX1 |          | 참조 데이터의 PK 값                         |
| `originalNm` | VARCHAR(255) | N    |      |          | 원본 파일명                                 |
| `saveNm`     | VARCHAR(255) | N    |      |          | 저장된 실제 파일명                          |
| `filePath`   | VARCHAR(500) | N    |      |          | 파일 저장 경로 / URL                        |
| `fileSize`   | BIGINT       | Y    |      | 0        | 파일 크기 (Bytes)                           |
| `extension`  | VARCHAR(10)  | Y    |      |          | 파일 확장자 (pdf, jpg 등)                   |
| 공통         | -            | Y    |      |          | `createdBy/At`, `changedBy/At`              |
