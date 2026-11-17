/**
 * FSD `features/auth-drawer` Public API Barrel Export
 */
export { SidebarDrawer } from "./ui/sidebar-drawer";
export { SocialLinkModal } from "./ui/social-link-modal";
export { LegalWebviewModal } from "./ui/legal-webview-modal";
export { AccountSection } from "./ui/account-section";
export { useGuestBootstrap } from "./hooks/use-guest-bootstrap";
export { useAuthDrawer } from "./hooks/use-auth-drawer";
export {
  getAccountStatusLabel,
  useAuthStore,
  type LegalDocumentType,
  type SocialProvider,
} from "./model/auth-store";
