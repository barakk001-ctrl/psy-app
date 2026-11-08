import { requireDocumentsPage } from "@/lib/features-server";

// Documents are hidden until the app can issue them (src/lib/features.ts):
// every page under here redirects to /dashboard while DOCUMENTS_ENABLED isn't
// "true". Each page checks again itself, because a layout isn't re-rendered
// when moving between its pages.
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  requireDocumentsPage();
  return children;
}
