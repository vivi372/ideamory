# Ideamory 통합 테스트 가이드 (`integration-tests`)

Stage 4 배포 전, 실제 화면(UI)과 실제 데이터베이스(Supabase PostgreSQL)를 대상으로 **결함이 0건이 될 때까지 N차 반복 수행하는 통합 테스트** 디렉터리입니다.

---

## 1. 테스트 원칙 (Scope & Strategy)

1. **API·로그 검증은 기존 자동화 테스트로 갈음**
   - 백엔드 HTTP 계약, 예외 필터, W3C `X-Trace-Id`, 마스킹 로깅 등은 `pnpm --filter @ideamory/api test` (101개 시나리오)로 이미 검증하므로 통합 테스트에서 중복 점검하지 않습니다.
2. **화면(UI) 중심 전수 점검**
   - 실제 브라우저(데스크톱 + 모바일 뷰포트 `360×640`, `390×844`, `430×932`)에서 레이아웃 깨짐, 터치/스크롤 간섭, 낙관적 UI 롤백/동기화, 토스트·다이얼로그 동작을 직접 확인합니다.
3. **Supabase MCP 기반 DB 값 교차 검증**
   - 화면에서 수행한 작업이 실제 DB 테이블(`users`, `categories`, `memos`, `ogp_caches`, `category_merge_suggestions`)에 정확한 컬럼 값(`user_id`/`guest_token`, `normalized_name`, `embedding` 768차원 벡터, `deleted_at`, `ogp_id`)으로 반영되었는지 Supabase MCP `execute_sql`로 직접 확인합니다.
4. **증적 규칙 (스크린샷 + GitHub README용 영상)**
   - **스크린샷**: 모든 테스트 케이스(TC) 및 DB 쿼리 결과는 회차별 폴더에 PNG로 저장합니다.
   - **시연 영상 (README용)**: 주요 핵심 기능(`★ 영상 녹화` 표시 항목)은 추후 GitHub `README.md`에 바로 첨부할 수 있도록 깔끔한 화면 녹화(`.webm` 또는 `.mp4`)로 함께 보관합니다.
5. **N차 반복 게이트 (Zero-Defect Exit)**
   - N차 테스트 중 UI/기능/DB 불일치 이슈가 발견되면 수정 ➔ 재배포/재빌드 ➔ `(N+1)차` 회귀 테스트를 수행하며, **Critical/Major 이슈 0건**이 될 때까지 반복합니다.

---

## 2. 폴더 구조

```text
integration-tests/
├── README.md                        # 본 운영 가이드
├── INTEGRATION_TEST_SCENARIOS.md    # 통합 테스트 시나리오 (TC-01 ~ TC-10 + DB 검증 SQL)
├── TEST_REPORT_TEMPLATE.md          # N차 통합 테스트 결과 보고서 양식
├── reports/                         # 회차별 작성된 결과 보고서 (예: round-1-report.md)
└── evidence/                        # 회차별 증적 파일
    └── round-1/
        ├── screenshots/             # TC별 화면 및 Supabase MCP 결과 스크린샷
        └── videos/                  # GitHub README 첨부용 주요 기능 시연 영상
```

---

## 3. 회차 진행 절차

1. `TEST_REPORT_TEMPLATE.md`를 복사해 `reports/round-N-report.md`를 생성합니다.
2. `INTEGRATION_TEST_SCENARIOS.md`의 `TC-01` ~ `TC-10`을 순서대로 실행합니다.
3. 각 TC 실행 후:
   - 화면 스크린샷을 `evidence/round-N/screenshots/`에 저장합니다.
   - `★ README 영상` 대상 TC는 시연 영상을 `evidence/round-N/videos/`에 저장합니다.
   - 지정된 Supabase MCP SQL로 DB 적재 값을 확인합니다.
4. 이슈가 1건이라도 발견되면 결과서 하단 **발견 이슈 및 조치 내역**에 기록 후 수정하고, `round-(N+1)`을 진행합니다.
