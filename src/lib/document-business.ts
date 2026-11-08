// The business details printed on a document, from the User row, in one place
// for the preview (form, document page, settings) and the draft PDF.

import { documentLogo } from "@/lib/branding";
import { docLook, type DocLook } from "@/lib/document-look";

export type DocBusiness = {
  name: string;
  /** "עיסוק / מקצוע" */
  occupation: string | null;
  /** the one-line description under the name */
  description: string | null;
  businessId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  vatLiable: boolean;
  /** Settings → מיתוג, when "גם בראש מסמכי ההכנסות" is ticked */
  logoUrl?: string | null;
  /** Settings → הגדרות מסמכים → חתימה */
  signatureUrl?: string | null;
  look?: DocLook;
};

export const DOC_BUSINESS_SELECT = {
  name: true,
  businessName: true,
  businessId: true,
  address: true,
  phone: true,
  vatLiable: true,
  logoUrl: true,
  logoOnDocuments: true,
  occupation: true,
  businessDescription: true,
  docEmail: true,
  website: true,
  signatureUrl: true,
  docTemplate: true,
  docColor: true,
} as const;

type BusinessRow = {
  name: string;
  businessName: string | null;
  businessId: string | null;
  address: string | null;
  phone: string | null;
  vatLiable: boolean;
  logoUrl: string | null;
  logoOnDocuments: boolean;
  occupation: string | null;
  businessDescription: string | null;
  docEmail: string | null;
  website: string | null;
  signatureUrl: string | null;
  docTemplate: string;
  docColor: string;
};

export function docBusiness(u: BusinessRow | null): DocBusiness {
  return {
    name: u?.businessName || u?.name || "",
    occupation: u?.occupation ?? null,
    description: u?.businessDescription ?? null,
    businessId: u?.businessId ?? null,
    address: u?.address ?? null,
    phone: u?.phone ?? null,
    email: u?.docEmail ?? null,
    website: u?.website ?? null,
    vatLiable: !!u?.vatLiable,
    logoUrl: u ? documentLogo(u) : null,
    signatureUrl: u?.signatureUrl ?? null,
    look: u ? docLook(u) : undefined,
  };
}
