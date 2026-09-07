// A small, clean Markdown renderer: headings, paragraphs, ordered & unordered
// lists (with nesting), **bold**, and `code`. Tuned so AI answers read tight and
// scannable, not like a run-on data dump.

type Node = { indent: number; ordered: boolean; text: string; children: Node[] };

const LIST_RE = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");
    if (!line.trim()) { i++; continue; }

    // heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl === 1 ? "text-[15px] font-semibold" : "text-sm font-semibold";
      blocks.push(<div key={key++} className={`mb-1 mt-3 text-ink-900 ${cls}`}>{inline(h[2])}</div>);
      i++;
      continue;
    }

    // list run (consecutive list lines, blanks between allowed)
    if (LIST_RE.test(line)) {
      const run: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (LIST_RE.test(l)) { run.push(l); i++; continue; }
        if (!l.trim() && i + 1 < lines.length && LIST_RE.test(lines[i + 1])) { i++; continue; }
        break;
      }
      blocks.push(<div key={key++}>{renderList(run)}</div>);
      continue;
    }

    // a whole line that's just a bold label → subheading
    const boldOnly = line.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) {
      blocks.push(<div key={key++} className="mb-0.5 mt-2.5 text-sm font-semibold text-ink-900">{inline(boldOnly[1])}</div>);
      i++;
      continue;
    }

    blocks.push(<p key={key++} className="my-1.5 leading-relaxed">{inline(line)}</p>);
    i++;
  }

  return <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>;
}

function renderList(run: string[]): JSX.Element | null {
  const items = run.map((l) => {
    const m = l.match(LIST_RE)!;
    const indent = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    return { indent, ordered: /\d/.test(m[2]), text: m[3], children: [] as Node[] };
  });
  const [tree] = build(items, 0, Math.min(...items.map((x) => x.indent)));
  return renderNodes(tree);
}

function build(items: Node[], start: number, level: number): [Node[], number] {
  const nodes: Node[] = [];
  let i = start;
  while (i < items.length) {
    const it = items[i];
    if (it.indent < level) break;
    if (it.indent > level) { i++; continue; }
    const node: Node = { ...it, children: [] };
    let j = i + 1;
    if (j < items.length && items[j].indent > level) {
      const [kids, next] = build(items, j, items[j].indent);
      node.children = kids;
      j = next;
    }
    nodes.push(node);
    i = j;
  }
  return [nodes, i];
}

function renderNodes(nodes: Node[]): JSX.Element | null {
  if (!nodes.length) return null;
  const ordered = nodes[0].ordered;
  const Tag: any = ordered ? "ol" : "ul";
  return (
    <Tag className="my-1.5 space-y-1">
      {nodes.map((n, i) => (
        <li key={i} className="flex gap-2">
          {ordered ? (
            <span className="mono mt-px w-4 shrink-0 text-right text-xs text-ink-400">{i + 1}.</span>
          ) : (
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400" />
          )}
          <span className="min-w-0 flex-1">
            {inline(n.text)}
            {n.children.length ? renderNodes(n.children) : null}
          </span>
        </li>
      ))}
    </Tag>
  );
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
