import { Text, View } from "@react-pdf/renderer";
// Type-only: @react-pdf/types ships with @react-pdf/renderer
import type { Style } from "@react-pdf/types";

// Hebrew in @react-pdf/renderer — rules learned the hard way (verified by
// rendering mixed Hebrew/English/number paragraphs):
//   • `direction: "rtl"` must sit on every <Text> itself; it is not inherited
//     from the Page. Without it, a wrapped line holding an English word or a
//     number comes out with its Hebrew halves swapped.
//   • A "\n" inside a <Text> corrupts the bidi reordering of that line
//     (letters vanish / wrong glyphs). Split on newlines and render one <Text>
//     per line instead.

export const rtlBase: Style = { direction: "rtl", textAlign: "right" };

/** One right-to-left line (no newlines inside). */
export function RText({ children, style }: { children: string; style?: Style | Style[] }) {
  const extra = Array.isArray(style) ? style : style ? [style] : [];
  return <Text style={[rtlBase, ...extra]}>{children.replace(/\s*\n\s*/g, " ")}</Text>;
}

/** Multi-line right-to-left text: each line of the source is its own <Text>;
 *  blank lines keep their space. */
export function RParagraphs({
  text,
  style,
  gap = 0,
}: {
  text: string;
  style?: Style;
  gap?: number;
}) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return (
    <View>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={[rtlBase, ...(style ? [style] : []), ...(gap && i > 0 ? [{ marginTop: gap }] : [])]}
        >
          {line.trim() ? line : " "}
        </Text>
      ))}
    </View>
  );
}
