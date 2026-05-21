/** Lite markdown → HTML.
 *  Supports: ## headings, **bold**, *italic*, `code`, - bullets,
 *  numbered lists, --- hr, paragraphs. */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

function inlineMd(s: string): string {
  let out = s.replace(/[&<>]/g, c => ESC[c])
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
  return out
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const ln = lines[i]
    const h = ln.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`)
      i++; continue
    }
    if (/^-{3,}$/.test(ln.trim())) { out.push('<hr/>'); i++; continue }

    if (/^\s*[-*+]\s+/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }
    if (/^\s*\d+[\.)]\s+/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[\.)]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\s*\d+[\.)]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }
    if (!ln.trim()) { i++; continue }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|\s*[-*+]\s|\s*\d+[\.)]\s|-{3,}$)/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    out.push(`<p>${inlineMd(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

/** Persona-color rotation. Five E01-tone hues — restrained, monitor-style. */
const PERSONA_PALETTE = [
  'hsl(168 36% 56%)',  // teal-green (matches --accent)
  'hsl(38  52% 58%)',  // ochre / orange
  'hsl(202 44% 60%)',  // soft cyan
  'hsl(266 32% 66%)',  // muted violet
  'hsl(348 38% 62%)',  // dusty red
]

export function colorForIdx(i: number): string {
  return PERSONA_PALETTE[i % PERSONA_PALETTE.length]
}
