import { Module } from "@nestjs/common";
import { CategoryModule } from "../category/category.module";
import { MemoModule } from "../memo/memo.module";
import { McpAuthGuard } from "./guards/mcp-auth.guard";
import { McpKeyController } from "./mcp-key.controller";
import { McpKeyRepository } from "./mcp-key.repository";
import { McpKeyService } from "./mcp-key.service";
import { McpServerController } from "./mcp-server.controller";
import { McpServerService } from "./mcp-server.service";

/**
 * Ideamory MCP(Model Context Protocol) API 키 관리 및 Remote MCP 서버 도메인 모듈입니다.
 * 기존 `MemoModule`, `CategoryModule`의 서비스를 재사용해 외부 AI 에이전트와 연동합니다.
 */
@Module({
  imports: [MemoModule, CategoryModule],
  controllers: [McpKeyController, McpServerController],
  providers: [McpKeyRepository, McpKeyService, McpAuthGuard, McpServerService],
  exports: [McpKeyService],
})
export class McpModule {}
