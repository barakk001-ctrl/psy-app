import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { inviteOnly } from "@/lib/signup-policy";
import { documentsEnabled } from "@/lib/features";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

// The public home. Signed-in users never reach this: the middleware sends them
// to /dashboard (gateRequest). The installed app starts at /dashboard, not here
// (manifest.ts), so a signed-out app still lands on the login page.
// Dynamic because inviteOnly() reads the environment at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "he_IL",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE] },
};

export default function Home() {
  return <LandingPage byInvite={inviteOnly()} documents={documentsEnabled()} />;
}
