"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 브라우저의 실시간 네트워크 연결 상태(`online` / `offline`)를 감지하는 훅입니다.
 *
 * Next.js SSR Hydration Mismatch를 방지하기 위해 초기 상태는 항상 `true`로 두고,
 * 클라이언트 마운트 이후 `useEffect` 내부에서만 `navigator.onLine` 및 이벤트를 구독합니다.
 *
 * @returns 현재 온라인 상태(`isOnline`) 및 수동 재확인 콜백(`recheckConnection`)
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const syncOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    syncOnlineStatus();
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);

    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  const recheckConnection = useCallback(() => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
      return navigator.onLine;
    }
    return true;
  }, []);

  return { isOnline, recheckConnection };
}
