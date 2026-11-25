import { ansiSegments } from "../shared/ansi";
export function AnsiText({ text }: { text: string }) {
  return (
    <>
      {ansiSegments(text).map(({ text, ...style }, index) => (
        <span key={index} style={style}>
          {text}
        </span>
      ))}
    </>
  );
}
