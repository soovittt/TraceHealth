// Minimal, safe Markdown renderer: headings, paragraphs, bullets, **bold**, `code`.
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul${blocks.length}`} className="my-1.5 ml-1 space-y-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
              <span>{inline(li)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const cls = level === 1 ? "text-md font-semibold" : level === 2 ? "text-sm font-semibold" : "text-sm font-medium";
      blocks.push(
        <div key={`h${blocks.length}`} className={`mt-3 mb-1 text-ink-900 ${cls}`}>
          {inline(h[2])}
        </div>,
      );
    } else if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-1 leading-relaxed">{inline(line)}</p>);
    }
  }
  flush();
  return <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}

function inline(s: string): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-semibold text-ink-900">{m[1]}</strong>);
    else out.push(<code key={k++} className="mono rounded bg-line-soft px-1 text-[12px]">{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
