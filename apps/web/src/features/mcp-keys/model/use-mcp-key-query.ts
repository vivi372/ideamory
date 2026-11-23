"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import type {
  CreateMcpKeyDto,
  McpKeyCreatedResponseDto,
} from "@ideamory/api-spec";
import { ApiClientError } from "@/shared/api";
import { useFeedback } from "@/shared/lib/feedback/use-feedback";
import {
  fetchMcpKeyStatusApi,
  issueMcpKeyApi,
  revokeMcpKeyApi,
} from "../api/mcp-key.api";

const MCP_KEY_STATUS_QUERY_KEY = ["mcp-keys", "status"] as const;

interface McpKeySheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * MCP API 키 관리 바텀시트 열림 상태를 전역으로 관리하는 스토어입니다.
 */
export const useMcpKeySheetStore = create<McpKeySheetState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * 현재 사용자의 MCP API 키 보유 상태 및 권한 메타데이터를 조회합니다.
 */
export function useMcpKeyStatus(enabled: boolean) {
  return useQuery({
    queryKey: MCP_KEY_STATUS_QUERY_KEY,
    queryFn: fetchMcpKeyStatusApi,
    enabled,
  });
}

/**
 * MCP API 키 발급 및 재발급 뮤테이션 훅입니다.
 */
export function useIssueMcpKey() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  return useMutation<McpKeyCreatedResponseDto, unknown, CreateMcpKeyDto>({
    mutationFn: issueMcpKeyApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MCP_KEY_STATUS_QUERY_KEY });
      showToast("info", "새 MCP API 키가 발급되었습니다.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "MCP API 키 발급에 실패했습니다.";
      showToast("error", message);
    },
  });
}

/**
 * 활성 MCP API 키 폐기(삭제) 뮤테이션 훅입니다.
 */
export function useRevokeMcpKey() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  return useMutation<void, unknown, void>({
    mutationFn: revokeMcpKeyApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MCP_KEY_STATUS_QUERY_KEY });
      showToast("info", "MCP API 키가 폐기되었습니다.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "MCP API 키 폐기에 실패했습니다.";
      showToast("error", message);
    },
  });
}
