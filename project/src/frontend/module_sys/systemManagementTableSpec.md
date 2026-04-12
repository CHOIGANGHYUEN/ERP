시스템 데이터베이스 테이블 명세서 (System DB Table Specification)

본 명세서는 제공된 DDL을 바탕으로 작성되었으며, 기능 및 도메인별로 테이블을 그룹화하여 정리했습니다. 다국어 지원 테이블은 원본 테이블명의 끝에 x가 붙어 있습니다.

📋 목차 (Table of Contents)

공통 코드 및 설정 관리 (sysCodeHead, sysCodeItem, sysConfig, sysUnit, sysLanguage)

조직 관리 (sysCompany, sysCompanyx, sysPlant)

자재 관리 (MM) (sysMatClass, sysMatClassx, sysMatType, sysMatTypex)

사용자 및 권한/메뉴 관리 (sysUser, sysRole, sysUserRole, sysMenu, sysRoleMenu)

일정 관리 (sysSchedule, sysSchedulerDetail)

로그 관리 (sysLogLoginUser, sysLogUser)

메타데이터 사전 (Data Dictionary) (sysTable, sysFields, sysIndexFields, sysTableIndex 및 다국어, sysTableHistory)

1. 공통 코드 및 설정 관리

시스템 전반에서 사용되는 공통 코드, 다국어, 단위, 환경 설정을 관리합니다.

1.1 sysCodeHead (공통코드 헤더)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

categoryCode

varchar(45)

N

UK1



카테고리

groupCode

varchar(45)

N

UK1



그룹 코드

description

varchar(300)

Y





설명

useYn

int

Y





사용 여부

fieldNm1~10

varchar(45)

Y





코드명 1~10

createdBy / At

varchar(45) / datetime

Y





생성자 / 생성일시

changedBy / At

varchar(45) / datetime

Y





수정자 / 수정일시

1.2 sysCodeItem (공통코드 상세 항목)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

categoryCode

varchar(45)

N

UK1, IDX1



카테고리

groupCode

varchar(45)

N

UK1, IDX1



그룹 코드

subCode

varchar(45)

N

UK1



상세 코드

description

varchar(300)

Y





설명

useYn

int

Y

IDX1



사용 여부

field1~10

varchar(45)

Y





확장 필드 1~10

createdBy / At

varchar(45) / datetime(6)

Y





생성자 / 생성일시

changedBy / At

varchar(45) / datetime(6)

Y





수정자 / 수정일시

1.3 sysConfig (시스템 환경 설정)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

ID (PK)

langu

varchar(45)

N

UK1, IDX1



언어

configId

varchar(45)

N

UK1



설정 ID

configLevel

int

N





설정 레벨

ordNum

int

N





정렬 순서

configVal

varchar(45)

Y





설정 값

parentConfigId

varchar(45)

Y

IDX1



상위 설정 ID

configNm

varchar(50)

Y





설정명

useYn, 생성/수정

-

Y





시스템 공통 필드

1.4 sysUnit (단위 관리)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

unit

varchar(45)

N

UK1



단위 코드

unitNm

varchar(100)

Y





단위명

baseUnitYn

int

Y





기본 단위 여부

baseUnit

varchar(45)

Y





기본 단위 환산 기준

convRate

decimal(15,5)

Y





환산 비율

dispOrd

int

Y





표시 순서

useYn, 생성/수정

-

Y





시스템 공통 필드

1.5 sysLanguage (다국어 언어 코드)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

langu

varchar(45)

N

IDX1



언어 코드

languNm

varchar(45)

Y





언어명

생성/수정 정보

-

Y





시스템 공통 필드

2. 조직 관리

회사(법인) 및 하위 공장(Plant) 등의 조직 구조를 관리합니다.

2.1 sysCompany (회사 마스터)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

company

varchar(45)

N

UK1



회사 코드

regNo / corpNo

varchar(20)

Y





사업자번호 / 법인번호

repNm

varchar(45)

Y





대표자명

bzType / bzItem

varchar(100)

Y





업태 / 종목

zipCode / addr / addrDetail

-

Y





우편번호, 주소, 상세주소

telNo / faxNo

varchar(20)

Y





전화번호 / 팩스번호

email / currency

-

Y





이메일 / 기본 통화

useYn, 생성/수정

-

Y





시스템 공통 필드

2.2 sysCompanyx (회사 마스터 다국어)

컬럼명

데이터 타입

Null

Key

기본값

설명

langu

varchar(45)

N

UK1



언어 코드

company

varchar(45)

N

UK1



회사 코드

companyNm

varchar(45)

Y





회사명 (다국어)

id, 생성/수정

-

-





시스템 공통 필드

2.3 sysPlant (공장/사업장 관리)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

company

varchar(45)

N

UK1, UK_c



회사코드

plant

varchar(45)

N

UK1, UK_p



공장코드

regNo

varchar(20)

Y





사업자번호

telNo, 주소(zip, addr)

-

Y





연락처 및 위치 정보

useYn, 생성/수정

-

Y





시스템 공통 필드

3. 자재 관리 (MM)

자재 분류 및 유형을 관리하여 생산/물류의 기준 정보를 제공합니다.

3.1 sysMatClass & sysMatClassx (자재 분류 및 다국어)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

company

varchar(45)

N

UK1, IDX1



회사 코드

matClass

varchar(45)

N

UK1



자재 분류 코드

parentClass

varchar(45)

Y

IDX1



상위 분류 코드

classLevel

int

Y





분류 레벨

langu

varchar(45)

N

UK1(x)



[다국어] 언어 코드

matClassNm

varchar(100)

Y





[다국어] 자재 분류명

description

varchar(300)

Y





[다국어] 설명

useYn, 생성/수정

-

Y





시스템 공통 필드

3.2 sysMatType & sysMatTypex (자재 유형 및 다국어)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

company

varchar(45)

N

UK1



회사 코드

matType

varchar(45)

N

UK1



자재 유형 코드

procureType

varchar(10)

Y





조달 유형 (내자/외자 등)

priceCtrlType

varchar(10)

Y





단가 통제 유형

qtyUpdateYn / valUpdateYn

int

Y





수량/금액 업데이트 여부

langu

varchar(45)

N

UK1(x)



[다국어] 언어 코드

matTypeNm

varchar(100)

Y





[다국어] 자재 유형명

useYn, 생성/수정

-

Y





시스템 공통 필드

4. 사용자 및 권한/메뉴 관리

시스템의 접근 제어, 권한 그룹, 동적 메뉴 구성을 관리합니다.

4.1 sysUser & sysRole (사용자 및 권한 롤)

sysUser: id(PK), userId(UK) 및 생성/수정 정보

sysRole: id(PK), roleId(UK), description(설명), useYn 및 생성/수정 정보

4.2 sysUserRole (사용자-권한 매핑)

컬럼명

데이터 타입

Null

Key

기본값

설명

userId

varchar(45)

N

UK1



사용자 ID

roleId

varchar(45)

N

UK1



권한(Role) ID

id, useYn, 생성/수정

-

-

-

-

공통 필드

4.3 sysMenu (메뉴 구조화)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

langu

varchar(45)

N

UK1, IDX1,2



다국어 언어 코드

menuId

varchar(45)

N

UK1



메뉴 ID

menuLevel

int

N

IDX2



메뉴 레벨 (Depth)

ordNum

int

N

IDX1,2



정렬 순서

menuNm

varchar(45)

Y





메뉴명

parentMenuId

varchar(45)

Y

IDX1



상위 메뉴 ID

path

varchar(255)

Y





라우팅 경로 / URL

description, useYn, 공통

-

Y





설명, 사용여부 등

4.4 sysRoleMenu (권한별 접근 메뉴 매핑)

컬럼명

데이터 타입

Null

Key

기본값

설명

roleId

varchar(45)

N

UK1



권한(Role) ID

menuId

varchar(45)

N

UK1



메뉴 ID

id, useYn, 생성/수정

-

-

-

-

공통 필드

5. 일정 관리

스케줄링, 학습, 업무 진행 이력 등을 통합 관리하는 캘린더/스케줄 테이블입니다.

5.1 sysSchedule (일정 마스터)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

schGroupCode

varchar(45)

N





일정그룹 (SGR001:업무, SGR002:학습)

userId

varchar(45)

N





사용자 ID

schYear / schMonth

varchar(4)/(2)

N





일정 연도 / 월

schDate

date

N





일정 일

schCode

varchar(45)

Y





일정 코드

useYn, 생성/수정

-

-





사용여부 (기본 1) 및 공통

5.2 sysSchedulerDetail (일정 상세 내역)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

scheduleId

bigint

N

IDX1



부모 일정 ID (FK 역할)

schGroup/Year/Month/Date

-

N

IDX1



스케줄 분류 및 일자

schWeek

int

Y





주차 구분

code1 / code2 / code3

varchar

Y





분류, 구분 코드 데이터

title / subtitle

varchar/text

Y





제목 / 하위 제목

content

text

Y





상세 내용

reqUser / mgrUser

varchar(45)

Y





요청자 / 담당자

startTime / endTime

datetime(6)

Y





시작/종료(완료) 시간

totalQty / passQty / score

int

Y



0

수량/점수/성취도 통계

useYn, 생성/수정

-

-

-

-

공통 필드

6. 로그 관리

사용자 접속 이력 및 활동(Transaction) 이력을 적재합니다.

6.1 sysLogLoginUser (로그인 이력)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

loginDt

date

N

IDX1



로그인 일자

userId

varchar(45)

N

IDX1,2,3



사용자 ID

loginAt

datetime(6)

N

IDX1,2



로그인 일시

logged

text

Y





로그 내용 (IP 등 환경정보 예상)

authorize

varchar(255)

N

IDX3



인증값 (Token 등)

생성/수정 정보

-

Y





공통 필드

6.2 sysLogUser (사용자 활동 로그)

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

일련번호

logDt

date

N

IDX1



로그 일자

userId

varchar(45)

N

IDX1,2,3



사용자 ID

logAt

datetime(6)

N

IDX1,2,3



로그 일시

menuId

varchar(50)

N

IDX3



접근 메뉴 ID

request

varchar(50)

Y





요청 유형 (GET, POST 등)

params

varchar(255)

Y





요청 파라미터

logged

text

Y





상세 로그 내용

생성/수정 정보

-

Y





공통 필드

7. 메타데이터 사전 (Data Dictionary)

동적 화면 구성, 쿼리 생성, 시스템 확장을 위해 DB 스키마 자체를 관리하는 코어 테이블들입니다.
(해당 그룹은 테이블 마스터, 컬럼(Fields), 인덱스를 다국어(x)와 함께 체계적으로 관리합니다.)

7.1 메타데이터 마스터 테이블 목록

sysTable & sysTablex: 테이블 물리명(tablen), 모듈(module), 논리명(tableNm) 등 관리.

sysFields & sysFieldsx: 테이블 내 필드(컬럼) 정보 관리.

주요 속성: tablen, fieldn, fieldType, fieldLength, isNull, isUnique, isAutoIncrement, fieldOrder

sysTableIndex & sysTableIndexx: 인덱스 정보 및 Unique 여부 관리.

sysIndexFields & sysIndexFieldsx: 특정 인덱스에 포함된 컬럼 순서(fieldOrder), 정렬 방식(orderType) 매핑.

7.2 sysTableHistory (메타데이터 변경 이력)

스키마 메타데이터의 변경(DDL 반영 등)을 추적하기 위한 히스토리 테이블입니다.

컬럼명

데이터 타입

Null

Key

기본값

설명

id

bigint

N

PK

AUTO_INC

이력 일련번호

targetType

varchar(20)

N

IDX1



메타 유형 (TABLE, FIELD, INDEX 등)

tablen

varchar(45)

N

IDX1



대상 테이블 물리명

targetName

varchar(45)

Y

IDX2



상세 대상명 (필드명/인덱스명)

actionType

varchar(10)

N





작업 유형 (INSERT, UPDATE, DELETE)

targetColumn

varchar(45)

Y





변경된 속성명

beforeValue / afterValue

text

Y





변경 전/후 데이터

before(At) / after(At)

datetime(6)

Y





변경 전/후의 대상 데이터 생성/수정일

isApplied

int

Y





실제 DB 반영 여부

createdBy / createdAt

-

-

IDX3



이력 작성자 및 일시 (작업 일시)

changedBy / changedAt

-

-





이력 수정자 및 일시