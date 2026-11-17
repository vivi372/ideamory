import type {
  CategoryResponseDto,
  GuestInitDto,
  GuestInitResponseDto,
  LinkSocialAuthDto,
  LinkSocialAuthResponseDto,
  MergeSuggestionResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "../../../shared/api";

/**
 * 0.1초 익명 게스트 세션을 발급받고 온보딩 시드 메모를 생성합니다.
 *
 * @param dto 클라이언트에서 선발급한 UUID v7 (`memoId`, `categoryId`)
 * @returns 발급된 `guestToken` 및 생성된 `seedMemoId`
 * @throws {ApiClientError} UUID v7 규격 위반(`400`) 또는 서버 오류 시
 */
export async function initGuestSessionApi(
  dto: GuestInitDto
): Promise<GuestInitResponseDto> {
  const { data } = await apiClient.post<GuestInitResponseDto>(
    "/auth/guest/init",
    dto
  );
  return data;
}

/**
 * 현재 게스트 세션이 보유한 모든 메모, 카테고리, 임베딩 데이터를 단일 트랜잭션으로 영구 초기화합니다.
 * (`204 No Content` 응답)
 *
 * @throws {ApiClientError} 게스트 토큰 누락/무효(`401`) 시
 */
export async function resetGuestDataApi(): Promise<void> {
  await apiClient.delete("/auth/guest/reset");
}

/**
 * 익명 게스트 데이터를 정식 소셜 계정(카카오/구글/깃허브)으로 무손실 이관합니다.
 *
 * @param dto 소셜 제공자(`provider`) 및 검증할 JWT(`idToken`)
 * @returns 이관 성공 여부 및 승격된 정회원 `userId`
 * @throws {ApiClientError} 토큰 검증 실패(`401`) 시
 */
export async function linkSocialAccountApi(
  dto: LinkSocialAuthDto
): Promise<LinkSocialAuthResponseDto> {
  const { data } = await apiClient.post<LinkSocialAuthResponseDto>(
    "/auth/social/link",
    dto
  );
  return data;
}

/**
 * 정식 소셜 계정의 회원탈퇴를 수행하고 모든 사용자 데이터를 단일 트랜잭션으로 영구 파기합니다.
 * (`204 No Content` 응답)
 *
 * @throws {ApiClientError} 인증 누락(`401`) 시
 */
export async function deleteSocialAccountApi(): Promise<void> {
  await apiClient.delete("/auth/account");
}

/**
 * 사이드바 드로어 LIBRARY 구획에 표출할 활성 카테고리 목록을 조회합니다.
 *
 * @returns 활성 메모 개수가 포함된 카테고리 목록
 */
export async function fetchCategoriesApi(): Promise<CategoryResponseDto[]> {
  const { data } = await apiClient.get<CategoryResponseDto[]>("/categories");
  return data;
}

/**
 * 사이드바 드로어의 오렌지 닷(Dot) 알림 인디케이터 표출 여부를 결정하기 위해
 * 대기 중인 유사 카테고리 병합 제안 목록을 조회합니다.
 *
 * @returns 대기 중인 병합 제안 목록
 */
export async function fetchMergeSuggestionsApi(): Promise<
  MergeSuggestionResponseDto[]
> {
  const { data } = await apiClient.get<MergeSuggestionResponseDto[]>(
    "/categories/merge-suggestions"
  );
  return data;
}
