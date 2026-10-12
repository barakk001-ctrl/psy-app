import { beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  MAX_DOCUMENT_BYTES,
  canViewInline,
  checkDocument,
  contentDisposition,
  documentFileName,
  documentMetaError,
  documentResponseHeaders,
  parseCategory,
  renamedFileName,
  sniffDocumentType,
} from "../client-documents";
import type { ServeDeps } from "../client-document-serve";

beforeAll(() => {
  process.env.NOTES_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === "string" ? Array.from(Buffer.from(p, "latin1")) : p)),
  );

const PDF = bytes("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
const PDF_WITH_JUNK = bytes("\r\n\r\n", "%PDF-1.4\n");
const DOCX = bytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0], "[Content_Types].xml....word/document.xml....");
const DOCM = bytes([0x50, 0x4b, 0x03, 0x04], "word/document.xml...word/vbaProject.bin");
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04], "photos/one.jpg");
const DOC = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10], "JFIF");
const PNG = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const HEIC = bytes([0, 0, 0, 0x18], "ftypheic", [0, 0, 0, 0]);
const GIF = bytes("GIF89a....");
const EXE = bytes("MZ", [0x90, 0, 3, 0]);
const HTML = bytes("<!doctype html><script>alert(1)</script>");

describe("sniffDocumentType — the bytes decide", () => {
  it("recognises every accepted type", () => {
    expect(sniffDocumentType(PDF)).toBe("application/pdf");
    expect(sniffDocumentType(PDF_WITH_JUNK)).toBe("application/pdf");
    expect(sniffDocumentType(DOCX)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(sniffDocumentType(DOC)).toBe("application/msword");
    expect(sniffDocumentType(JPEG)).toBe("image/jpeg");
    expect(sniffDocumentType(PNG)).toBe("image/png");
    expect(sniffDocumentType(HEIC)).toBe("image/heic");
  });

  it("refuses everything else", () => {
    expect(sniffDocumentType(EXE)).toBeNull();
    expect(sniffDocumentType(HTML)).toBeNull();
    expect(sniffDocumentType(GIF)).toBeNull();
    expect(sniffDocumentType(ZIP)).toBeNull(); // a ZIP that isn't a Word file
    expect(sniffDocumentType(DOCM)).toBeNull(); // macros
    expect(sniffDocumentType(new Uint8Array())).toBeNull();
  });
});

describe("documentMetaError — name and size", () => {
  it("enforces the size limit", () => {
    expect(documentMetaError({ name: "a.pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
    expect(documentMetaError({ name: "a.pdf", size: MAX_DOCUMENT_BYTES + 1 })).toContain("15MB");
    expect(documentMetaError({ name: "a.pdf", size: 0 })).toBe("הקובץ ריק");
  });

  it("refuses unsupported extensions, leaves a missing one to the bytes", () => {
    expect(documentMetaError({ name: "virus.exe", size: 10 })).toContain("אינו נתמך");
    expect(documentMetaError({ name: "page.html", size: 10 })).toContain("אינו נתמך");
    expect(documentMetaError({ name: "תמונה.HEIC", size: 10 })).toBeNull();
    expect(documentMetaError({ name: "סריקה", size: 10 })).toBeNull();
  });
});

describe("checkDocument — the server's full check", () => {
  it("accepts a real PDF with a Hebrew name", () => {
    expect(checkDocument({ name: "מכתב הפניה.pdf", size: PDF.length }, PDF)).toEqual({
      ok: true,
      mimeType: "application/pdf",
      name: "מכתב הפניה.pdf",
    });
  });

  it("refuses a renamed executable or page, whatever the extension says", () => {
    expect(checkDocument({ name: "טופס.pdf", size: EXE.length }, EXE).ok).toBe(false);
    expect(checkDocument({ name: "טופס.docx", size: HTML.length }, HTML).ok).toBe(false);
  });

  it("fixes the extension to match the bytes", () => {
    const r = checkDocument({ name: "אבחון.docx", size: DOC.length }, DOC);
    expect(r).toMatchObject({ ok: true, mimeType: "application/msword", name: "אבחון.doc" });
    const photo = checkDocument({ name: "scan", size: JPEG.length }, JPEG);
    expect(photo).toMatchObject({ ok: true, name: "scan.jpg" });
  });

  it("refuses a file that arrived cut off", () => {
    expect(checkDocument({ name: "a.pdf", size: PDF.length + 100 }, PDF)).toMatchObject({ ok: false });
  });
});

describe("names", () => {
  it("cleans unsafe characters but keeps Hebrew", () => {
    expect(documentFileName('טופס "הסכמה"/<חתום>.pdf', "application/pdf")).toBe("טופס הסכמהחתום.pdf");
    expect(documentFileName(".pdf", "application/pdf")).toBe("מסמך.pdf");
  });

  it("renames keeping the extension", () => {
    expect(renamedFileName("הפניה מד״ר כהן", "scan.pdf")).toBe("הפניה מד״ר כהן.pdf");
    expect(renamedFileName("הפניה.pdf", "scan.pdf")).toBe("הפניה.pdf");
    expect(renamedFileName("גרסה 1.2", "scan.pdf")).toBe("גרסה 1.2.pdf");
    expect(renamedFileName("   ", "scan.pdf")).toBeNull();
  });

  it("parses categories", () => {
    expect(parseCategory("CONSENT")).toBe("CONSENT");
    expect(parseCategory("")).toBeNull();
    expect(parseCategory("HACK")).toBeNull();
  });
});

describe("download headers", () => {
  it("inline only for PDF and images", () => {
    expect(canViewInline("application/pdf")).toBe(true);
    expect(canViewInline("image/heic")).toBe(true);
    expect(canViewInline("application/msword")).toBe(false);
    expect(canViewInline("text/html")).toBe(false);
    expect(contentDisposition("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", true)).toMatch(/^attachment;/);
    expect(contentDisposition("a.pdf", "application/pdf", true)).toMatch(/^inline;/);
    expect(contentDisposition("a.pdf", "application/pdf", false)).toMatch(/^attachment;/);
  });

  it("carries the Hebrew name, with an ASCII fallback", () => {
    const h = contentDisposition("טופס הסכמה.pdf", "application/pdf", true);
    expect(h).toContain(`filename*=UTF-8''${encodeURIComponent("טופס הסכמה.pdf")}`);
    expect(h).toContain('filename="document.pdf"');
    expect(contentDisposition("אבחון 2025.docx", "application/msword", false)).toContain('filename="document.docx"');
    expect(contentDisposition("scan 1.pdf", "application/pdf", false)).toContain('filename="scan 1.pdf"');
  });

  it("sends nosniff, no caching and the real type", () => {
    const h = documentResponseHeaders({ fileName: "a.pdf", mimeType: "application/pdf", size: 5 }, true);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBe("private, no-store");
    expect(h["Content-Type"]).toBe("application/pdf");
    expect(h["Content-Length"]).toBe("5");
  });
});

describe("storage — encrypt, store, decrypt", () => {
  it("round-trips the bytes and stores only ciphertext", async () => {
    const { memoryBlobStore, saveDocumentBytes, loadDocumentBytes } = await import("../document-storage");
    const store = memoryBlobStore();
    const original = Buffer.from(PDF);
    await saveDocumentBytes(store, "doc1", original);
    const stored = await store.get("doc1");
    expect(stored).not.toBeNull();
    expect(Buffer.from(stored!.ciphertext).includes(Buffer.from("%PDF"))).toBe(false);
    expect((await loadDocumentBytes(store, "doc1"))!.equals(original)).toBe(true);
    await store.delete("doc1");
    expect(await loadDocumentBytes(store, "doc1")).toBeNull();
  });

  it("refuses tampered bytes", async () => {
    const { memoryBlobStore, saveDocumentBytes, loadDocumentBytes } = await import("../document-storage");
    const store = memoryBlobStore();
    await saveDocumentBytes(store, "doc1", Buffer.from(JPEG));
    const blob = (await store.get("doc1"))!;
    blob.ciphertext[0] ^= 0xff;
    await store.put("doc1", blob);
    await expect(loadDocumentBytes(store, "doc1")).rejects.toThrow();
  });
});

describe("serveClientDocument — only the owner", () => {
  async function setup() {
    const { memoryBlobStore, saveDocumentBytes } = await import("../document-storage");
    const { encryptSecret, decryptSecret } = await import("../crypto");
    const store = memoryBlobStore();
    const doc = {
      id: "doc1",
      userId: "keren",
      clientId: "client1",
      nameCiphertext: encryptSecret("אבחון פסיכודידקטי.pdf"),
      mimeType: "application/pdf",
    };
    await saveDocumentBytes(store, doc.id, Buffer.from(PDF));
    const findDocument = vi.fn(async (where: { id: string; userId: string }) =>
      where.id === doc.id && where.userId === doc.userId ? doc : null,
    );
    const audit = vi.fn(async () => {});
    const deps: ServeDeps = { findDocument, store, decryptName: decryptSecret, audit };
    return { deps, findDocument, audit };
  }

  it("serves the owner, decrypted, and logs the access", async () => {
    const { serveClientDocument } = await import("../client-document-serve");
    const { deps, audit } = await setup();
    const r = await serveClientDocument("keren", "doc1", "view", deps);
    expect(r.status).toBe(200);
    expect(Buffer.from(r.body as Uint8Array).equals(Buffer.from(PDF))).toBe(true);
    expect(r.headers["Content-Disposition"]).toMatch(/^inline;/);
    expect(r.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(audit).toHaveBeenCalledWith("keren", "DOCUMENT_VIEW", { clientId: "client1", documentId: "doc1" });

    const d = await serveClientDocument("keren", "doc1", "download", deps);
    expect(d.headers["Content-Disposition"]).toMatch(/^attachment;/);
    expect(audit).toHaveBeenLastCalledWith("keren", "DOCUMENT_DOWNLOAD", { clientId: "client1", documentId: "doc1" });
  });

  it("looks the document up by id AND owner; another practice gets 404", async () => {
    const { serveClientDocument } = await import("../client-document-serve");
    const { deps, findDocument, audit } = await setup();
    const r = await serveClientDocument("someone-else", "doc1", "view", deps);
    expect(findDocument).toHaveBeenCalledWith({ id: "doc1", userId: "someone-else" });
    expect(r.status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  it("401 without a signed-in user, and never touches the database", async () => {
    const { serveClientDocument } = await import("../client-document-serve");
    const { deps, findDocument } = await setup();
    expect((await serveClientDocument(null, "doc1", "view", deps)).status).toBe(401);
    expect((await serveClientDocument(undefined, "doc1", "view", deps)).status).toBe(401);
    expect(findDocument).not.toHaveBeenCalled();
  });

  it("404 when the bytes are missing", async () => {
    const { serveClientDocument } = await import("../client-document-serve");
    const { deps } = await setup();
    await deps.store.delete("doc1");
    expect((await serveClientDocument("keren", "doc1", "view", deps)).status).toBe(404);
  });
});
