import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchSorter } from "match-sorter";
import {
  CreateCategorySchema,
  type CategoryResponseDto,
} from "@ideamory/api-spec";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";

describe("0ms 카테고리 피커 인메모리 필터링 & 생성 검증", () => {
  const sampleCategories: CategoryResponseDto[] = [
    { id: generateUuidV7(), name: "아이디어", memoCount: 3 },
    { id: generateUuidV7(), name: "쇼핑", memoCount: 2 },
    { id: generateUuidV7(), name: "개발 메모", memoCount: 5 },
  ];

  it("match-sorter를 사용해 네트워크 호출 없이 0ms로 카테고리 목록을 필터링해야 한다", () => {
    const filtered = matchSorter(sampleCategories, "쇼핑", { keys: ["name"] });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, "쇼핑");

    const devFiltered = matchSorter(sampleCategories, "개발", {
      keys: ["name"],
    });
    assert.equal(devFiltered.length, 1);
    assert.equal(devFiltered[0]?.name, "개발 메모");
  });

  it("CreateCategorySchema는 1~10자 및 이모지 배제 규칙을 강제해야 한다", () => {
    const valid = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "업무노트",
    });
    assert.equal(valid.success, true);

    const tooLong = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "열한글자카테고리이름임",
    });
    assert.equal(tooLong.success, false);

    const withEmoji = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "쇼핑🛒",
    });
    assert.equal(withEmoji.success, false);
  });
});
