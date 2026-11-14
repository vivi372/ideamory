import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  MergeCategorySchema,
  UuidV7Schema,
} from "@ideamory/api-spec";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessException } from "../../common/exceptions/business.exception";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";

describe("CategoryController & ZodValidationPipe (라우트 위임 및 텍스트 전용/글자수/UUID v7 검증)", () => {
  const userPayload = {
    userId: "018d0000-0000-7000-8000-000000000001",
    isGuest: false,
  };
  let controller: CategoryController;
  let calls: string[];

  beforeEach(() => {
    calls = [];
    const mockService: Partial<CategoryService> = {
      getCategories: async () => {
        calls.push("getCategories");
        return [
          {
            id: "018d0000-0000-7000-8000-000000000010",
            name: "아이디어",
            memoCount: 2,
          },
        ];
      },
      createCategory: async (_owner, dto) => {
        calls.push(`createCategory:${dto.name}`);
        return { id: dto.id, name: dto.name, memoCount: 0 };
      },
      updateCategory: async (_owner, id, dto) => {
        calls.push(`updateCategory:${id}:${dto.name}`);
        return { id, name: dto.name, memoCount: 2 };
      },
      mergeCategories: async (_owner, dto) => {
        calls.push(
          `mergeCategories:${dto.sourceCategoryId}->${dto.targetCategoryId}`
        );
        return { success: true, affectedMemosCount: 4 };
      },
      getMergeSuggestions: async () => {
        calls.push("getMergeSuggestions");
        return [
          {
            id: "018d0000-0000-7000-8000-000000000099",
            sourceCategoryId: "018d0000-0000-7000-8000-000000000011",
            sourceCategoryName: "구매 계획",
            targetCategoryId: "018d0000-0000-7000-8000-000000000010",
            targetCategoryName: "쇼핑",
            similarity: 0.88,
          },
        ];
      },
      dismissMergeSuggestion: async (_owner, id) => {
        calls.push(`dismissMergeSuggestion:${id}`);
      },
    };

    controller = new CategoryController(mockService as CategoryService);
  });

  it("시나리오 1: GET / POST / PATCH / POST merge 엔드포인트가 서비스로 정확히 위임되어야 한다", async () => {
    const list = await controller.getCategories(userPayload);
    assert.equal(list.length, 1);

    const created = await controller.createCategory(userPayload, {
      id: "018d0000-0000-7000-8000-000000000010",
      name: "아이디어",
    });
    assert.equal(created.name, "아이디어");

    const updated = await controller.updateCategory(
      userPayload,
      "018d0000-0000-7000-8000-000000000010",
      { name: "개발" }
    );
    assert.equal(updated.name, "개발");

    const merged = await controller.mergeCategories(userPayload, {
      sourceCategoryId: "018d0000-0000-7000-8000-000000000011",
      targetCategoryId: "018d0000-0000-7000-8000-000000000010",
    });
    assert.deepEqual(merged, { success: true, affectedMemosCount: 4 });

    const suggestions = await controller.getMergeSuggestions(userPayload);
    assert.equal(suggestions.length, 1);

    await controller.dismissMergeSuggestion(
      userPayload,
      "018d0000-0000-7000-8000-000000000099"
    );

    assert.deepEqual(calls, [
      "getCategories",
      "createCategory:아이디어",
      "updateCategory:018d0000-0000-7000-8000-000000000010:개발",
      "mergeCategories:018d0000-0000-7000-8000-000000000011->018d0000-0000-7000-8000-000000000010",
      "getMergeSuggestions",
      "dismissMergeSuggestion:018d0000-0000-7000-8000-000000000099",
    ]);
  });

  it("시나리오 2: ZodValidationPipe는 이모지 포함, 10자 초과, 빈 공백, 비정상 UUID 입력 시 400 BusinessException을 발생시켜야 한다", () => {
    const createPipe = new ZodValidationPipe(CreateCategorySchema);
    const updatePipe = new ZodValidationPipe(UpdateCategorySchema);
    const mergePipe = new ZodValidationPipe(MergeCategorySchema);
    const uuidPipe = new ZodValidationPipe(UuidV7Schema);

    const invalidCreatePayloads = [
      { id: "018d0000-0000-7000-8000-000000000010", name: "🚀개발" },
      { id: "018d0000-0000-7000-8000-000000000010", name: "열글자를초과하는카테고리명" },
      { id: "018d0000-0000-7000-8000-000000000010", name: "   " },
      { id: "not-a-uuid", name: "개발" },
    ];

    for (const payload of invalidCreatePayloads) {
      assert.throws(
        () => createPipe.transform(payload, { type: "body" }),
        (err: any) => {
          assert.ok(err instanceof BusinessException);
          assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
          return true;
        }
      );
    }

    assert.throws(
      () => updatePipe.transform({ name: "💡아이디어" }, { type: "body" }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        return true;
      }
    );

    assert.throws(
      () =>
        mergePipe.transform(
          {
            sourceCategoryId: "invalid-uuid",
            targetCategoryId: "018d0000-0000-7000-8000-000000000010",
          },
          { type: "body" }
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        return true;
      }
    );

    assert.throws(
      () =>
        uuidPipe.transform("550e8400-e29b-41d4-a716-446655440000", {
          type: "param",
        }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        return true;
      }
    );
  });
});
