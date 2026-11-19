import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Ideamory Android 하이브리드 앱(Capacitor) 설정입니다.
 *
 * - 실기기 테스트 시 `CAPACITOR_SERVER_URL=http://<PC-LAN-IP>:3000` 환경변수를 지정하면
 *   로컬 Next.js 개발 서버를 웹뷰에서 즉시 로드해 핫 리로드 및 로컬 API 테스트를 수행할 수 있습니다.
 * - 프로덕션 배포 시에는 Vercel 프로덕션 URL 또는 정적 번들(`out`)을 바라보도록 구성합니다.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.ideamory.app",
  appName: "Ideamory",
  webDir: "out",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: true,
        },
      }
    : {}),
  android: {
    allowMixedContent: true,
    backgroundColor: "#020B18",
  },
};

export default config;
