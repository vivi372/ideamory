"use client";

import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/shared/lib/network/use-network-status";

interface OfflineBoundaryProps {
  children: ReactNode;
}

/**
 * 네트워크 단절(`navigator.onLine === false`) 감지 시 웹뷰 기본 에러 페이지(공룡 화면 등) 대신
 * Ideamory 브랜드 톤앤매너에 맞춘 미니멀 오프라인 안내 화면과 `[다시 시도]` 버튼을 노출합니다.
 *
 * @param props 온라인 상태에서 렌더링할 하위 트리
 * @returns 오프라인 안내 뷰 또는 정상 하위 트리 JSX
 */
export function OfflineBoundary({ children }: OfflineBoundaryProps) {
  const { isOnline, recheckConnection } = useNetworkStatus();
  const queryClient = useQueryClient();

  if (isOnline) {
    return <>{children}</>;
  }

  const handleRetry = () => {
    const online = recheckConnection();
    if (online) {
      void queryClient.invalidateQueries();
    }
  };

  return (
    <main
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        background:
          "radial-gradient(circle at 50% 35%, rgba(39, 215, 242, 0.1), transparent 55%), #020B18",
        color: "#EAFBFF",
      }}
    >
      <div
        style={{
          position: "relative",
          marginBottom: 22,
          display: "grid",
          placeItems: "center",
        }}
      >
        <img
          src="/ideamory-app-icon.jpg"
          alt="Ideamory 로고"
          style={{
            width: 84,
            height: 84,
            borderRadius: 22,
            objectFit: "cover",
            opacity: 0.45,
            border: "1px solid rgba(56, 189, 248, 0.25)",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: -8,
            bottom: -8,
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: "#0A2744",
            border: "1px solid rgba(39, 215, 242, 0.4)",
            color: "#27D7F2",
          }}
        >
          <WifiOff size={16} aria-hidden="true" />
        </span>
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#EAFBFF",
        }}
      >
        인터넷 연결이 원활하지 않습니다
      </h1>
      <p
        style={{
          margin: "10px 0 26px",
          maxWidth: 300,
          fontSize: 13,
          lineHeight: 1.65,
          color: "#94A3B8",
        }}
      >
        Wi-Fi 또는 모바일 데이터 연결 상태를 확인한 뒤 다시 시도해 주세요.
      </p>

      <button
        type="button"
        onClick={handleRetry}
        style={{
          height: 44,
          padding: "0 22px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(39, 215, 242, 0.4)",
          borderRadius: 999,
          background: "linear-gradient(135deg, #27D7F2, #12E7F5)",
          color: "#03172E",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 8px 24px rgba(39, 215, 242, 0.24)",
        }}
      >
        <RefreshCw size={15} aria-hidden="true" />
        <span>다시 시도</span>
      </button>
    </main>
  );
}
