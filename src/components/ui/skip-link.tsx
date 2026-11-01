/** First stop for keyboard users: jumps past the navigation. Shown on focus. */
export function SkipLink({ target = "main-content" }: { target?: string }) {
  return (
    <a href={`#${target}`} className="skip-link">
      דילוג לתוכן הראשי
    </a>
  );
}
