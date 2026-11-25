export interface AnsiSegment {
  text: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: number;
  fontStyle?: string;
  textDecoration?: string;
  opacity?: number;
}
const palette = [
  "#303036",
  "#e87071",
  "#85bc89",
  "#d8bb78",
  "#79a9e8",
  "#bd95d8",
  "#76bcbc",
  "#d4d4d4",
  "#808087",
  "#f49192",
  "#a3d9a5",
  "#f1d594",
  "#a0c2f3",
  "#d1b1ed",
  "#9adddd",
  "#ffffff",
];
function color(code: number) {
  if (code < 16) return palette[code];
  if (code >= 232)
    return `rgb(${8 + (code - 232) * 10}, ${8 + (code - 232) * 10}, ${8 + (code - 232) * 10})`;
  const n = code - 16;
  const scale = [0, 95, 135, 175, 215, 255];
  return `rgb(${scale[Math.floor(n / 36)]}, ${scale[Math.floor(n / 6) % 6]}, ${scale[n % 6]})`;
}
/** SGR only. OSC, cursor and other control sequences never become HTML or links. */
export function ansiSegments(input: string): AnsiSegment[] {
  const text = input
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[(?![\d;]*m)[\d;?]*[ -/]*[@-~]/g, "")
    .replace(/[^\n]*\r(?!\n)/g, "")
    .replace(/\r/g, "")
    .replace(/[\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]/g, "");
  const parts: AnsiSegment[] = [];
  let style: Omit<AnsiSegment, "text"> = {};
  let start = 0;
  for (const match of text.matchAll(/\x1b\[([\d;]*)m/g)) {
    if (match.index! > start)
      parts.push({ text: text.slice(start, match.index), ...style });
    const codes = (match[1] || "0").split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const n = codes[i]!;
      if (n === 0) style = {};
      else if (n === 1) style.fontWeight = 700;
      else if (n === 2) style.opacity = 0.65;
      else if (n === 3) style.fontStyle = "italic";
      else if (n === 4) style.textDecoration = "underline";
      else if (n === 9) style.textDecoration = "line-through";
      else if (n === 22) {
        delete style.fontWeight;
        delete style.opacity;
      } else if (n === 23) delete style.fontStyle;
      else if (n === 24 || n === 29) delete style.textDecoration;
      else if (n === 39) delete style.color;
      else if (n === 49) delete style.backgroundColor;
      else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97))
        style.color = palette[n >= 90 ? n - 90 + 8 : n - 30];
      else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107))
        style.backgroundColor = palette[n >= 100 ? n - 100 + 8 : n - 40];
      else if (n === 38 || n === 48) {
        const key = n === 38 ? "color" : "backgroundColor";
        if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
          style[key] = color(Math.min(255, Math.max(0, codes[i + 2]!)));
          i += 2;
        } else if (codes[i + 1] === 2 && codes.length > i + 4) {
          style[key] = `rgb(${codes
            .slice(i + 2, i + 5)
            .map((x) => Math.min(255, Math.max(0, x)))
            .join(", ")})`;
          i += 4;
        }
      }
    }
    start = match.index! + match[0].length;
  }
  if (start < text.length)
    parts.push({ text: text.slice(start).replace(/\x1b/g, ""), ...style });
  return parts;
}
