/**
 * 앱 초기 세션 부트스트랩(`POST /auth/guest/init` 또는 OAuth 이관) 진행 중 Promise를
 * FSD `shared/api` 계층에서 안전하게 공유하기 위한 레지스트리입니다.
 *
 * [설계 배경]
 * `features/memo-capture`가 동일 레이어인 `features/auth-drawer`를 수평 참조하지 않고도,
 * 최초 방문자가 세션 발급 완료 전 0.1초 만에 메모를 전송할 때 세션 발급 완료를 대기(`waitForAuthBootstrap`)할 수 있게 합니다.
 */
let activeBootstrapPromise: Promise<void> | null = null;

/**
 * 현재 진행 중인 인증/게스트 부트스트랩 Promise를 등록합니다.
 *
 * @param promise 진행 중인 부트스트랩 Promise (완료/해제 시 null)
 */
export function registerAuthBootstrapPromise(promise: Promise<void> | null): void {
  activeBootstrapPromise = promise;
}

/**
 * 진행 중인 인증/게스트 부트스트랩이 완료될 때까지 대기합니다.
 * 이미 완료되었거나 진행 중인 부트스트랩이 없으면 즉시 resolve됩니다.
 */
export async function waitForAuthBootstrap(): Promise<void> {
  if (activeBootstrapPromise) {
    await activeBootstrapPromise.catch(() => undefined);
  }
}
