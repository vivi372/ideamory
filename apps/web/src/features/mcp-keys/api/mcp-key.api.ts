import type {
  CreateMcpKeyDto,
  McpKeyCreatedResponseDto,
  McpKeyStatusResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "@/shared/api";

/**
 * 현재 계정의 활성 MCP API 키 상태 및 메타데이터를 조회합니다.
 */
export async function fetchMcpKeyStatusApi(): Promise<McpKeyStatusResponseDto> {
  const { data } = await apiClient.get<McpKeyStatusResponseDto>("/mcp-keys");
  return data;
}

/**
 * 신규 MCP API 키를 발급하거나 기존 활성 키를 재발급합니다.
 */
export async function issueMcpKeyApi(
  dto: CreateMcpKeyDto,
): Promise<McpKeyCreatedResponseDto> {
  const { data } = await apiClient.post<McpKeyCreatedResponseDto>(
    "/mcp-keys",
    dto,
  );
  return data;
}

/**
 * 현재 계정의 활성 MCP API 키를 즉시 폐기(삭제)합니다.
 */
export async function revokeMcpKeyApi(): Promise<void> {
  await apiClient.delete("/mcp-keys");
}
