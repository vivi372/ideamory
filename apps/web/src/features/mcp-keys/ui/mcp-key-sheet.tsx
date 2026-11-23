"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Copy, KeyRound, Trash2, X } from "lucide-react";
import type { McpKeyScope } from "@ideamory/api-spec";
import { useFeedback } from "@/shared/lib/feedback/use-feedback";
import {
  useIssueMcpKey,
  useMcpKeySheetStore,
  useMcpKeyStatus,
  useRevokeMcpKey,
} from "../model/use-mcp-key-query";

const CATEGORY_NAME_REGEX = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_-]+$/;

/**
 * 사이드바 드로어에서 열리는 1-Depth MCP API 키 발급·관리 바텀시트입니다.
 * 권한(READ, WRITE) 선택, 캡처 시 강제 고정 카테고리 지정, 1회성 원문 키 복사 기능을 제공합니다.
 */
export function McpKeySheet() {
  const open = useMcpKeySheetStore((state) => state.open);
  const setOpen = useMcpKeySheetStore((state) => state.setOpen);
  const { showToast } = useFeedback();

  const statusQuery = useMcpKeyStatus(open);
  const issueMutation = useIssueMcpKey();
  const revokeMutation = useRevokeMcpKey();

  const [scopes, setScopes] = useState<McpKeyScope[]>(["READ", "WRITE"]);
  const [fixedCategoryName, setFixedCategoryName] = useState("");
  const [issuedRawKey, setIssuedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIssuedRawKey(null);
      setCopied(false);
      setValidationError(null);
    }
  }, [open]);

  useEffect(() => {
    if (statusQuery.data?.hasKey) {
      if (statusQuery.data.scopes.length > 0) {
        setScopes(statusQuery.data.scopes);
      }
      setFixedCategoryName(statusQuery.data.fixedCategoryName ?? "");
    }
  }, [statusQuery.data]);

  const toggleScope = (scope: McpKeyScope) => {
    setValidationError(null);
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((item) => item !== scope) : [...prev, scope],
    );
  };

  const handleIssue = () => {
    if (scopes.length === 0) {
      setValidationError("최소 1개 이상의 허용 권한을 선택해 주세요.");
      return;
    }

    const trimmedCategory = fixedCategoryName.trim();
    if (trimmedCategory.length > 10) {
      setValidationError("고정 카테고리 이름은 최대 10자까지 입력할 수 있습니다.");
      return;
    }
    if (trimmedCategory && !CATEGORY_NAME_REGEX.test(trimmedCategory)) {
      setValidationError(
        "고정 카테고리 이름에는 공백이나 이모지, 특수문자를 사용할 수 없습니다.",
      );
      return;
    }

    setValidationError(null);
    issueMutation.mutate(
      {
        scopes,
        ...(trimmedCategory ? { fixedCategoryName: trimmedCategory } : {}),
      },
      {
        onSuccess: (created) => {
          setIssuedRawKey(created.apiKey);
          setCopied(false);
        },
      },
    );
  };

  const handleRevoke = () => {
    revokeMutation.mutate(undefined, {
      onSuccess: () => {
        setIssuedRawKey(null);
        setFixedCategoryName("");
        setScopes(["READ", "WRITE"]);
      },
    });
  };

  const handleCopyKey = async () => {
    if (!issuedRawKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issuedRawKey);
      setCopied(true);
      showToast("info", "API 키가 클립보드에 복사되었습니다.");
    } catch {
      showToast("error", "클립보드 복사에 실패했습니다.");
    }
  };

  const hasKey = Boolean(statusQuery.data?.hasKey);
  const isBusy =
    issueMutation.isPending || revokeMutation.isPending || statusQuery.isLoading;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => setOpen(nextOpen)}
    >
      {open && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="sheet-backdrop" />
          <DialogPrimitive.Content className="social-sheet mcp-sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <p className="sheet-kicker">MODEL CONTEXT PROTOCOL</p>
                <DialogPrimitive.Title asChild>
                  <h2>AI 에이전트 연동 (MCP 키 관리)</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="MCP 키 관리 시트 닫기"
                >
                  <X size={18} />
                </button>
              </DialogPrimitive.Close>
            </div>

            <div className="mcp-sheet-body">
              {hasKey && statusQuery.data && (
                <div className="mcp-status-card">
                  <div className="mcp-status-row">
                    <span className="mcp-status-label">활성 키</span>
                    <code className="mcp-key-prefix">
                      {statusQuery.data.keyPrefix}
                    </code>
                  </div>
                  <div className="mcp-status-row">
                    <span className="mcp-status-label">허용 권한</span>
                    <span>{statusQuery.data.scopes.join(", ")}</span>
                  </div>
                  <div className="mcp-status-row">
                    <span className="mcp-status-label">고정 카테고리</span>
                    <span>{statusQuery.data.fixedCategoryName ?? "미지정 (AI 자동 분류)"}</span>
                  </div>
                </div>
              )}

              {issuedRawKey && (
                <div className="mcp-issued-box" role="status">
                  <p className="mcp-issued-warning">
                    이 API 키는 보안상 지금 한 번만 표시됩니다. 안전한 곳에 복사해 두세요.
                  </p>
                  <div className="mcp-issued-row">
                    <code className="mcp-issued-key">{issuedRawKey}</code>
                    <button
                      type="button"
                      className="mcp-copy-btn"
                      onClick={() => {
                        void handleCopyKey();
                      }}
                      aria-label="API 키 복사"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? "복사됨" : "복사"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="mcp-field">
                <p className="mcp-field-title">허용 기능 (Scope)</p>
                <div className="mcp-scope-group">
                  <label className="mcp-scope-item">
                    <input
                      type="checkbox"
                      checked={scopes.includes("READ")}
                      onChange={() => toggleScope("READ")}
                    />
                    <span>
                      <strong>READ</strong> — 메모 검색, 연관 메모, 카테고리 조회
                    </span>
                  </label>
                  <label className="mcp-scope-item">
                    <input
                      type="checkbox"
                      checked={scopes.includes("WRITE")}
                      onChange={() => toggleScope("WRITE")}
                    />
                    <span>
                      <strong>WRITE</strong> — 외부 AI에서 메모 퀵 캡처 저장
                    </span>
                  </label>
                </div>
              </div>

              <div className="mcp-field">
                <label className="mcp-field-title" htmlFor="mcp-fixed-category">
                  캡처 시 강제 고정 카테고리 (선택)
                </label>
                <input
                  id="mcp-fixed-category"
                  type="text"
                  maxLength={10}
                  value={fixedCategoryName}
                  onChange={(event) => {
                    setValidationError(null);
                    setFixedCategoryName(event.target.value);
                  }}
                  placeholder="예: AI캡처 (비우면 자동 분류)"
                  className="mcp-category-input"
                />
                <p className="mcp-field-hint">
                  공백·이모지 없이 최대 10자. 지정 시 AI 분류 없이 해당 카테고리로 즉시 저장됩니다.
                </p>
              </div>

              {validationError && (
                <p className="mcp-validation-error" role="alert">
                  {validationError}
                </p>
              )}

              <div className="mcp-actions">
                <button
                  type="button"
                  className="mcp-issue-btn"
                  disabled={isBusy}
                  onClick={handleIssue}
                >
                  <KeyRound size={15} aria-hidden="true" />
                  <span>{hasKey ? "API 키 재발급" : "새 API 키 생성"}</span>
                </button>
                {hasKey && (
                  <button
                    type="button"
                    className="mcp-revoke-btn"
                    disabled={isBusy}
                    onClick={handleRevoke}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span>키 폐기</span>
                  </button>
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
