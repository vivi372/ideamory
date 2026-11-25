import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AiService } from "./ai.service";

describe("AiService (문두 @지시어 파싱, Gemini 가변 분류 & 768차원 임베딩)", () => {
  let aiService: AiService;

  beforeEach(() => {
    aiService = new AiService();
    delete process.env.GEMINI_API_KEY;
  });

  it("시나리오 1: parseLeadingCategoryDirective는 문두 @아이디어 지시어를 추출하고 정돈된 본문을 반환해야 한다", () => {
    const result = aiService.parseLeadingCategoryDirective(
      "@아이디어 0.1초 퀵 캡처 서비스 명세서 작성 중"
    );

    assert.equal(result.categoryName, "아이디어");
    assert.equal(result.normalizedName, "아이디어");
    assert.equal(result.cleanedContent, "0.1초 퀵 캡처 서비스 명세서 작성 중");
  });

  it("시나리오 2: parseLeadingCategoryDirective는 이모지를 배제하고 최대 10자 및 공백 정규화 규칙을 준수해야 한다", () => {
    const result = aiService.parseLeadingCategoryDirective(
      "@🔥개발스터디프로젝트기록 테스트 메모"
    );

    assert.equal(result.categoryName, "개발스터디프로젝트기");
    assert.equal(result.normalizedName, "개발스터디프로젝트기");
    assert.equal(result.cleanedContent, "테스트 메모");
  });

  it("시나리오 3: 문두 @지시어가 없으면 categoryName을 null로 반환하고 본문을 유지해야 한다", () => {
    const result = aiService.parseLeadingCategoryDirective(
      "Next.js와 NestJS 조합으로 모노레포 구축하기"
    );

    assert.equal(result.categoryName, null);
    assert.equal(result.normalizedName, null);
    assert.equal(
      result.cleanedContent,
      "Next.js와 NestJS 조합으로 모노레포 구축하기"
    );
  });

  it("시나리오 4: classifyMemoCategory는 기존 카테고리 목록을 프롬프트에 주입하고 이모지가 제거된 분류 결과를 반환해야 한다", async () => {
    let capturedParams: any = null;
    (aiService as any).getClient = () => ({
      models: {
        generateContent: async (params: any) => {
          capturedParams = params;
          return { text: "  개발노트🚀  " };
        },
      },
    });

    const result = await aiService.classifyMemoCategory(
      "Drizzle ORM 트랜잭션 학습",
      ["개발노트", "독서"]
    );

    assert.ok(capturedParams.contents.includes("개발노트, 독서"));
    assert.deepEqual(result, {
      name: "개발노트",
      normalizedName: "개발노트",
    });
  });

  it("시나리오 5: generateEmbedding은 768차원 벡터를 반환하고 API 키 미설정/차원 불일치 시 null을 안전 반환해야 한다", async () => {
    const noKeyResult = await aiService.generateEmbedding("테스트");
    assert.equal(noKeyResult, null);

    const mock768Vector = Array.from({ length: 768 }, (_, i) => i * 0.001);
    (aiService as any).getClient = () => ({
      models: {
        embedContent: async (params: any) => {
          assert.equal(params.config.outputDimensionality, 768);
          return { embeddings: [{ values: mock768Vector }] };
        },
      },
    });

    const vector = await aiService.generateEmbedding("시맨틱 검색용 텍스트");
    assert.ok(Array.isArray(vector));
    assert.equal(vector.length, 768);
  });

  it("시나리오 6: batchEmbedContents는 메모 본문과 카테고리명을 각각 병렬 embedContent로 독립 벡터화하고 abortSignal·공백 스킵·부분 실패 폴백을 보장해야 한다", async () => {
    const calledContents: string[] = [];
    let observedAbortSignal: AbortSignal | undefined;
    (aiService as any).getClient = () => ({
      models: {
        embedContent: async ({
          contents,
          config,
        }: {
          contents: string;
          config?: { abortSignal?: AbortSignal };
        }) => {
          calledContents.push(contents);
          observedAbortSignal = config?.abortSignal;
          if (contents === "실패항목") {
            throw new Error("Partial embedding failure");
          }
          return {
            embeddings: [
              {
                values: new Array(768).fill(contents === "개발" ? 0.22 : 0.11),
              },
            ],
          };
        },
      },
    });

    const vectors = await aiService.batchEmbedContents(["메모 본문", "개발"]);
    assert.deepEqual(calledContents, ["메모 본문", "개발"]);
    assert.ok(observedAbortSignal instanceof AbortSignal);
    assert.equal(vectors.length, 2);
    assert.equal(vectors[0]?.length, 768);
    assert.equal(vectors[1]?.length, 768);
    assert.notEqual(vectors[0]?.[0], vectors[1]?.[0]);

    calledContents.length = 0;
    const withBlank = await aiService.batchEmbedContents(["", "   ", "개발"]);
    assert.deepEqual(calledContents, ["개발"]);
    assert.equal(withBlank[0], null);
    assert.equal(withBlank[1], null);
    assert.equal(withBlank[2]?.length, 768);

    const partial = await aiService.batchEmbedContents(["메모 본문", "실패항목"]);
    assert.equal(partial[0]?.length, 768);
    assert.equal(partial[1], null);

    (aiService as any).getClient = () => null;
    const fallback = await aiService.batchEmbedContents(["메모 본문", "개발"]);
    assert.deepEqual(fallback, [null, null]);
  });

  it("시나리오 7: classifyMemoCategory는 '사용 가이드'/'미분류'를 후보 목록에서 제외하고 LLM이 반환해도 null을 반환해야 한다", async () => {
    let capturedPrompt = "";
    (aiService as any).getClient = () => ({
      models: {
        generateContent: async (params: any) => {
          capturedPrompt = params.contents;
          return { text: "사용 가이드" };
        },
      },
    });

    const result = await aiService.classifyMemoCategory("일반 메모 테스트", [
      "사용 가이드",
      "미분류",
      "개발",
    ]);

    assert.equal(capturedPrompt.includes("사용 가이드"), false);
    assert.equal(capturedPrompt.includes("미분류"), false);
    assert.equal(capturedPrompt.includes("개발"), true);
    assert.equal(result, null);
  });

  it("시나리오 8: classifyMemoCategory는 빈 응답·예약어·일시 예외 시 abortSignal 타임아웃 가드와 함께 최대 2회 재시도해야 한다", async () => {
    // 1) 빈 응답 -> 2회차 정상 분류 + abortSignal 주입 확인
    let emptyAttempts = 0;
    let hasAbortSignal = false;
    (aiService as any).getClient = () => ({
      models: {
        generateContent: async (params: any) => {
          emptyAttempts += 1;
          hasAbortSignal = params?.config?.abortSignal instanceof AbortSignal;
          return emptyAttempts === 1 ? { text: "   " } : { text: "금융" };
        },
      },
    });
    const emptyRetryResult = await aiService.classifyMemoCategory(
      "119000원 입금",
      [],
    );
    assert.equal(emptyAttempts, 2);
    assert.equal(hasAbortSignal, true);
    assert.equal(emptyRetryResult?.name, "금융");

    // 2) 예약어("미분류") 반복 반환 시 2회 시도 후 null 폴백
    let reservedAttempts = 0;
    (aiService as any).getClient = () => ({
      models: {
        generateContent: async () => {
          reservedAttempts += 1;
          return { text: "미분류" };
        },
      },
    });
    const reservedResult = await aiService.classifyMemoCategory("단문", []);
    assert.equal(reservedAttempts, 2);
    assert.equal(reservedResult, null);

    // 3) 일시 예외 발생 시 250ms 백오프 후 2회차 재시도 성공
    let errorAttempts = 0;
    (aiService as any).getClient = () => ({
      models: {
        generateContent: async () => {
          errorAttempts += 1;
          if (errorAttempts === 1) {
            throw new Error("Transient timeout");
          }
          return { text: "쇼핑" };
        },
      },
    });
    const errorRetryResult = await aiService.classifyMemoCategory("우유 사기", []);
    assert.equal(errorAttempts, 2);
    assert.equal(errorRetryResult?.name, "쇼핑");
  });
});

