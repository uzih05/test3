# VectorSurfer-Plus Feature Specification

> 프론트엔드 리디자인을 위한 전체 기능 명세서.
> 백엔드 API 스키마 + 프론트엔드 전용 로직을 모두 포함한다.
> 디자인을 새로 짤 때 이 문서만 보고 작업할 수 있어야 한다.

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [인증 시스템](#2-인증-시스템)
3. [프로젝트(연결) 관리](#3-프로젝트연결-관리)
4. [대시보드](#4-대시보드)
5. [실행 로그 (Executions)](#5-실행-로그-executions)
6. [트레이스 (Traces)](#6-트레이스-traces)
7. [함수 관리 (Functions)](#7-함수-관리-functions)
8. [에러 분석 (Errors)](#8-에러-분석-errors)
9. [AI 힐러 (Healer)](#9-ai-힐러-healer)
10. [캐시 분석 (Cache)](#10-캐시-분석-cache)
11. [골든 데이터셋 (Golden)](#11-골든-데이터셋-golden)
12. [GitHub 연동](#12-github-연동)
13. [설정 (Settings)](#13-설정-settings)
14. [글로벌 레이아웃 & 네비게이션](#14-글로벌-레이아웃--네비게이션)
15. [프론트엔드 전용 기능](#15-프론트엔드-전용-기능)
16. [상태 관리](#16-상태-관리)
17. [라이브러리 스택](#17-라이브러리-스택)
18. [주요 TypeScript 타입](#18-주요-typescript-타입)

---

## 1. 아키텍처 개요

- **프레임워크**: Next.js (App Router) + FastAPI 백엔드
- **인증**: JWT Bearer Token
- **DB**: PostgreSQL (사용자/연결/위젯 정보) + Weaviate (벡터 데이터)
- **BYOD**: 사용자가 자신의 Weaviate 인스턴스를 연결하는 멀티테넌트 구조
- **AI 기능**: OpenAI API (사용자 또는 연결별 키)
- **API 프리픽스**: `/api/v1`

### 전체 플로우

```
로그인/회원가입 → 프로젝트(Weaviate 연결) 선택 → 대시보드 진입
                                                    ↓
                              Executions / Traces / Functions / Errors
                              Cache / Golden / Healer / GitHub / Settings
```

---

## 2. 인증 시스템

### 2-1. 회원가입 페이지 (`/signup`)

**API**: `POST /api/v1/auth/signup`

**사용자 입력**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | O | 이메일 주소 |
| password | string | O | 비밀번호 |
| display_name | string | X | 표시 이름 (미입력 시 이메일 앞부분) |

**응답 데이터**:
```json
{
  "access_token": "eyJhbG...",     // JWT 토큰
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "user"
  }
}
```

**로컬 상태**:
```typescript
email: string
password: string
displayName: string
isLoading: boolean      // useAuthStore
error: string | null    // useAuthStore
```

**UI 동작**:
- 성공 → 토큰 저장 (`localStorage['vs_token']`) → `/projects`로 이동
- 이메일 중복 → 409 에러 메시지 표시
- 로그인 페이지로 이동하는 링크 제공

---

### 2-2. 로그인 페이지 (`/login`)

**API**: `POST /api/v1/auth/login`

**사용자 입력**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | O | 이메일 |
| password | string | O | 비밀번호 |

**응답 데이터**: 회원가입과 동일한 구조

**로컬 상태**:
```typescript
email: string
password: string
isLoading: boolean      // useAuthStore
error: string | null    // useAuthStore
```

**UI 동작**:
- 성공 → 토큰 저장 → `/projects`로 이동
- 실패 → 401 에러 메시지
- 회원가입 페이지로 이동하는 링크 제공

---

### 2-3. 인증 보호 (AuthGuard)

**라우팅 규칙**:
- 미인증 + 보호 페이지 → `/login` 리다이렉트
- 인증됨 + `/login` or `/signup` → `/projects` 리다이렉트
- 인증됨 + 프로젝트 미선택 + 대시보드 페이지 → `/projects` 리다이렉트

**풀스크린 페이지** (사이드바/헤더 없음): `/login`, `/signup`, `/projects`
**대시보드 페이지** (사이드바/헤더 포함): 나머지 전부

**사용자 정보 조회**: `GET /api/v1/auth/me`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "user",
  "created_at": "2026-02-15T10:00:00+00:00",
  "has_openai_key": true  // OpenAI 키 설정 여부
}
```

---

## 3. 프로젝트(연결) 관리

### 3-1. 프로젝트 선택 페이지 (`/projects`)

로그인 후 반드시 거쳐야 하는 페이지. Weaviate 연결을 선택/생성한다.

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/connections` | 저장된 연결 목록 조회 |
| `POST /api/v1/connections` | 새 연결 생성 |
| `POST /api/v1/connections/{id}/activate` | 연결 활성화 |
| `POST /api/v1/connections/test` | 연결 테스트 |

**연결 목록 응답** (`GET /api/v1/connections`):
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "My Weaviate",
      "connection_type": "self_hosted",  // "self_hosted" | "wcs_cloud"
      "host": "localhost",
      "port": 8080,
      "grpc_port": 50051,
      "api_key": "***",       // 마스킹됨 (null이면 미설정)
      "is_active": true,      // 현재 활성 연결
      "vectorizer_type": "openai",    // "openai" | "huggingface" | null
      "vectorizer_model": "text-embedding-3-small",
      "created_at": "2026-02-15T10:00:00+00:00",
      "has_openai_key": true
    }
  ],
  "total": 1
}
```

**새 연결 생성** (`POST /api/v1/connections`):
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| name | string | "Default" | 연결 이름 |
| connection_type | string | "self_hosted" | "self_hosted" or "wcs_cloud" |
| host | string | "localhost" | 호스트 주소 |
| port | int | 8080 | HTTP 포트 |
| grpc_port | int | 50051 | gRPC 포트 |
| api_key | string? | null | Weaviate API 키 |
| vectorizer_type | string? | null | "openai" or "huggingface" (wcs_cloud 필수) |
| vectorizer_model | string? | null | 벡터화기 모델명 |

**UI 동작**:
- 연결 목록 카드 형태로 표시 (활성 연결 강조)
- "새 연결 추가" 폼 (connection_type에 따라 필드 동적 변경)
- 연결 테스트 버튼 → 성공/실패 표시
- 연결 선택 → activate API → `sessionStorage['project_selected'] = 'true'` → `/` 이동
- QuickStartGuide 컴포넌트: 연결이 없을 때 가이드 표시

**로컬 상태**:
```typescript
connections: WeaviateConnection[]
showForm: boolean
formType: 'self_hosted' | 'wcs_cloud'
formName: string
formHost: string
formPort: string
formGrpcPort: string
formApiKey: string
testing: boolean
testResult: { success: boolean; message: string } | null
```

---

## 4. 대시보드

### 4-1. 메인 대시보드 (`/`)

커스터마이징 가능한 위젯 기반 대시보드.

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/widgets` | 사용자의 핀된 위젯 목록 |
| `GET /api/v1/widgets/catalog` | 사용 가능한 위젯 카탈로그 |
| `POST /api/v1/widgets` | 위젯 추가 |
| `DELETE /api/v1/widgets/{id}` | 위젯 제거 |
| `PUT /api/v1/widgets/reorder` | 위젯 순서 변경 |
| `PUT /api/v1/widgets/{id}` | 위젯 크기 변경 |
| `GET /api/v1/analytics/kpi` | KPI 메트릭 |
| `GET /api/v1/analytics/tokens` | 토큰 사용량 |
| `GET /api/v1/analytics/status` | 시스템 상태 |
| `GET /api/v1/analytics/timeline` | 실행 타임라인 |
| `GET /api/v1/analytics/distribution/functions` | 함수 분포 |
| `GET /api/v1/analytics/distribution/errors` | 에러 분포 |
| `GET /api/v1/executions/recent-errors` | 최근 에러 |

### 4-2. 위젯 시스템

**위젯 카탈로그** (`GET /api/v1/widgets/catalog`):
```json
{
  "items": [
    { "type": "token_usage", "name": "Token Usage", "sizes": ["S","M","L"], "default_size": "M" },
    { "type": "cache_hit", "name": "Cache Hit Rate", "sizes": ["S","M","L"], "default_size": "S" },
    { "type": "error_rate", "name": "Error Rate", "sizes": ["S","M","L"], "default_size": "S" },
    { "type": "execution_timeline", "name": "Execution Timeline", "sizes": ["M","L"], "default_size": "L" },
    { "type": "function_distribution", "name": "Function Distribution", "sizes": ["M","L"], "default_size": "M" },
    { "type": "recent_errors", "name": "Recent Errors", "sizes": ["M","L"], "default_size": "M" },
    { "type": "system_status", "name": "System Status", "sizes": ["S","M"], "default_size": "S" },
    { "type": "kpi_overview", "name": "KPI Overview", "sizes": ["M","L"], "default_size": "L" }
  ]
}
```

**사용자 위젯 목록** (`GET /api/v1/widgets`):
```json
{
  "items": [
    { "id": "uuid", "widget_type": "kpi_overview", "position_order": 0, "size": "L" },
    { "id": "uuid", "widget_type": "execution_timeline", "position_order": 1, "size": "L" }
  ]
}
```

### 4-3. 각 위젯별 데이터

#### KPI Overview
**API**: `GET /api/v1/analytics/kpi?range={minutes}`
```json
{
  "total_executions": 1234,
  "success_count": 1100,
  "error_count": 34,
  "cache_hit_count": 100,
  "success_rate": 89.15,        // 백분율
  "avg_duration_ms": 245.67,
  "time_range_minutes": 60
}
```
**UI**: 숫자 카드들 — 총 실행, 성공률, 에러 수, 캐시 히트율, 평균 소요 시간

#### Token Usage
**API**: `GET /api/v1/analytics/tokens`
```json
{
  "total_tokens": 50000,
  "by_category": {
    "healer": 20000,
    "function_ask": 15000,
    "trace_analyze": 10000,
    "error_search": 5000
  }
}
```
**UI**: 도넛/파이 차트 또는 숫자 표시

#### Cache Hit Rate
**API**: `GET /api/v1/analytics/kpi` (cache_hit_count / total_executions)
**UI**: 퍼센트 수치 + 게이지/링 차트

#### Error Rate
**API**: `GET /api/v1/analytics/kpi` (error_count / total_executions)
**UI**: 퍼센트 수치 + 색상 인디케이터 (높으면 빨강)

#### Execution Timeline
**API**: `GET /api/v1/analytics/timeline?range={minutes}&bucket={minutes}`
```json
[
  {
    "timestamp": "2026-02-15T10:00:00+00:00",
    "success": 10,
    "error": 2,
    "cache_hit": 5
  }
]
```
**UI**: 영역/선 차트 — X축: 시간, Y축: 실행 수 (success/error/cache_hit 구분)
**데이터 가공**: timestamp → 로케일 시간 포맷, value = success + error + cache_hit

#### Function Distribution
**API**: `GET /api/v1/analytics/distribution/functions?limit=10`
```json
[
  { "function_name": "process_order", "count": 500, "percentage": 45.5 }
]
```
**UI**: 가로 막대 차트 — 함수별 실행 비율

#### Recent Errors
**API**: `GET /api/v1/executions/recent-errors?minutes={minutes}&limit=20`
```json
{
  "items": [
    {
      "span_id": "uuid",
      "function_name": "process_order",
      "error_code": "TIMEOUT",
      "error_message": "Connection timed out",
      "timestamp_utc": "2026-02-15T10:30:00+00:00",
      "duration_ms": 5000.0
    }
  ]
}
```
**UI**: 에러 리스트 — 함수명, 에러코드, 시간, 메시지

#### System Status
**API**: `GET /api/v1/analytics/status`
```json
{
  "db_connected": true,
  "registered_functions_count": 25,
  "last_checked": "2026-02-15T10:30:00+00:00"
}
```
**UI**: 상태 인디케이터 (초록/빨강) + 함수 수 + 마지막 체크 시간

### 4-4. 위젯 조작

- **추가**: WidgetPicker 모달 → 카탈로그에서 선택 → `POST /api/v1/widgets`
- **제거**: 위젯 X 버튼 → `DELETE /api/v1/widgets/{id}`
- **크기 변경**: S/M/L 선택 → `PUT /api/v1/widgets/{id}`
- **순서 변경**: 드래그 앤 드롭 → `PUT /api/v1/widgets/reorder`
- **레이아웃 계산**: `computeLayout()` — 위젯 size(S=1칸, M=2칸, L=4칸)에 따라 그리드 배치

**로컬 상태**:
```typescript
isEditing: boolean          // 편집 모드 (드래그/삭제 활성)
showPicker: boolean         // 위젯 추가 모달
timeRangeMinutes: number    // useDashboardStore에서 가져옴
fillMode: string            // useDashboardStore에서 가져옴
```

**인터랙션**:
- 위젯 드래그 앤 드롭 → `reorderWidgets.mutate(newOrder)`
- 위젯 크기 S/M/L 변경 → `updateWidget.mutate()`
- 위젯 X 버튼 → `removeWidget.mutate()`
- `+` 버튼 → WidgetPicker 모달 → `addWidget.mutate()`
- 새로고침 → `queryClient.invalidateQueries()`
- TimeRangeSelector 변경 → 모든 위젯 자동 refetch

**데이터 가공**:
- 타임라인: `timestamp` → 로케일 시간 포맷, `value = success + error + cache_hit`
- 에러 분포: 상위 5개 + 동적 색상 `hsl(index * 50, 70%, 50%)`
- 함수 분포: `maxCount` 기준 백분율 계산

---

## 5. 실행 로그 (Executions)

### 5-1. 실행 목록 페이지 (`/executions`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/executions` | 실행 로그 목록 (필터/페이지네이션) |
| `GET /api/v1/executions/{span_id}` | 실행 상세 조회 |
| `GET /api/v1/executions/slowest` | 가장 느린 실행 |

**실행 목록** (`GET /api/v1/executions`):

Query 파라미터:
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| limit | int | 50 | 최대 500 |
| offset | int | 0 | 페이지네이션 |
| status | string? | - | "SUCCESS", "ERROR", "CACHE_HIT" |
| function_name | string? | - | 함수명 필터 |
| team | string? | - | 팀 필터 |
| error_code | string? | - | 에러 코드 필터 |
| time_range | int? | - | 분 단위 |
| sort_by | string | "timestamp_utc" | 정렬 기준 |
| sort_asc | bool | false | 오름차순 |

응답:
```json
{
  "items": [
    {
      "span_id": "uuid",
      "trace_id": "uuid",
      "function_name": "process_order",
      "status": "SUCCESS",           // "SUCCESS" | "ERROR" | "CACHE_HIT"
      "duration_ms": 245.67,
      "timestamp_utc": "2026-02-15T10:30:00+00:00",
      "error_code": null,            // 에러 시에만 존재
      "error_message": null,
      "return_value": { ... },       // 반환값 (있을 때)
      "team": "backend"
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

**UI 구성**:
- **상단**: Slowest Executions 섹션 (접기/펼치기 가능)
- **필터 바**: 검색(함수명), 상태 필터 (All/Success/Error/Cache Hit), 팀 필터
- **테이블**: span_id, 함수명, 상태(배지), 소요시간, 타임스탬프, 에러코드
- **페이지네이션**: offset 기반, 이전/다음 버튼
- **행 클릭**: 실행 상세 모달 열기

**가장 느린 실행** (`GET /api/v1/executions/slowest`):
```json
{
  "items": [
    {
      "span_id": "uuid",
      "function_name": "heavy_query",
      "duration_ms": 15000.0,
      "status": "SUCCESS",
      "timestamp_utc": "2026-02-15T10:00:00+00:00"
    }
  ],
  "total": 10
}
```
**UI**: 카드/리스트 — 함수명, 소요시간 강조, 상태 배지

**로컬 상태**:
```typescript
page: number                // 현재 페이지
searchQuery: string         // 함수명 검색
statusFilter: string        // "SUCCESS" | "ERROR" | "CACHE_HIT" | ""
teamFilter: string          // 팀 필터
selectedSpan: string | null // 상세 모달용 span_id
```

**인터랙션**:
- 검색 입력 → 실시간 필터링 → `setPage(0)` 리셋
- 상태 필터 탭 클릭 → API 재호출
- 팀 필터 드롭다운 → API 재호출
- 테이블 행 클릭 → 상세 모달 열기
- "View Trace" 버튼 → `/traces/{traceId}` 이동
- URL 파라미터: `?function_name=xxx`로 초기 필터 설정 가능
- 페이지네이션: 이전/다음 버튼 (offset 기반, 페이지 크기 20)

### 5-2. 실행 상세 모달

**API**: `GET /api/v1/executions/{span_id}`

**UI**: 모달로 전체 실행 데이터 표시
- span_id, trace_id (→ trace 페이지 링크)
- 함수명, 상태, 소요시간
- 에러 정보 (있을 때)
- 반환값 (JSON 뷰어)
- 타임스탬프, 팀

---

## 6. 트레이스 (Traces)

### 6-1. 트레이스 목록 (`/traces`)

**API**: `GET /api/v1/traces?limit=20`

```json
[
  {
    "trace_id": "uuid",
    "root_function": "handle_request",
    "start_time": "2026-02-15T10:00:00+00:00",
    "total_duration_ms": 1500.0,
    "span_count": 5,
    "status": "SUCCESS"     // "SUCCESS" | "ERROR" | "PARTIAL"
  }
]
```

**UI**: 테이블/카드 — trace_id, 루트 함수, 시작 시간, 총 소요시간, span 수, 상태
- 행 클릭 → `/traces/{trace_id}` 이동

**로컬 상태**:
```typescript
limit: number            // 20 | 50 | 100
statusFilter: string     // "SUCCESS" | "ERROR" | "PARTIAL" | ""
searchQuery: string      // 함수명 검색
```

### 6-2. 트레이스 상세 (`/traces/[id]`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/traces/{trace_id}` | 트레이스 전체 span 목록 |
| `GET /api/v1/traces/{trace_id}/tree` | 트리 구조 |
| `GET /api/v1/traces/{trace_id}/analyze` | AI 분석 |

**트레이스 상세** (`GET /api/v1/traces/{trace_id}`):
```json
{
  "trace_id": "uuid",
  "spans": [
    {
      "span_id": "uuid",
      "parent_span_id": "uuid" | null,    // null이면 루트 span
      "function_name": "handle_request",
      "status": "SUCCESS",
      "duration_ms": 1500.0,
      "timestamp_utc": "2026-02-15T10:00:00+00:00",
      "error_code": null,
      "error_message": null,
      "attributes": { "key": "value" }
    }
  ],
  "span_count": 5,
  "total_duration_ms": 1500.0,
  "start_time": "2026-02-15T10:00:00+00:00",
  "status": "SUCCESS"
}
```

**트리 구조** (`GET /api/v1/traces/{trace_id}/tree`):
```json
{
  "trace_id": "uuid",
  "tree": [
    {
      "span_id": "uuid",
      "function_name": "handle_request",
      "status": "SUCCESS",
      "duration_ms": 1500.0,
      "children": [
        {
          "span_id": "uuid",
          "function_name": "validate_input",
          "duration_ms": 50.0,
          "children": []
        },
        {
          "span_id": "uuid",
          "function_name": "process_data",
          "duration_ms": 1400.0,
          "children": [...]
        }
      ]
    }
  ],
  "total_duration_ms": 1500.0,
  "status": "SUCCESS"
}
```

**AI 분석** (`GET /api/v1/traces/{trace_id}/analyze?language=ko`):
```json
{
  "trace_id": "uuid",
  "analysis": "이 트레이스는 handle_request에서 시작하여...",
  "language": "ko"
}
```

**UI 구성**:
- **트리 뷰**: 계층적 span 구조, 들여쓰기로 부모-자식 관계 표현
- **각 span**: 함수명, 상태 배지, 소요시간 바, 타임스탬프
- **워터폴 차트** (선택): 시간 기반 span 시각화
- **AI 분석 버튼**: 클릭 → 분석 결과 표시 (OpenAI 키 필요)
- **언어 선택**: en/ko

**로컬 상태**:
```typescript
viewMode: 'waterfall' | 'tree'
language: 'en' | 'ko'
```

**워터폴 뷰 상세**:
- 각 span을 가로 막대로 표시, 부모 시작시간 기준 상대 위치
- 막대 색상: 초록(성공), 빨강(에러), 파랑(캐시 히트)
- 클릭 → `/executions?function_name=xxx`

---

## 7. 함수 관리 (Functions)

### 7-1. 함수 목록 페이지 (`/functions`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/functions` | 전체 함수 목록 |
| `GET /api/v1/functions/search` | 시맨틱 검색 |
| `GET /api/v1/functions/search/hybrid` | 하이브리드 검색 |
| `GET /api/v1/functions/ask` | AI QnA |
| `GET /api/v1/functions/{name}` | 함수 상세 |
| `GET /api/v1/functions/by-team/{team}` | 팀별 함수 |

**함수 목록** (`GET /api/v1/functions`):
```json
{
  "items": [
    {
      "function_name": "process_order",
      "module": "app.services.order",
      "file_path": "/app/services/order.py",
      "description": "Process incoming order",
      "docstring": "Process an order and return result...",
      "source_code": "def process_order(data):\n    ...",
      "team": "backend",
      "execution_count": 500,
      "avg_duration_ms": 245.67,
      "error_rate": 2.5           // 백분율
    }
  ],
  "total": 25
}
```

**시맨틱 검색** (`GET /api/v1/functions/search?q=주문처리&limit=10`):
- 자연어 질의로 유사한 함수 검색
- OpenAI 임베딩 사용 (키 필요)

**하이브리드 검색** (`GET /api/v1/functions/search/hybrid?q=order&alpha=0.5`):
- alpha=0: 키워드만, alpha=1: 벡터만, 0.5: 반반

**AI QnA** (`GET /api/v1/functions/ask?q=이 함수는 무슨 일을 하나요?&language=ko`):
```json
{
  "query": "이 함수는 무슨 일을 하나요?",
  "answer": "이 함수는 주문 데이터를 받아서...",
  "language": "ko"
}
```

**UI 구성**:
- **검색 바**: 키워드/시맨틱/하이브리드 모드 전환
- **팀 필터**: 팀별 필터링
- **함수 카드/리스트**: 함수명, 모듈, 설명, 실행 횟수, 평균 소요시간, 에러율
- **함수 상세**: 소스코드 뷰어, docstring, 실행 통계
- **AI QnA 섹션**: 질문 입력 → 답변 표시
- **트리 뷰**: 모듈/파일 경로 기반 트리 구조로 표시
  - `file_path` 또는 `module`을 `/`로 분할 → 트리 구조 생성
  - 각 디렉토리 노드: 함수 수, 총 실행 수, 평균 에러율

**로컬 상태**:
```typescript
searchQuery: string
searchMode: 'semantic' | 'hybrid'
alpha: number               // 0~1, 하이브리드 검색 비율
teamFilter: string
selectedFunction: FunctionInfo | null   // 상세 모달
viewMode: 'grid' | 'tree'
sortBy: 'execution_count' | 'error_rate' | 'avg_duration_ms' | 'name'
```

**인터랙션**:
- 검색 모드 토글 (시맨틱 ↔ 하이브리드)
- 하이브리드 모드: alpha 슬라이더 (0%=키워드 ~ 100%=벡터)
- 정렬: 실행 수 | 에러율 | 평균 소요시간 | 이름
- 뷰 모드 토글: 그리드 ↔ 트리
- 카드/노드 클릭 → 상세 모달 (소스코드, docstring, 통계)
- 상세 모달: "View Executions" → `/executions?function_name=xxx`
- 상세 모달: "View Errors" → `/errors?function_name=xxx`

---

## 8. 에러 분석 (Errors)

### 8-1. 에러 목록 페이지 (`/errors`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/errors` | 에러 목록 (필터) |
| `GET /api/v1/errors/search` | 시맨틱 에러 검색 |
| `GET /api/v1/errors/summary` | 에러 요약 통계 |
| `GET /api/v1/errors/trends` | 에러 추세 |

**에러 목록** (`GET /api/v1/errors`):

Query 파라미터:
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| limit | int | 50 | 최대 500 |
| function_name | string? | - | 함수명 필터 |
| error_code | string? | - | 에러 코드 필터 |
| team | string? | - | 팀 필터 |
| time_range | int? | - | 분 단위 |

```json
{
  "items": [
    {
      "span_id": "uuid",
      "function_name": "process_order",
      "status": "ERROR",
      "error_code": "TIMEOUT",
      "error_message": "Connection timed out after 30s",
      "duration_ms": 30000.0,
      "timestamp_utc": "2026-02-15T10:30:00+00:00",
      "team": "backend"
    }
  ],
  "total": 34,
  "filters_applied": {
    "function_name": null,
    "error_code": "TIMEOUT",
    "team": null,
    "time_range_minutes": 1440
  }
}
```

**에러 요약** (`GET /api/v1/errors/summary?time_range=1440`):
```json
{
  "total_errors": 34,
  "unique_error_codes": 5,
  "most_common_errors": [
    { "error_code": "TIMEOUT", "count": 15, "percentage": 44.1 },
    { "error_code": "NULL_POINTER", "count": 8, "percentage": 23.5 }
  ],
  "time_range_minutes": 1440
}
```

**에러 추세** (`GET /api/v1/errors/trends?time_range=1440&bucket=60`):
```json
[
  {
    "timestamp": "2026-02-15T10:00:00+00:00",
    "error_count": 5,
    "unique_error_codes": 2
  }
]
```

**시맨틱 검색** (`GET /api/v1/errors/search?q=타임아웃 에러`):
- 에러 메시지를 벡터 유사도로 검색

**UI 구성**:
- **상단 요약 카드**: 총 에러 수, 고유 에러 코드 수, 가장 빈번한 에러
- **추세 차트**: 시간별 에러 수 (선/영역 차트)
- **에러 분포**: 에러 코드별 비율 (파이/도넛 차트)
- **필터 바**: 함수명, 에러 코드, 팀, 시간 범위
- **에러 테이블**: 함수명, 에러 코드, 메시지, 소요시간, 타임스탬프
- **시맨틱 검색**: 자연어로 유사 에러 검색

**로컬 상태**:
```typescript
searchQuery: string
functionFilter: string
errorCodeFilter: string
```

**인터랙션**:
- URL 파라미터: `?function_name=xxx`로 초기 필터 설정 가능
- 검색 입력 → 시맨틱 검색 모드로 전환 (필터 모드와 별도)
- 에러 카드에서 "View Trace" → `/traces/{traceId}` 이동
- 추세 차트: SurferChart 사용 (fillMode 연동)

---

## 9. AI 힐러 (Healer)

### 9-1. 힐러 페이지 (`/healer`)

에러가 있는 함수를 AI가 진단하고 수정 코드를 제안.

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/healer/functions` | 진단 가능한 함수 목록 |
| `POST /api/v1/healer/diagnose` | 단일 함수 진단 |
| `POST /api/v1/healer/diagnose/batch` | 일괄 진단 |

**진단 가능 함수** (`GET /api/v1/healer/functions?time_range=1440`):
```json
{
  "items": [
    {
      "function_name": "process_order",
      "error_count": 15,
      "last_error": "2026-02-15T10:30:00+00:00",
      "error_codes": ["TIMEOUT", "NULL_POINTER"]
    }
  ],
  "total": 3
}
```

**진단 결과** (`POST /api/v1/healer/diagnose`):

Request:
```json
{
  "function_name": "process_order",
  "lookback_minutes": 60
}
```

Response:
```json
{
  "function_name": "process_order",
  "diagnosis": "이 함수에서 TIMEOUT 에러가 반복 발생하고 있습니다. DB 연결 풀이...",
  "suggested_fix": "def process_order(data):\n    try:\n        ...",  // 수정된 소스코드
  "lookback_minutes": 60,
  "status": "success"     // "success" | "error" | "no_errors"
}
```

**UI 구성**:
- **함수 목록**: 에러 있는 함수들, 에러 수/마지막 에러 시간/에러 코드 표시
- **진단 버튼**: 클릭 → AI 분석 로딩 → 결과 표시
- **진단 결과**: diagnosis (마크다운), suggested_fix (코드 뷰어 + diff)
- **일괄 진단**: 여러 함수 선택 → 한번에 진단
- **OpenAI 키 필요 경고**: 키 없으면 사용 불가 안내

**로컬 상태**:
```typescript
mode: 'single' | 'batch'
functionFilter: string
timeRangeFilter: number          // 60 | 180 | 360 | 720 | 1440 | 4320 | 10080 | 0(all)
errorCodeFilter: string
selectedFunction: string | null  // single 모드용
lookback: number                 // 5~1440 분
diagnosis: DiagnosisResult | null
checkedFunctions: Set<string>    // batch 모드용
batchResult: BatchResult | null
```

**인터랙션**:
- 모드 전환: Single ↔ Batch (헤더 토글)
- Single: 좌측 리스트에서 함수 클릭 → 우측 패널에 선택됨 → "Diagnose & Heal" → 결과
- Batch: 좌측 리스트에서 체크박스 → "Select All" 가능 → "Batch Diagnose (N)" → 결과 목록
- 결과에서 "Suggested Fix" → 코드 블록 + 복사 버튼
- Batch 결과: 진행률 바 + 클릭하면 개별 결과 확장/축소
- 좌측 필터: 함수명 검색, 시간 범위, 에러 코드

---

## 10. 캐시 분석 (Cache)

### 10-1. 캐시 페이지 (`/cache`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/cache/analytics` | 캐시 히트율/절감 등 |
| `GET /api/v1/cache/drift/summary` | 드리프트 요약 |
| `POST /api/v1/cache/drift/simulate` | 드리프트 시뮬레이션 |

**캐시 분석** (`GET /api/v1/cache/analytics?range=60`):
```json
{
  "total_executions": 1000,
  "cache_hit_count": 200,
  "cache_hit_rate": 20.0,
  "golden_hit_count": 50,
  "standard_hit_count": 150,
  "golden_ratio": 25.0,
  "time_saved_ms": 45000.0,
  "avg_cached_duration_ms": 225.0,
  "time_range_minutes": 60,
  "has_data": true
}
```

**드리프트 요약** (`GET /api/v1/cache/drift/summary`):
```json
{
  "items": [
    {
      "function_name": "process_order",
      "status": "ANOMALY",          // "ANOMALY" | "NORMAL" | "INSUFFICIENT_DATA" | "NO_VECTOR"
      "avg_distance": 0.45,
      "sample_count": 100,
      "threshold": 0.3
    }
  ],
  "total": 5
}
```

**드리프트 시뮬레이션** (`POST /api/v1/cache/drift/simulate`):

Request:
```json
{
  "text": "주문 데이터 처리",
  "function_name": "process_order",
  "threshold": 0.3,
  "k": 5
}
```

Response:
```json
{
  "is_drift": true,
  "avg_distance": 0.45,
  "function_name": "process_order",
  "threshold": 0.3,
  "neighbors": [
    {
      "span_id": "uuid",
      "distance": 0.42,
      "return_value": { ... },
      "timestamp_utc": "2026-02-15T10:00:00+00:00"
    }
  ]
}
```

**UI 구성**:
- **캐시 통계 카드**: 히트율, 골든/표준 비율, 절감 시간, 총 실행 수
- **드리프트 테이블**: 함수별 드리프트 상태, 평균 거리, 임계값
  - ANOMALY → 빨간색, NORMAL → 초록색, INSUFFICIENT_DATA → 회색
- **드리프트 시뮬레이터**: 텍스트 입력 + 함수 선택 → 시뮬레이션 결과
- **시간 범위 선택**: TimeRangeSelector 연동

**로컬 상태**:
```typescript
activeTab: 'analytics' | 'drift'
simFn: string           // 시뮬레이션 함수명
simText: string         // 시뮬레이션 입력 텍스트
simResult: DriftResult | null
```

**인터랙션**:
- 탭 전환: Analytics ↔ Drift
- 드리프트 시뮬레이터: 함수 선택 + 텍스트 입력 → "Simulate" → 결과 표시
- 드리프트 상태 색상: NORMAL(초록), ANOMALY(빨강), INSUFFICIENT_DATA(노랑), NO_VECTOR(회색)

---

## 11. 골든 데이터셋 (Golden)

### 11-1. 골든 페이지 (`/golden`)

참조 데이터셋 관리. 품질 좋은 실행 결과를 "골든"으로 등록해서 캐시 품질 향상.

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/cache/golden` | 골든 데이터 목록 |
| `POST /api/v1/cache/golden` | 골든 등록 |
| `DELETE /api/v1/cache/golden/{uuid}` | 골든 삭제 |
| `GET /api/v1/cache/golden/recommend/{fn}` | 추천 후보 |
| `GET /api/v1/cache/golden/stats` | 골든 통계 |

**골든 목록** (`GET /api/v1/cache/golden?function_name=process_order&limit=50`):
```json
{
  "items": [
    {
      "uuid": "uuid",
      "execution_uuid": "uuid",
      "function_name": "process_order",
      "note": "정상 케이스 대표 샘플",
      "tags": ["production", "stable"],
      "created_at": "2026-02-15T10:00:00+00:00"
    }
  ],
  "total": 10
}
```

**골든 등록** (`POST /api/v1/cache/golden`):

Request:
```json
{
  "execution_uuid": "uuid",
  "note": "정상 케이스 대표 샘플",
  "tags": ["production", "stable"]
}
```

Response:
```json
{
  "status": "registered",
  "uuid": "uuid",
  "function_name": "process_order"
}
```

**추천 후보** (`GET /api/v1/cache/golden/recommend/process_order?limit=5`):
```json
{
  "function_name": "process_order",
  "candidates": [
    {
      "span_id": "uuid",
      "trace_id": "uuid",
      "function_name": "process_order",
      "timestamp_utc": "2026-02-15T10:00:00+00:00",
      "duration_ms": 200.0,
      "status": "SUCCESS",
      "score": 0.95         // 추천 점수
    }
  ],
  "total": 5
}
```

**골든 통계** (`GET /api/v1/cache/golden/stats`):
```json
{
  "stats": [
    { "function_name": "process_order", "count": 5 },
    { "function_name": "validate_input", "count": 3 }
  ],
  "total": 8
}
```

**UI 구성**:
- **통계 카드**: 함수별 골든 수, 총 골든 수
- **골든 목록**: 함수명, 노트, 태그, 생성일, 삭제 버튼
- **추천 섹션**: 함수 선택 → 추천 후보 목록 → "등록" 버튼
- **등록 폼**: execution_uuid 입력 (또는 추천에서 선택), 노트, 태그
- **함수 필터**: 함수명으로 필터링

**로컬 상태**:
```typescript
selectedFunction: string | null  // null이면 함수 리스트 뷰, 있으면 상세 뷰
page: number                     // 실행 목록 페이지네이션
```

**인터랙션**:
- 함수 리스트: 검색 입력 → 필터링, 행 클릭 → 상세 뷰 진입
- 상세 뷰: 실행 테이블에서 "Register" → 골든 등록, "Golden" 배지 클릭 → 골든 해제
- 뒤로가기 → 함수 리스트로 복귀
- 골든 카운트맵: 함수명 → 골든 수 매핑

---

## 12. GitHub 연동

### 12-1. GitHub 페이지 (`/github`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/github/status` | 연결 상태 |
| `PUT /api/v1/github/token` | 토큰 저장 |
| `DELETE /api/v1/github/token` | 토큰 삭제 |
| `GET /api/v1/github/repos` | 레포 목록 |
| `GET /api/v1/github/repos/{owner}/{repo}/pulls` | PR 목록 |
| `GET /api/v1/github/repos/{owner}/{repo}/pulls/{number}` | PR 상세 |

**연결 상태** (`GET /api/v1/github/status`):
```json
{
  "connected": true,
  "username": "octocat"
}
```

**레포 목록** (`GET /api/v1/github/repos?page=1&per_page=30`):
```json
{
  "items": [
    {
      "full_name": "octocat/hello-world",
      "name": "hello-world",
      "owner": "octocat",
      "private": false,
      "description": "My first repo",
      "language": "Python",
      "updated_at": "2026-02-15T10:00:00+00:00"
    }
  ]
}
```

**PR 목록** (`GET /api/v1/github/repos/octocat/hello-world/pulls?state=all`):
```json
{
  "items": [
    {
      "number": 42,
      "title": "Add feature X",
      "state": "open",            // "open" | "closed" | "merged"
      "draft": false,
      "author": "octocat",
      "author_avatar": "https://...",
      "created_at": "2026-02-15T10:00:00+00:00",
      "updated_at": "2026-02-15T12:00:00+00:00",
      "merged_at": null,
      "labels": [
        { "name": "enhancement", "color": "84b6eb" }
      ],
      "reviewers": ["reviewer1"],
      "html_url": "https://github.com/octocat/hello-world/pull/42",
      "body": "This PR adds feature X..."   // 처음 300자
    }
  ]
}
```

**PR 상세** (`GET /api/v1/github/repos/octocat/hello-world/pulls/42`):
```json
{
  "number": 42,
  "title": "Add feature X",
  "body": "Full description...",     // 전체 본문
  "state": "open",
  "draft": false,
  "author": "octocat",
  "author_avatar": "https://...",
  "created_at": "...",
  "updated_at": "...",
  "merged_at": null,
  "changed_files": 5,
  "additions": 120,
  "deletions": 30,
  "labels": [...],
  "reviewers": [...],
  "html_url": "..."
}
```

**UI 구성**:
- **미연결 상태**: 토큰 입력 폼 + 연결 안내
- **연결됨**: 사용자명 표시, 연결 해제 버튼
- **레포 선택**: 레포 목록 (드롭다운 또는 리스트)
- **PR 목록**: 번호, 제목, 상태 배지, 작성자 아바타, 라벨, 리뷰어, 날짜
- **PR 상태 필터**: All/Open/Closed
- **PR 상세 모달/패널**: 전체 본문, 변경 파일 수, 추가/삭제 줄 수
- **페이지네이션**: page 기반

**로컬 상태**:
```typescript
selectedRepo: string         // localStorage에 저장 (세션 간 유지)
stateFilter: 'all' | 'open' | 'closed'
expandedPR: number | null    // 확장된 PR 번호
tokenInput: string
message: string              // 성공/에러 메시지
```

**인터랙션**:
- 미연결: PAT 입력 → "Connect" → `saveToken()` → 연결 상태 갱신
- 연결됨: "Disconnect" → `deleteToken()` → 토큰 삭제
- 레포 드롭다운 선택 → localStorage에 저장 → PR 목록 자동 로드
- PR 상태 필터: All/Open/Closed 탭
- PR 행 클릭 → 확장 (변경파일 수, additions/deletions, 본문)
- PR 라벨: 배경색 동적 (라벨의 color 필드 사용)
- 새로고침 버튼 → 레포/PR 목록 refetch

---

## 13. 설정 (Settings)

### 13-1. 설정 페이지 (`/settings`)

**API 호출**:
| API | 용도 |
|-----|------|
| `GET /api/v1/analytics/status` | 시스템 상태 |
| `GET /api/v1/connections` | 연결 목록 |
| `PUT /api/v1/connections/{id}` | 연결 수정 |
| `DELETE /api/v1/connections/{id}` | 연결 삭제 |
| `POST /api/v1/connections/{id}/activate` | 연결 활성화 |
| `PUT /api/v1/connections/{id}/api-key` | 연결별 OpenAI 키 저장 |
| `DELETE /api/v1/connections/{id}/api-key` | 연결별 OpenAI 키 삭제 |
| `PUT /api/v1/auth/api-key` | 글로벌 OpenAI 키 저장 |

**UI 구성 섹션**:
1. **Appearance**: 테마 선택 (Light/Dark/System)
2. **Connection Manager**: 연결 목록, 수정/삭제/활성화, 벡터화기 설정
3. **AI Settings**: 글로벌 OpenAI API 키 입력/수정/삭제
4. **Stats Overview**: 시스템 상태, DB 연결, 등록 함수 수
5. **Quick Links**: 각 기능 페이지로 바로 가기

**설정 페이지 세부 사항**:
- Connection Manager:
  - 연결 목록에서 활성 연결 강조 표시
  - 연결별 Key 아이콘 → OpenAI 키 관리 패널 열기
  - 키 입력 → `connectionsService.updateApiKey()` → 성공 메시지 3초 표시 후 패널 닫기
  - WCS Cloud 연결만 벡터화기 모델 편집 가능 (OpenAI/HuggingFace)
- AI Settings:
  - Global Fallback OpenAI 키: 모든 연결에 대한 기본 키
  - `authService.updateApiKey(key)` (key=null이면 삭제)
- Stats Overview:
  - `useFunctions()` → 등록 함수 수
  - `useTokenUsage()` → 총 토큰 사용량

---

## 14. 글로벌 레이아웃 & 네비게이션

### 14-1. 레이아웃 구조

```
풀스크린 페이지 (/login, /signup, /projects):
┌──────────────────────────┐
│        전체 화면 콘텐츠      │
└──────────────────────────┘

대시보드 페이지 (나머지 전부):
┌────────┬─────────────────┐
│        │     Header       │
│Sidebar │─────────────────│
│        │                  │
│ 128px  │   Main Content   │
│(고정)  │    (스크롤)       │
│        │                  │
└────────┴─────────────────┘

모바일:
┌──────────────────────────┐
│  Header (햄버거 메뉴)      │
├──────────────────────────┤
│                           │
│      Main Content         │
│       (스크롤)             │
│                           │
└──────────────────────────┘
+ Sidebar는 264px 드로어로 슬라이드
```

### 14-2. Sidebar 네비게이션

**아이템 목록**:
| 키 | 경로 | 아이콘 | 위치 |
|----|------|--------|------|
| overview | `/` | LayoutDashboard | 상단 |
| executions | `/executions` | Activity | 상단 |
| traces | `/traces` | GitBranch | 상단 |
| functions | `/functions` | Code2 | 상단 |
| errors | `/errors` | AlertTriangle | 상단 |
| healer | `/healer` | Sparkles | 상단 |
| cache | `/cache` | Database | 상단 |
| golden | `/golden` | Star | 상단 |
| github | `/github` | GitPullRequest | 상단 |
| projects | `/projects` | FolderOpen | 하단 |
| settings | `/settings` | Settings | 하단 |

**사용자 섹션** (사이드바 하단):
- 아바타 (display_name 첫 글자)
- 로그아웃 버튼 → 토큰 삭제 + sessionStorage 초기화 + `/login` 이동

### 14-3. Header

- **모바일**: 높이 56px, 햄버거 메뉴 버튼
- **데스크톱**: 높이 80px
- **콘텐츠**: 검색바(중앙), 테마 토글 + 언어 전환 + 사용자 아바타(우측)
- **sticky top-0**

---

## 15. 프론트엔드 전용 기능

### 15-1. 테마 시스템

- **옵션**: Light / Dark / System
- **구현**: HTML 루트에 `.dark` 클래스 토글
- **저장**: `localStorage['vectorsurfer-theme']`
- **System 모드**: `window.matchMedia('(prefers-color-scheme: dark)')` 감지

### 15-2. 다국어 (i18n)

- **지원 언어**: 한국어(ko), 영어(en), 일본어(ja)
- **번역 키**: dot notation (예: `nav.overview`, `dashboard.kpi.total`)
- **Fallback**: 해당 언어 없으면 영어 → 키 자체 반환
- **저장**: `localStorage['language']`
- **번역 파일**: `locales/ko.json`, `en.json`, `ja.json`

### 15-3. 검색바 (Command Palette)

- **트리거**: Ctrl+K (Windows) / Cmd+K (Mac)
- **기능**: 네비게이션 아이템 실시간 필터링
- **키보드**: ↑↓ 이동, Enter 선택, Escape 닫기
- **외부 클릭**: 자동 닫기

### 15-4. 시간 범위 선택기 (TimeRangeSelector)

- **프리셋**: 15분, 30분, 1시간, 3시간, 6시간, 12시간, 24시간, 3일, 7일
- **커스텀**: 시작/종료 날짜+시간 (datetime-local)
- **슬라이더**: 프리셋을 슬라이더로도 선택 가능
- **연동**: 대시보드의 모든 차트/위젯이 이 값에 반응
- **저장**: `localStorage['vectorsurfer-dashboard']`

### 15-5. 차트 스타일 선택기

- **옵션**: stroke-only (선), gradient (그라데이션), solid (채움)
- **적용 대상**: SurferChart 컴포넌트 (타임라인 등)
- **저장**: `localStorage['vectorsurfer-dashboard']`

### 15-6. 유틸리티 함수

| 함수 | 입력 | 출력 | 용도 |
|------|------|------|------|
| `formatNumber(n)` | 1000 | "1K" | 큰 숫자 축약 |
| `formatDuration(ms)` | 1500 | "1.5s" | 소요시간 표시 |
| `formatPercentage(pct)` | 85.5 | "85.5%" | 백분율 표시 |
| `timeAgo(iso)` | ISO 8601 | "2 hours ago" | 상대 시간 |
| `cn(...classes)` | 클래스들 | 병합된 문자열 | Tailwind 클래스 병합 |

---

## 16. 상태 관리

### 16-1. useAuthStore (Zustand + persist)

```typescript
{
  user: {
    id: string,
    email: string,
    display_name: string,
    created_at: string,
    has_openai_key: boolean
  } | null,
  token: string | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  error: string | null
}
```
- **저장소**: `localStorage['vectorsurfer-auth']`
- **액션**: login, signup, logout, checkAuth, setHasOpenaiKey

### 16-2. useDashboardStore (Zustand + persist)

```typescript
{
  timeRange: {
    preset: number | null,           // 15, 30, 60, 180, 360, 720, 1440, 4320, 10080
    customStart: Date | null,
    customEnd: Date | null,
    mode: 'preset' | 'custom'
  },
  timeRangeMinutes: number,          // 계산된 총 분 (API 호출에 사용)
  timeRangeLabel: string,            // UI 표시 라벨
  fillMode: 'stroke-only' | 'gradient' | 'solid'
}
```
- **저장소**: `localStorage['vectorsurfer-dashboard']`
- **Date 직렬화**: 커스텀 처리 (JSON → Date 복원)

### 16-3. useThemeStore (Zustand + persist)

```typescript
{
  theme: 'light' | 'dark' | 'system'
}
```
- **저장소**: `localStorage['vectorsurfer-theme']`

### 16-4. i18n Context

```typescript
{
  language: 'ko' | 'en' | 'ja',
  setLanguage: (lang) => void,
  t: (key: string, fallback?: string) => string
}
```
- **저장소**: `localStorage['language']`

### 16-5. 프로젝트 선택 상태

- **저장소**: `sessionStorage['project_selected']` = `'true'`
- **세션 범위**: 탭 닫으면 초기화 → 다시 프로젝트 선택 필요

---

## 17. 라이브러리 스택

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Next.js | 16 | App Router, SSR 프레임워크 |
| React | 19 | UI 라이브러리 |
| Zustand | - | 전역 상태 관리 |
| TanStack React Query | - | 서버 상태 관리, 데이터 캐싱 |
| Tailwind CSS | v4 | 유틸리티 CSS |
| react-grid-layout | - | 대시보드 드래그 가능 그리드 |
| Recharts | - | 차트 렌더링 |
| lucide-react | - | 아이콘 |

---

## 18. 주요 TypeScript 타입

```typescript
// === 인증 ===
interface User {
  id: string
  email: string
  display_name: string
  created_at: string
  has_openai_key: boolean
}

interface WeaviateConnection {
  id: string
  name: string
  connection_type: 'self_hosted' | 'wcs_cloud'
  host: string
  port: number
  grpc_port: number
  api_key: string | null       // "***" if set
  is_active: boolean
  vectorizer_type: 'openai' | 'huggingface' | null
  vectorizer_model: string | null
  created_at: string
  has_openai_key: boolean
}

// === 실행 ===
interface Execution {
  span_id: string
  trace_id: string
  function_name: string
  status: 'SUCCESS' | 'ERROR' | 'CACHE_HIT'
  duration_ms: number
  timestamp_utc: string
  team?: string
  error_code?: string
  error_message?: string
  input_preview?: string
  output_preview?: string
  uuid: string
}

// === 트레이스 ===
interface TraceListItem {
  trace_id: string
  root_function: string
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL'
  total_duration_ms: number
  span_count: number
  start_time: string
}

interface Span {
  span_id: string
  parent_span_id: string | null
  function_name: string
  status: 'SUCCESS' | 'ERROR' | 'CACHE_HIT'
  duration_ms: number
  timestamp_utc: string
  error_code?: string
  error_message?: string
  attributes?: Record<string, any>
  children?: Span[]       // 트리 구조에서만
}

// === 함수 ===
interface FunctionInfo {
  function_name: string
  module?: string
  file_path?: string
  description?: string
  docstring?: string
  source_code?: string
  team?: string
  execution_count?: number
  avg_duration_ms?: number
  error_rate?: number
}

// === 캐시 ===
interface CacheAnalytics {
  total_executions: number
  cache_hit_count: number
  cache_hit_rate: number
  golden_hit_count: number
  standard_hit_count: number
  golden_ratio: number
  time_saved_ms: number
  avg_cached_duration_ms: number
  time_range_minutes: number
  has_data: boolean
}

interface GoldenRecord {
  uuid: string
  execution_uuid: string
  function_name: string
  note: string
  tags: string[]
  created_at: string
}

interface DriftItem {
  function_name: string
  status: 'ANOMALY' | 'NORMAL' | 'INSUFFICIENT_DATA' | 'NO_VECTOR'
  avg_distance: number
  sample_count: number
  threshold: number
}

// === 힐러 ===
interface HealableFunction {
  function_name: string
  error_count: number
  last_error: string
  error_codes: string[]
}

interface DiagnosisResult {
  function_name: string
  diagnosis: string
  suggested_fix: string | null
  lookback_minutes: number
  status: 'success' | 'error' | 'no_errors'
}

// === GitHub ===
interface GitHubPR {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  draft: boolean
  author: string
  author_avatar: string
  created_at: string
  updated_at: string
  merged_at: string | null
  labels: { name: string; color: string }[]
  reviewers: string[]
  html_url: string
  body?: string
}

interface GitHubPRDetail extends GitHubPR {
  changed_files: number
  additions: number
  deletions: number
}

// === 위젯 ===
interface Widget {
  id: string
  widget_type: string
  position_order: number
  size: 'S' | 'M' | 'L'
}

interface WidgetCatalogItem {
  type: string
  name: string
  sizes: string[]
  default_size: string
}
```

---

## 부록: 전체 API 엔드포인트 리스트

| # | Method | Path | 설명 |
|---|--------|------|------|
| 1 | GET | `/` | 앱 상태 체크 |
| 2 | GET | `/health` | 상세 헬스 체크 |
| 3 | POST | `/api/v1/auth/signup` | 회원가입 |
| 4 | POST | `/api/v1/auth/login` | 로그인 |
| 5 | GET | `/api/v1/auth/me` | 사용자 정보 |
| 6 | PUT | `/api/v1/auth/api-key` | 글로벌 OpenAI 키 |
| 7 | GET | `/api/v1/connections` | 연결 목록 |
| 8 | POST | `/api/v1/connections` | 연결 생성 |
| 9 | PUT | `/api/v1/connections/{id}` | 연결 수정 |
| 10 | DELETE | `/api/v1/connections/{id}` | 연결 삭제 |
| 11 | POST | `/api/v1/connections/{id}/activate` | 연결 활성화 |
| 12 | POST | `/api/v1/connections/test` | 연결 테스트 |
| 13 | PUT | `/api/v1/connections/{id}/api-key` | 연결별 OpenAI 키 저장 |
| 14 | DELETE | `/api/v1/connections/{id}/api-key` | 연결별 OpenAI 키 삭제 |
| 15 | GET | `/api/v1/analytics/status` | 시스템 상태 |
| 16 | GET | `/api/v1/analytics/kpi` | KPI 메트릭 |
| 17 | GET | `/api/v1/analytics/tokens` | 토큰 사용량 |
| 18 | GET | `/api/v1/analytics/timeline` | 실행 타임라인 |
| 19 | GET | `/api/v1/analytics/distribution/functions` | 함수 분포 |
| 20 | GET | `/api/v1/analytics/distribution/errors` | 에러 분포 |
| 21 | GET | `/api/v1/executions` | 실행 로그 |
| 22 | GET | `/api/v1/executions/recent-errors` | 최근 에러 |
| 23 | GET | `/api/v1/executions/slowest` | 느린 실행 |
| 24 | GET | `/api/v1/executions/{span_id}` | 실행 상세 |
| 25 | GET | `/api/v1/traces` | 트레이스 목록 |
| 26 | GET | `/api/v1/traces/{id}` | 트레이스 상세 |
| 27 | GET | `/api/v1/traces/{id}/tree` | 트레이스 트리 |
| 28 | GET | `/api/v1/traces/{id}/analyze` | AI 트레이스 분석 |
| 29 | GET | `/api/v1/functions` | 함수 목록 |
| 30 | GET | `/api/v1/functions/search` | 시맨틱 검색 |
| 31 | GET | `/api/v1/functions/search/hybrid` | 하이브리드 검색 |
| 32 | GET | `/api/v1/functions/ask` | AI QnA |
| 33 | GET | `/api/v1/functions/by-team/{team}` | 팀별 함수 |
| 34 | GET | `/api/v1/functions/{name}` | 함수 상세 |
| 35 | GET | `/api/v1/errors` | 에러 목록 |
| 36 | GET | `/api/v1/errors/search` | 시맨틱 에러 검색 |
| 37 | GET | `/api/v1/errors/summary` | 에러 요약 |
| 38 | GET | `/api/v1/errors/trends` | 에러 추세 |
| 39 | GET | `/api/v1/healer/functions` | 진단 가능 함수 |
| 40 | POST | `/api/v1/healer/diagnose` | 함수 진단 |
| 41 | POST | `/api/v1/healer/diagnose/batch` | 일괄 진단 |
| 42 | GET | `/api/v1/healer/diagnose/{name}` | 함수 진단 (GET) |
| 43 | GET | `/api/v1/cache/analytics` | 캐시 분석 |
| 44 | GET | `/api/v1/cache/golden` | 골든 목록 |
| 45 | POST | `/api/v1/cache/golden` | 골든 등록 |
| 46 | DELETE | `/api/v1/cache/golden/{uuid}` | 골든 삭제 |
| 47 | GET | `/api/v1/cache/golden/recommend/{fn}` | 골든 추천 |
| 48 | GET | `/api/v1/cache/golden/stats` | 골든 통계 |
| 49 | GET | `/api/v1/cache/drift/summary` | 드리프트 요약 |
| 50 | POST | `/api/v1/cache/drift/simulate` | 드리프트 시뮬레이션 |
| 51 | GET | `/api/v1/widgets/catalog` | 위젯 카탈로그 |
| 52 | GET | `/api/v1/widgets` | 위젯 목록 |
| 53 | POST | `/api/v1/widgets` | 위젯 추가 |
| 54 | PUT | `/api/v1/widgets/reorder` | 위젯 순서 변경 |
| 55 | PUT | `/api/v1/widgets/{id}` | 위젯 수정 |
| 56 | DELETE | `/api/v1/widgets/{id}` | 위젯 삭제 |
| 57 | PUT | `/api/v1/github/token` | GitHub 토큰 저장 |
| 58 | DELETE | `/api/v1/github/token` | GitHub 토큰 삭제 |
| 59 | GET | `/api/v1/github/status` | GitHub 상태 |
| 60 | GET | `/api/v1/github/repos` | 레포 목록 |
| 61 | GET | `/api/v1/github/repos/{owner}/{repo}/pulls` | PR 목록 |
| 62 | GET | `/api/v1/github/repos/{owner}/{repo}/pulls/{number}` | PR 상세 |
