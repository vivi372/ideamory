# Ideamory Remote MCP (Model Context Protocol) 연동 가이드

Ideamory는 **Remote MCP Streamable HTTP** 엔드포인트(`/api/v1/mcp`)를 통해 Claude Desktop, Cursor 등 외부 AI 에이전트가 내 메모 서재를 직접 검색하고 새 메모를 캡처할 수 있도록 지원합니다.

---

## 1. API 키 발급 방법
1. Ideamory 웹/앱 좌측 상단 메뉴(드로어)를 엽니다.
2. **[AI 에이전트 연동 (MCP 키 관리)]** 버튼을 눌러 바텀시트를 엽니다.
3. 허용 권한(`READ`, `WRITE`)과 선택적 **고정 카테고리**(최대 10자)를 지정한 뒤 **[새 API 키 생성]**을 누릅니다.
4. 화면에 1회 표시되는 `idm_live_...` 키를 복사합니다. (보안상 SHA-256 해시만 저장되므로 재조회가 불가합니다.)

---

## 2. Claude Desktop 연동 설정 (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "ideamory": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://p01--ideamory--fyppwr9k8xfj.code.run/api/v1/mcp",
        "--header",
        "Authorization: Bearer idm_live_여기에_발급받은_키_입력"
      ]
    }
  }
}
```

---

## 3. Cursor 연동 설정 (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "ideamory": {
      "url": "https://p01--ideamory--fyppwr9k8xfj.code.run/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer idm_live_여기에_발급받은_키_입력"
      }
    }
  }
}
```

*(로컬 개발 서버 테스트 시 URL을 `http://localhost:3001/api/v1/mcp`로 변경하세요.)*

---

## 4. Antigravity 연동 설정 (`~/.gemini/antigravity/mcp_config.json`)

```json
{
  "mcpServers": {
    "ideamory": {
      "serverUrl": "https://p01--ideamory--fyppwr9k8xfj.code.run/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer idm_live_여기에_발급받은_키_입력"
      }
    }
  }
}
```

---

## 5. 제공 도구 (MCP Tools)

| 도구명 | 필요 권한 | 설명 |
| :--- | :---: | :--- |
| `list_memos` | `READ` | 전체 최신순 메모 조회 또는 `categoryId`·`categoryName` 기반 카테고리별 필터링 조회 (`limit`, `cursor` 지원) |
| `search_memos` | `READ` | Tier 1 키워드 일치 최우선 + Tier 2 코사인 유사도(`0.65+`) 하이브리드 검색 |
| `get_related_memos` | `READ` | 기준 메모 ID 대비 코사인 유사도 `0.75+` 1-Depth 연관 메모 조회 |
| `list_categories` | `READ` | 활성 메모가 1건 이상 존재하는 카테고리 목록 조회 |
| `create_memo` | `WRITE` | 0.1초 퀵 캡처 저장 (고정 카테고리 설정 시 AI 분류를 건너뛰고 즉시 매핑) |

### `list_memos` 활용 예시
- **전체 최신 메모 훑어보기**: `list_memos()` (기본 `limit: 20`, 최대 `50`)
- **고정 카테고리 적재 메모 모아보기**: `list_memos({ categoryName: "AI스크랩" })`
- **페이지네이션**: `list_memos({ limit: 20, cursor: "018f3a2b-1234-7123-8456-9abcdef01234" })`
  - `cursor`에는 `createdAt` 타임스탬프가 아닌 **직전 페이지 마지막 메모의 `id` (UUID v7)**를 전달해야 합니다.
