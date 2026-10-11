"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  FileText,
  Home,
  Lightbulb,
  MessageCircle,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_ARTICLES, POPULAR_HELP_SLUGS, helpArticleBySlug } from "@/lib/help-articles";
import { indexArticles, searchHelp, type HelpArticle, type HelpBlock } from "@/lib/help-search";
import { SupportForm, type SupportUser } from "./support-form";

type Tab = "home" | "articles" | "contact";

const RECENT_KEY = "help.recent";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((s): s is string => typeof s === "string" && !!helpArticleBySlug(s)).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // private mode / blocked storage: the list is a convenience only
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Help & support: a round "?" button on every signed-in page, opening a panel
 * with how-to articles (searchable) and the "פנייה לתמיכה" form. A side drawer
 * on desktop, a full-height sheet on phones. Focus is trapped while open; Esc
 * closes it and returns focus to the button.
 */
export function HelpWidget({ user }: { user: SupportUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [articleSlug, setArticleSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  const index = useMemo(() => indexArticles(HELP_ARTICLES), []);
  const results = useMemo(() => searchHelp(query, index), [query, index]);
  const article = articleSlug ? helpArticleBySlug(articleSlug) : undefined;

  const close = useCallback(() => setOpen(false), []);

  // Leaving the page (e.g. an article's link) closes the panel
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Same as the tab bar: iOS drags fixed elements along with the keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOpen(window.innerHeight - vv.height > 120);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Open: remember recent articles, lock the page scroll, focus the panel.
  // Close: give focus back to the "?" button.
  useEffect(() => {
    if (open) {
      setRecent(readRecent());
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      panelRef.current?.focus();
      wasOpen.current = true;
      return () => {
        document.body.style.overflow = prev;
      };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      fabRef.current?.focus();
    }
  }, [open]);

  // New view → back to the top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab, articleSlug]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openArticle(slug: string) {
    setArticleSlug(slug);
    const next = [slug, ...readRecent().filter((s) => s !== slug)].slice(0, RECENT_MAX);
    writeRecent(next);
    setRecent(next);
  }

  function goTab(next: Tab) {
    setTab(next);
    setArticleSlug(null);
  }

  const heading = article
    ? article.category
    : tab === "contact"
      ? "פנייה לתמיכה"
      : tab === "articles"
        ? "מאמרי עזרה"
        : "עזרה ותמיכה";

  const firstName = user.name.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="עזרה ותמיכה"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="עזרה ותמיכה"
        className={cn(
          "help-fab fixed z-[35] print:hidden",
          "w-12 h-12 rounded-full flex items-center justify-center",
          "bg-gradient-to-b from-sage-500 to-sage-600 text-cream-50 shadow-glow ring-4 ring-cream-50/70",
          "font-display text-2xl leading-none",
          "transition-all duration-200 hover:from-sage-600 hover:to-sage-700 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-sage-300",
          // Not hidden while the panel is open (the panel covers it) — an
          // invisible button can't take focus back when the panel closes
          keyboardOpen && !open && "invisible opacity-0",
        )}
      >
        <span aria-hidden>?</span>
      </button>

      {/* Stays mounted while closed, so a half-written support request survives */}
      <div className="fixed inset-0 z-[60] print:hidden" hidden={!open}>
        <div
          className="help-backdrop absolute inset-0 bg-ink/30 backdrop-blur-[2px] hidden lg:block"
          onClick={close}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            "help-panel absolute flex flex-col bg-cream-50 outline-none",
            "inset-0 lg:inset-auto lg:top-0 lg:bottom-0 lg:w-[26rem] lg:rounded-r-3xl lg:shadow-lift lg:border-r lg:border-cream-200",
          )}
          style={{ left: 0 }}
        >
          {/* Header */}
          <div
            className="shrink-0 bg-gradient-to-bl from-sage-500 to-sage-700 text-cream-50 lg:rounded-tr-3xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="flex items-center gap-2 px-3 h-14">
              {article ? (
                <button
                  type="button"
                  onClick={() => setArticleSlug(null)}
                  className="p-2 rounded-xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50"
                  aria-label="חזרה"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-display text-lg" aria-hidden>
                  ?
                </span>
              )}
              <h2 id={titleId} className="flex-1 font-display text-lg truncate">
                {heading}
              </h2>
              <button
                type="button"
                onClick={close}
                className="p-2 rounded-xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50"
                aria-label="סגירת חלון העזרה"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            {article ? (
              <ArticleView article={article} onContact={() => goTab("contact")} onNavigate={close} />
            ) : (
              <>
                {tab === "home" && (
                  <div className="p-4 space-y-5">
                    <div>
                      <p className="font-display text-xl text-ink">
                        שלום{firstName ? ` ${firstName}` : ""}, איך אפשר לעזור?
                      </p>
                      <p className="text-sm text-ink-muted mt-1">
                        חיפוש במדריכים הקצרים, או פנייה ישירה אלינו.
                      </p>
                    </div>
                    <SearchBox value={query} onChange={setQuery} />
                    {query.trim() ? (
                      <ArticleList
                        title="תוצאות חיפוש"
                        articles={results}
                        onOpen={openArticle}
                        empty="לא נמצאו מאמרים. אפשר לנסח אחרת, או לשלוח לנו פנייה."
                      />
                    ) : (
                      <>
                        {recent.length > 0 && (
                          <ArticleList
                            title="נצפו לאחרונה"
                            articles={recent.map(helpArticleBySlug).filter((a): a is HelpArticle => !!a)}
                            onOpen={openArticle}
                          />
                        )}
                        <ArticleList
                          title="מאמרים מומלצים"
                          articles={POPULAR_HELP_SLUGS.map(helpArticleBySlug).filter(
                            (a): a is HelpArticle => !!a && !recent.includes(a.slug),
                          )}
                          onOpen={openArticle}
                        />
                      </>
                    )}
                    <ContactPrompt onContact={() => goTab("contact")} />
                  </div>
                )}

                {tab === "articles" && (
                  <div className="p-4 space-y-5">
                    <SearchBox value={query} onChange={setQuery} />
                    {query.trim() ? (
                      <ArticleList
                        title="תוצאות חיפוש"
                        articles={results}
                        onOpen={openArticle}
                        empty="לא נמצאו מאמרים. אפשר לנסח אחרת, או לשלוח לנו פנייה."
                      />
                    ) : (
                      groupByCategory(HELP_ARTICLES).map(([category, list]) => (
                        <ArticleList key={category} title={category} articles={list} onOpen={openArticle} />
                      ))
                    )}
                  </div>
                )}

                {/* Kept mounted so switching tabs doesn't lose what was typed */}
                <div className="p-4" hidden={tab !== "contact"}>
                  <p className="text-sm text-ink-muted mb-4">
                    משהו לא עובד, או שיש לך שאלה או רעיון? כתבי לנו ונחזור אלייך במייל.
                  </p>
                  <SupportForm
                    key={formKey}
                    user={user}
                    pagePath={pathname}
                    onDone={() => setFormKey((k) => k + 1)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Bottom tabs */}
          <nav
            className="shrink-0 border-t border-cream-200 bg-white/80 lg:rounded-br-3xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="אזורי העזרה"
          >
            <ul className="flex px-2 py-1.5">
              {(
                [
                  { id: "home", label: "בית", icon: Home },
                  { id: "articles", label: "מאמרי עזרה", icon: BookOpen },
                  { id: "contact", label: "פנייה לתמיכה", icon: MessageCircle },
                ] as const
              ).map((t) => {
                const active = tab === t.id && !article;
                const Icon = t.icon;
                return (
                  <li key={t.id} className="flex-1">
                    <button
                      type="button"
                      onClick={() => goTab(t.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "w-full flex flex-col items-center gap-0.5 py-1.5 rounded-2xl text-[11px] transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500",
                        active ? "bg-sage-100 text-sage-700 font-medium" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}

function groupByCategory(articles: HelpArticle[]): [string, HelpArticle[]][] {
  const map = new Map<string, HelpArticle[]>();
  for (const a of articles) map.set(a.category, [...(map.get(a.category) ?? []), a]);
  return [...map.entries()];
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-ink-subtle pointer-events-none" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="חיפוש, למשל: קבלה, פגישה קבועה, סיכום"
        aria-label="חיפוש במאמרי העזרה"
        className={cn(
          "w-full h-11 pr-10 pl-3.5 rounded-xl border border-cream-300 bg-white text-ink placeholder:text-ink-subtle",
          "focus:border-sage-500 focus:outline-none focus:ring-4 focus:ring-sage-500/15",
        )}
      />
    </div>
  );
}

function ArticleList({
  title,
  articles,
  onOpen,
  empty,
}: {
  title: string;
  articles: HelpArticle[];
  onOpen: (slug: string) => void;
  empty?: string;
}) {
  if (articles.length === 0 && !empty) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold text-ink-muted tracking-wide mb-2">{title}</h3>
      {articles.length === 0 ? (
        <p className="text-sm text-ink-muted bg-white/70 rounded-xl border border-cream-200 px-3 py-3">{empty}</p>
      ) : (
        <ul className="rounded-2xl bg-white/80 border border-cream-200 divide-y divide-cream-200 overflow-hidden">
          {articles.map((a) => (
            <li key={a.slug}>
              <button
                type="button"
                onClick={() => onOpen(a.slug)}
                className="w-full flex items-center gap-3 px-3 py-3 text-start hover:bg-sage-50 focus-visible:outline-none focus-visible:bg-sage-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage-500"
              >
                <span className="w-8 h-8 shrink-0 rounded-lg bg-sage-50 text-sage-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" aria-hidden />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink">{a.title}</span>
                  <span className="block text-xs text-ink-muted truncate">{a.summary}</span>
                </span>
                <ChevronLeft className="w-4 h-4 text-ink-subtle shrink-0" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactPrompt({ onContact }: { onContact: () => void }) {
  return (
    <div className="rounded-2xl border border-sage-100 bg-sage-50 p-4 flex items-center gap-3">
      <MessageCircle className="w-6 h-6 text-sage-600 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium text-ink">לא מצאת תשובה?</p>
        <p className="text-xs text-ink-muted">שלחי לנו פנייה ונחזור אלייך.</p>
      </div>
      <button
        type="button"
        onClick={onContact}
        className="text-sm font-medium rounded-xl bg-sage-600 text-cream-50 px-3 py-2 hover:bg-sage-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2"
      >
        פנייה לתמיכה
      </button>
    </div>
  );
}

function ArticleView({
  article,
  onContact,
  onNavigate,
}: {
  article: HelpArticle;
  onContact: () => void;
  onNavigate: () => void;
}) {
  return (
    <article className="p-4 space-y-4">
      <div>
        <h3 className="font-display text-2xl text-ink leading-snug">{article.title}</h3>
        <p className="text-sm text-ink-muted mt-1">{article.summary}</p>
      </div>
      {article.body.map((block, i) => (
        <Block key={i} block={block} onNavigate={onNavigate} />
      ))}
      <div className="pt-2">
        <ContactPrompt onContact={onContact} />
      </div>
    </article>
  );
}

function Block({ block, onNavigate }: { block: HelpBlock; onNavigate: () => void }) {
  switch (block.type) {
    case "p":
      return <p className="text-[15px] text-ink-soft leading-relaxed">{block.text}</p>;
    case "steps":
      return (
        <ol className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-sage-600 text-cream-50 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-[15px] text-ink-soft leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-sage-500 mt-2.5" aria-hidden />
              <span className="text-[15px] text-ink-soft leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="flex gap-2.5 rounded-xl bg-cream-100 border border-cream-300 p-3">
          <Lightbulb className="w-4 h-4 text-terracotta-500 shrink-0 mt-1" aria-hidden />
          <p className="text-sm text-ink-soft leading-relaxed">{block.text}</p>
        </div>
      );
    case "link":
      return (
        <Link
          href={block.href}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 rounded"
        >
          {block.label}
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </Link>
      );
  }
}
