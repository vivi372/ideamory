import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { LogTrace } from "../../common/decorators/log-trace.decorator";
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
  @LogTrace()
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
        process.env.GEMINI_CLASSIFY_MODEL || "gemini-3.1-flash-lite";
      const filteredExisting = existingCategoryNames.filter((name) => {
        const normalized = name.replace(/\s+/g, "").toLowerCase();
        return normalized !== "미분류" && normalized !== "사용가이드";
      });
      const existingListText =
        filteredExisting.length > 0 ? filteredExisting.join(", ") : "없음";

      const systemInstruction = [
        "당신은 개인 지식 서재의 메모 분류기입니다.",
        "반드시 아래 규칙을 지켜 카테고리 이름 한 단어(또는 짧은 명사구)만 출력하세요.",
        "1. 기존 카테고리 목록에 어울리는 항목이 있다면 반드시 기존 카테고리 이름 그대로 반환하세요.",
        "2. 기존 카테고리에 적절한 것이 없다면 새로운 일반 카테고리명(예: 개발, 금융, 정산, 쇼핑, 일정, 아이디어, 독서, 건강, 메모)을 제안하세요.",
        "3. 짧은 단문이나 숫자·금액·할일 메모라도 절대 분류를 포기하지 말고 가장 가까운 일반 카테고리를 1개 선택하세요. (예: '119000원 돈 받기' -> 금융, '우유 사기' -> 쇼핑)",
        "4. 출력은 1자 이상 10자 이내의 순수 텍스트(한글 또는 영문)여야 합니다.",
        "5. 이모지, 마침표, 따옴표, 부가 설명을 절대 포함하지 마세요.",
        "6. '사용 가이드', '사용가이드', '미분류'는 시스템 예약 카테고리이므로 절대 선택하거나 새로 제안하지 마세요.",
      ].join("\n");

      const prompt = `기존 카테고리 목록: [${existingListText}]\n\n메모 내용:\n${content}`;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              maxOutputTokens: 64,
              abortSignal: AbortSignal.timeout(8000),
            },
          });

          const rawText = response.text?.trim();
          if (!rawText) {
            if (attempt < 2) {
              continue;
            }
            return null;
          }

          const sanitized = this.sanitizeCategoryName(rawText);
          if (
            !sanitized ||
            sanitized.normalizedName === "사용가이드" ||
            sanitized.normalizedName === "미분류"
          ) {
            if (attempt < 2) {
              continue;
            }
            return null;
          }

          return sanitized;
        } catch (attemptError: any) {
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            continue;
          }
          throw attemptError;
        }
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `Gemini 카테고리 분류 실패 (비동기 폴백 유지): ${error?.message || error}`
      );
      return null;
    }
  }

  /**
   * Gemini `gemini-embedding-2` 모델을 사용하여 복수 텍스트의 768차원 시맨틱 임베딩 벡터를 단일 배치 요청으로 생성합니다.
   * 메모 본문과 신규 카테고리명을 동시에 벡터화해 불필요한 네트워크 왕복 지연을 방지합니다.
   *
   * @param contents 임베딩을 생성할 문자열 배열 (예: [memoContent, categoryName])
   * @returns 입력 순서에 대응하는 768차원 실수 벡터 배열 (실패 또는 API 키 미설정 항목은 null)
   */
  @LogTrace()
  async batchEmbedContents(
    contents: string[]
  ): Promise<Array<number[] | null>> {
    if (contents.length === 0) {
      return [];
    }

    const client = this.getClient();
    if (!client) {
      this.logger.debug(
        "GEMINI_API_KEY가 설정되지 않아 768차원 배치 임베딩 생성을 건너뜁니다."
      );
      return contents.map(() => null);
    }

    try {
      const model =
        process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";

      const response = await client.models.embedContent({
        model,
        contents,
        config: {
          outputDimensionality: 768,
        },
      });

      return contents.map((_, idx) => {
        const values = response.embeddings?.[idx]?.values;
        if (!values || values.length !== 768) {
          this.logger.warn(
            `비정상적인 임베딩 차원 수신 (index: ${idx}, 기대: 768, 실제: ${values?.length ?? 0})`
          );
          return null;
        }
        return values;
      });
    } catch (error: any) {
      this.logger.warn(
        `Gemini 배치 임베딩 생성 실패 (비동기 폴백 유지): ${error?.message || error}`
      );
      return contents.map(() => null);
    }
  }

  /**
   * Gemini `gemini-embedding-2` 모델을 사용하여 단일 텍스트의 768차원 시맨틱 임베딩 벡터를 생성합니다.
   * (3072 미만 outputDimensionality 지정 시 모델 단에서 자동 정규화 지원)
   *
   * @param content 임베딩을 생성할 텍스트
   * @returns 768차원 실수 벡터 배열 또는 실패 시 null
   */
  @LogTrace()
  async generateEmbedding(content: string): Promise<number[] | null> {
    const [embedding] = await this.batchEmbedContents([content]);
    return embedding ?? null;
  }
}

