"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/features/auth-drawer";
import { dismissAndroidNativeSplash } from "@/shared/lib/native-bridge";

const SPLASH_FALLBACK_DELAY_MS = 300;

/**
 * 0.1초 퀵 캡처 철학을 준수하기 위한 조건부 스플래시 스크린 위젯입니다.
 *
 * [설계 원리]
 * - **정상 진입 (Fast-Path — 0ms 스킵)**: 마운트 즉시 `dismissAndroidNativeSplash()`를 호출하고
 *   `300ms` 이내에 초기 세션 부트스트랩(`isBootstrapped`)이 완료되면 스플래시를 아예 띄우지 않습니다.
 * - **백엔드 지연/콜드스타트 시 (Fallback)**: `300ms`가 지나도록 응답이 오지 않을 때만
 *   화이트아웃을 방지하기 위해 Ideamory 앱 아이콘 기반 미니멀 스플래시를 잠시 노출합니다.
 *
 * @returns 조건부 스플래시 오버레이 JSX (정상 Fast-Path 시 null)
 */
export function ConditionalSplash() {
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const [delayThresholdPassed, setDelayThresholdPassed] = useState(false);

  useEffect(() => {
    // 네이티브 스플래시가 고정 1~2초를 잡아먹지 않도록 웹 마운트 즉시 닫음
    dismissAndroidNativeSplash();
  }, []);

  useEffect(() => {
    if (isBootstrapped) {
      setDelayThresholdPassed(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setDelayThresholdPassed(true);
    }, SPLASH_FALLBACK_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [isBootstrapped]);

  if (isBootstrapped || !delayThresholdPassed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Ideamory 연결 중"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background:
          "radial-gradient(circle at 50% 38%, rgba(229, 169, 92, 0.12), transparent 52%), #121110",
      }}
    >
      <img
        src="/ideamory-app-icon.jpg"
        alt="Ideamory 앱 아이콘"
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          objectFit: "cover",
          border: "1px solid rgba(229, 169, 92, 0.28)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.48)",
        }}
      />
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            margin: 0,
            color: "#F4EFEA",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.22em",
          }}
        >
          IDEAMORY
        </p>
        <p
          style={{
            margin: "8px 0 0",
            color: "#A69D93",
            fontSize: 12,
          }}
        >
          기억 공간을 준비하고 있습니다...
        </p>
      </div>
    </div>
  );
}
