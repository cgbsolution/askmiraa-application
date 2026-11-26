/**
 * Convert one spot's static SVG (React's markup) into react-native-svg JSX
 * lines. Used by build.mjs (writes the app's drawings) and check.mjs
 * (validates a candidate without writing anything).
 *
 * Spots may use rect, circle, path, ellipse and g, the five tones and the
 * cut — nothing else, so every drawing renders the same on a phone as on the
 * website.
 */

export const TAGS = { rect: 'Rect', circle: 'Circle', path: 'Path', ellipse: 'Ellipse', g: 'G' };
const TONES = { 'var(--spot-d)': 'c.d', 'var(--spot-r)': 'c.r', 'var(--spot-p)': 'c.p', 'var(--spot-m)': 'c.m', 'var(--spot-w)': 'c.w', 'var(--spot-bg)': 'c.bg' };
const DROP = new Set(['class', 'aria-hidden', 'focusable', 'paint-order']);
const GEOMETRY = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'd', 'transform']);

function camel(name) {
  return name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/** A tiny parser for React's static SVG: tags, double-quoted attributes, nesting. */
export function parse(svg) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const tagPattern = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let match;
  while ((match = tagPattern.exec(svg))) {
    const [, closing, tag, rawAttrs, selfClosing] = match;
    if (closing) {
      const open = stack.pop();
      if (open.tag !== tag) throw new Error(`Unbalanced <${open.tag}> … </${tag}>`);
      continue;
    }
    const attrs = {};
    for (const [, name, value] of rawAttrs.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"/g)) attrs[name] = value;
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1) throw new Error('Unclosed tags in the SVG');
  const [svgNode] = root.children;
  if (!svgNode || svgNode.tag !== 'svg' || svgNode.attrs.viewBox !== '0 0 48 48') throw new Error('Expected one 48×48 <svg>');
  return svgNode.children;
}

function value(name, raw) {
  if (TONES[raw]) return `{${TONES[raw]}}`;
  if (raw.startsWith('var(')) throw new Error(`Unknown tone ${raw}`);
  if (name !== 'd' && name !== 'transform' && /^-?(\d+\.?\d*|\.\d+)$/.test(raw)) return `{${Number(raw)}}`;
  return JSON.stringify(raw);
}

function props(attrs) {
  return Object.entries(attrs)
    .filter(([name]) => !DROP.has(name))
    .map(([name, raw]) => `${camel(name)}=${value(name, raw)}`)
    .join(' ');
}

export function emit(node, indent) {
  const tag = TAGS[node.tag];
  if (!tag) throw new Error(`Spots may only use rect, circle, path, ellipse and g — not <${node.tag}>`);
  const pad = ' '.repeat(indent);
  if (node.tag === 'g') {
    const groupProps = props(node.attrs);
    // A group React only used for a list key adds nothing: draw its children in place.
    if (!groupProps) return node.children.flatMap((child) => emit(child, indent));
    return [`${pad}<G ${groupProps}>`, ...node.children.flatMap((child) => emit(child, indent + 2)), `${pad}</G>`];
  }
  const { attrs } = node;
  if (attrs['paint-order'] === 'stroke') {
    // The cut: the outline first, then the shape's fill over its inner half.
    if (attrs.stroke !== 'var(--spot-bg)') throw new Error('A cut must be in the tile colour');
    const geometry = Object.fromEntries(Object.entries(attrs).filter(([name]) => GEOMETRY.has(name) || name === 'opacity'));
    const outline = { ...geometry, fill: 'none', stroke: attrs.stroke, 'stroke-width': attrs['stroke-width'], 'stroke-linejoin': attrs['stroke-linejoin'] ?? 'round' };
    const fill = Object.fromEntries(Object.entries(attrs).filter(([name]) => !name.startsWith('stroke') && name !== 'paint-order'));
    return [`${pad}<${tag} ${props(outline)} />`, `${pad}<${tag} ${props(fill)} />`];
  }
  return [`${pad}<${tag} ${props(attrs)} />`];
}
