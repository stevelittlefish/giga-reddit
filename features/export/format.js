// Turns a captured thread into Markdown or JSON. Pure: no DOM, no chrome.*, so
// node --test can poke at it. Bodies arrive as the plain trees content.js
// builds: strings for text, { tag, children, href?, src?, alt? } for elements.

const REDDIT = 'https://www.reddit.com';

const BLOCK_TAGS = new Set([
  'p', 'div', 'blockquote', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table',
]);

/** Makes Reddit's relative links absolute. */
export function absoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return REDDIT + url;
  return url;
}

/** Converts a body tree to Markdown. */
export function bodyToMarkdown(tree) {
  if (!tree) return '';
  return tidy(blocks(tree.children));
}

// Renders a list of nodes, putting blank lines around block elements.
function blocks(nodes) {
  let out = '';
  for (const node of nodes) {
    if (typeof node !== 'string' && BLOCK_TAGS.has(node.tag)) {
      out += '\n\n' + block(node) + '\n\n';
    } else {
      out += inline(node);
    }
  }
  return out;
}

function block(node) {
  const { tag } = node;
  if (/^h[1-6]$/.test(tag)) return '#'.repeat(Number(tag[1])) + ' ' + oneLine(blocks(node.children));
  if (tag === 'hr') return '---';
  if (tag === 'pre') return '```\n' + plainText(node).replace(/\n+$/, '') + '\n```';
  if (tag === 'blockquote') return tidy(blocks(node.children)).split('\n').map(line => ('> ' + line).trimEnd()).join('\n');
  if (tag === 'ul' || tag === 'ol') return list(node);
  if (tag === 'li') return '- ' + indentAfterFirst(tidy(blocks(node.children)), '  ');
  if (tag === 'table') return table(node);
  return tidy(blocks(node.children));
}

function list(node) {
  const items = node.children.filter(child => typeof child !== 'string' && child.tag === 'li');
  return items.map((item, i) => {
    const marker = node.tag === 'ol' ? `${i + 1}. ` : '- ';
    return marker + indentAfterFirst(tidy(blocks(item.children)), ' '.repeat(marker.length));
  }).join('\n');
}

function table(node) {
  const rows = elements(node, 'tr').map(row =>
    row.children.filter(cell => typeof cell !== 'string' && (cell.tag === 'th' || cell.tag === 'td'))
      .map(cell => oneLine(blocks(cell.children)).replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const width = Math.max(...rows.map(row => row.length));
  const line = row => '| ' + Array.from({ length: width }, (_, i) => row[i] ?? '').join(' | ') + ' |';
  return [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

function inline(node) {
  if (typeof node === 'string') return node.replace(/\s+/g, ' ');
  const inner = () => node.children.map(inline).join('');
  switch (node.tag) {
    case 'br': return '  \n';
    case 'strong': case 'b': return wrap('**', inner());
    case 'em': case 'i': return wrap('*', inner());
    case 'del': case 's': case 'strike': return wrap('~~', inner());
    case 'code': return '`' + plainText(node) + '`';
    case 'sup': return '^(' + inner().trim() + ')';
    case 'img': return node.src ? `![${node.alt || ''}](${absoluteUrl(node.src)})` : '';
    case 'a': {
      const label = inner().trim();
      const href = absoluteUrl(node.href);
      if (!href) return label;
      return !label || label === href ? `<${href}>` : `[${label}](${href})`;
    }
    default: return BLOCK_TAGS.has(node.tag) ? ' ' + oneLine(blocks(node.children)) + ' ' : inner();
  }
}

// Wraps text in a marker, keeping surrounding spaces outside it.
function wrap(marker, text) {
  const match = text.match(/^(\s*)(.*?)(\s*)$/s);
  return match[2] ? match[1] + marker + match[2] + marker + match[3] : text;
}

function plainText(node) {
  return typeof node === 'string' ? node : node.children.map(plainText).join('');
}

function elements(node, tag) {
  if (typeof node === 'string') return [];
  const found = node.tag === tag ? [node] : [];
  return found.concat(...node.children.map(child => elements(child, tag)));
}

function oneLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function indentAfterFirst(text, pad) {
  return text.split('\n').map((line, i) => (i && line ? pad + line : line)).join('\n');
}

// Trims each line's trailing spaces (except Markdown line breaks) and stray
// single leading spaces, squashes runs of blank lines and trims the ends.
// Lines inside ``` fences are left exactly as they are.
function tidy(text) {
  let fenced = false;
  let blanks = 0;
  const out = [];
  for (const raw of text.split('\n')) {
    if (/^(> )*```/.test(raw.trim())) fenced = !fenced;
    else if (fenced) { out.push(raw); blanks = 0; continue; }
    let line = raw.endsWith('  ') && raw.trim() ? raw.trimEnd() + '  ' : raw.trimEnd();
    line = line.replace(/^ (?=\S)/, '');
    blanks = line ? 0 : blanks + 1;
    if (blanks < 2) out.push(line);
  }
  return out.join('\n').replace(/^\n+|\s+$/g, '');
}

/**
 * Orders comments as a tree and numbers them by reply chain: [1], [1.1], [1.2], [2].
 * Comments whose parent wasn't captured are treated as top level.
 */
export function numberComments(comments) {
  const ids = new Set(comments.map(c => c.id));
  const children = new Map();
  for (const comment of comments) {
    const parent = comment.parentId && ids.has(comment.parentId) ? comment.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(comment);
  }
  const out = [];
  const walk = (parent, prefix) => {
    (children.get(parent) || []).forEach((comment, i) => {
      const path = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      out.push({ ...comment, path });
      walk(comment.id, path);
    });
  };
  walk(null, '');
  return out;
}

// "u/name", except for Reddit's placeholders like [deleted], which aren't users.
function userName(author) {
  return /^\[.*\]$/.test(author) ? author : `u/${author}`;
}

function percent(ratio) {
  return Math.round(ratio * 100) + '%';
}

function expansionNote(expansion) {
  if (!expansion || !expansion.remaining) return null;
  const reason = expansion.limitReached ? `the click limit (${expansion.clicks}) was reached` : 'they could not be loaded';
  return `${expansion.remaining} "more replies" button(s) were not expanded because ${reason}, so some replies are missing.`;
}

/** The whole thread as Markdown, written for an LLM to read. */
export function toMarkdown(capture) {
  const { post } = capture;
  const comments = numberComments(capture.comments);
  const lines = [`# ${post.title}`, ''];

  const meta = [
    ['Subreddit', post.subreddit && `r/${post.subreddit}`],
    ['Author', post.author && userName(post.author)],
    ['Posted', post.created],
    ['Score', post.score !== null ? `${post.score}${post.upvoteRatio !== null ? ` (${percent(post.upvoteRatio)} upvoted)` : ''}` : null],
    ['Flair', post.flair],
    ['Comments', post.commentCount !== null ? `${post.commentCount} on Reddit, ${comments.length} captured` : `${comments.length} captured`],
    ['URL', absoluteUrl(post.permalink) || capture.url],
    ['Link', post.link && absoluteUrl(post.link) !== absoluteUrl(post.permalink) ? post.link : null],
    ['Captured', capture.capturedAt],
  ];
  for (const [label, value] of meta) {
    if (value !== null && value !== undefined && value !== '') lines.push(`- ${label}: ${value}`);
  }

  const body = bodyToMarkdown(post.body);
  if (body) lines.push('', body);

  lines.push('', '---', '', '## Comments', '');
  lines.push('Each comment starts with its position in the reply chain: [2.1] is the first reply to [2]. OP marks the post\'s author. Scores are as Reddit displays them.');
  const note = expansionNote(capture.expansion);
  if (note) lines.push('', `Note: ${note}`);

  for (const comment of comments) {
    const details = [
      comment.author ? userName(comment.author) : 'unknown',
      comment.author && comment.author === post.author ? 'OP' : null,
      comment.score !== null ? `${comment.score} ${Math.abs(comment.score) === 1 ? 'point' : 'points'}` : null,
      comment.created,
      comment.collapsed ? 'collapsed by Reddit' : null,
    ].filter(Boolean).join(' · ');
    lines.push('', `### [${comment.path}] ${details}`, '', bodyToMarkdown(comment.body) || '*(no text)*');
  }

  return lines.join('\n') + '\n';
}

/** The whole thread as JSON, with bodies as Markdown and comments in tree order. */
export function toJson(capture) {
  const { post } = capture;
  return JSON.stringify({
    url: capture.url,
    capturedAt: capture.capturedAt,
    expansion: capture.expansion,
    post: { ...post, permalink: absoluteUrl(post.permalink), body: bodyToMarkdown(post.body) },
    comments: numberComments(capture.comments).map(comment => ({
      ...comment,
      permalink: absoluteUrl(comment.permalink),
      isOp: Boolean(comment.author) && comment.author === post.author,
      body: bodyToMarkdown(comment.body),
    })),
  }, null, 2) + '\n';
}

/** A readable, unique file name: subreddit_postid_short-title.ext */
export function exportFilename(post, extension) {
  const slug = (post.title || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
  const id = (post.id || '').replace(/^t3_/, '');
  return [post.subreddit, id, slug].filter(Boolean).join('_') + '.' + extension;
}
