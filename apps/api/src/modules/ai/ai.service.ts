import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import type { ParsedDirectiveResult } from "./ai.type";

/**
 * Gemini AI 기반 가변 카테고리 자율 분류 및 768차원 임베딩 생성 서비스
 *
 * [설계 원칙]
 * 1. 문두 `@카테고리` 명시적 지시어를 LLM 호출보다 최우선으로 처리하여 불필요한 AI 비용 및 지연을 제거합니다.
 * 2. 비동기 백그라운드 파이프라인에서 호출되므로, GEMINI_API_KEY 미설정이나 외부 API 장애 시에도
 *    예외를 던져 메인 메모 저장 흐름을 깨뜨리지 않고 안전하게 null을 반환합니다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAiClient: GoogleGenAI | null = null;

  /**
   * GoogleGenAI SDK 클라이언트를 지연 초기화하여 반환합니다.
   *
   * @returns GoogleGenAI 인스턴스 또는 API 키 미설정 시 null
   */
  protected getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!this.genAiClient) {
      this.genAiClient = new GoogleGenAI({ apiKey });
    }
    return this.genAiClient;
  }

  /**
   * 카테고리명에서 이모지/공백을 제거하고 1~10자 길이 제약을 적용하여 정규화 키를 생성합니다.
   *
   * @param rawName 원본 카테고리 문자열
   * @returns 정제된 표시 이름과 정규화 키 (유효하지 않으면 null)
   */
  public sanitizeCategoryName(rawName: string): {
    name: string;
    normalizedName: string;
  } | null {
    // 이모지(Pictographic) 및 제어 문자 제거 후 앞뒤 공백 정리
    const withoutEmoji = rawName
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/["'`#.,!?]/g, "")
      .trim();

    if (!withoutEmoji) {
      return null;
    }

    // DB CHECK 제약(char_length <= 10) 준수를 위해 최대 10자로 절단
    const name = withoutEmoji.slice(0, 10).trim();
    const normalizedName = name.replace(/\s+/g, "").toLowerCase();

    if (!name || !normalizedName) {
      return null;
    }

    return { name, normalizedName };
  }

  /**
   * 메모 본문 시작부의 `@카테고리명` 명시적 지시어(`^@(\S+)`)를 파싱합니다.
   *
   * @param rawContent 사용자가 입력한 원본 메모 본문
   * @returns 추출된 카테고리명, 정규화 키 및 지시어가 제거된 본문
   */
  public parseLeadingCategoryDirective(
    rawContent: string
  ): ParsedDirectiveResult {
    const trimmed = rawContent.trim();
    const match = trimmed.match(/^@(\S+)/);

    if (!match) {
      return {
        categoryName: null,
        normalizedName: null,
        cleanedContent: trimmed,
      };
    }

    const sanitized = this.sanitizeCategoryName(match[1]);
    if (!sanitized) {
      return {
        categoryName: null,
        normalizedName: null,
        cleanedContent: trimmed,
      };
    }

    // 지시어 제거 후 남은 본문 정리 (본문이 지시어만 있었다면 지시어 원문 보존)
    const afterDirective = trimmed.slice(match[0].length).trim();
    const cleanedContent = afterDirective.length > 0 ? afterDirective : trimmed;

    return {
      categoryName: sanitized.name,
      normalizedName: sanitized.normalizedName,
      cleanedContent,
    };
  }

  /**
   * Gemini LLM을 호출하여 메모 내용에 가장 적합한 카테고리를 가변 자율 분류합니다.
   * 사용자의 기존 카테고리 목록을 프롬프트에 주입해 불필요한 신규 카테고리 남발을 방지합니다.
   *
   * @param content 분류할 메모 본문
   * @param existingCategoryNames 사용자가 현재 보유한 카테고리 이름 목록
   * @returns 추천된 카테고리(name, normalizedName) 또는 분류 불가/실패 시 null
   */
  async classifyMemoCategory(
    content: string,
    existingCategoryNames: string[]
  ): Promise<{ name: string; normalizedName: string } | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.debug(
        "GEMINI_API_KEY가 설정되지 않아 AI 카테고리 자동 분류를 건너뜁니다."
      );
      return null;
    }

    try {
      const model =
        process.env.GEMINI_CLASSIFY_MODEL || "gemini-2.5-flash";
      const existingListText =
        existingCategoryNames.length > 0
          ? existingCategoryNames.join(", ")
          : "없음";

      const systemInstruction = [
        "당신은 개인 지식 서재의 메모 분류기입니다.",
        "반드시 아래 규칙을 지켜 카테고리 이름 한 단어(또는 짧은 명사구)만 출력하세요.",
        "1. 기존 카테고리 목록에 어울리는 항목이 있다면 반드시 기존 카테고리 이름 그대로 반환하세요.",
        "2. 기존 카테고리에 적절한 것이 없을 때만 새로운 카테고리를 제안하세요.",
        "3. 출력은 1자 이상 10자 이내의 순수 텍스트(한글 또는 영문)여야 합니다.",
        "4. 이모지, 마침표, 따옴표, 부가 설명을 절대 포함하지 마세요.",
      ].join("\n");

      const prompt = `기존 카테고리 목록: [${existingListText}]\n\n메모 내용:\n${content}`;

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 32,
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        return null;
      }

      return this.sanitizeCategoryName(rawText);
    } catch (error: any) {
      this.logger.warn(
        `Gemini 카테고리 분류 실패 (비동기 폴백 유지): ${error?.message || error}`
      );
      return null;
    }
  }

  /**
   * Gemini `text-embedding-004` 모델을 사용하여 768차원 시맨틱 임베딩 벡터를 생성합니다.
   *
   * @param content 임베딩을 생성할 메모 텍스트
   * @returns 768차원 실수 벡터 배열 또는 실패 시 null
   */
  async generateEmbedding(content: string): Promise<number[] | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.debug(
        "GEMINI_API_KEY가 설정되지 않아 768차원 임베딩 생성을 건너뜁니다."
      );
      return null;
    }

    try {
      const model =
        process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

      const response = await client.models.embedContent({
        model,
        contents: content,
        config: {
          outputDimensionality: 768,
        },
      });

      const values = response.embeddings?.[0]?.values;
      if (!values || values.length !== 768) {
        this.logger.warn(
          `비정상적인 임베딩 차원 수신 (기대: 768, 실제: ${values?.length ?? 0})`
        );
        return null;
      }

      return values;
    } catch (error: any) {
      this.logger.warn(
        `Gemini 임베딩 생성 실패 (비동기 폴백 유지): ${error?.message || error}`
      );
      return null;
    }
  }
}

