// Puts format.js through its paces with hand-built body trees, the same shape
// content.js produces from the live page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absoluteUrl, bodyToMarkdown, numberComments, toMarkdown, toJson, exportFilename,
} from '../../../features/export/format.js';

const el = (tag, children = [], extra = {}) => ({ tag, children, ...extra });
const body = (...children) => el('div', children);

test('relative Reddit links become absolute', () => {
  assert.equal(absoluteUrl('/r/pics/'), 'https://www.reddit.com/r/pics/');
  assert.equal(absoluteUrl('//i.redd.it/x.png'), 'https://i.redd.it/x.png');
  assert.equal(absoluteUrl('https://example.com/'), 'https://example.com/');
  assert.equal(absoluteUrl(null), null);
});

test('paragraphs are separated and HTML whitespace collapses', () => {
  const tree = body('\n  ', el('p', ['Hello\n   world']), '\n', el('p', ['Second']), '\n');
  assert.equal(bodyToMarkdown(tree), 'Hello world\n\nSecond');
});

test('inline formatting and links', () => {
  const tree = body(el('p', [
    el('strong', ['bold']), ' ', el('em', ['it']), ' ', el('del', ['gone']), ' ',
    el('code', ['x = 1']), ' ', el('a', ['here'], { href: '/r/pics/' }), ' ',
    el('a', ['https://example.com'], { href: 'https://example.com' }),
  ]));
  assert.equal(bodyToMarkdown(tree),
    '**bold** *it* ~~gone~~ `x = 1` [here](https://www.reddit.com/r/pics/) <https://example.com>');
});

test('emphasis keeps its spaces outside the markers', () => {
  assert.equal(bodyToMarkdown(body(el('p', ['a', el('strong', [' b ']), 'c']))), 'a **b** c');
});

test('lists, nested lists and ordered lists', () => {
  const tree = body(
    el('ul', [el('li', ['one']), el('li', [el('p', ['two']), el('ul', [el('li', ['inner'])])])]),
    el('ol', [el('li', ['first']), el('li', ['second'])]),
  );
  assert.equal(bodyToMarkdown(tree), '- one\n- two\n\n  - inner\n\n1. first\n2. second');
});

test('blockquotes and headings', () => {
  const tree = body(el('blockquote', [el('p', ['quoted']), el('p', ['more'])]), el('h2', ['Title']));
  assert.equal(bodyToMarkdown(tree), '> quoted\n>\n> more\n\n## Title');
});

test('code blocks keep their indentation and blank lines', () => {
  const code = 'def f():\n x = 1\n\n\n return x\n';
  const tree = body(el('pre', [el('code', [code])]));
  assert.equal(bodyToMarkdown(tree), '```\ndef f():\n x = 1\n\n\n return x\n```');
});

test('line breaks, superscript, images and tables', () => {
  const tree = body(
    el('p', ['one', el('br'), 'two ', el('sup', ['up'])]),
    el('p', [el('img', [], { src: '/x.png', alt: 'cat' })]),
    el('table', [el('thead', [el('tr', [el('th', ['a']), el('th', ['b'])])]), el('tbody', [el('tr', [el('td', ['1']), el('td', ['x|y'])])])]),
  );
  assert.equal(bodyToMarkdown(tree),
    'one  \ntwo ^(up)\n\n![cat](https://www.reddit.com/x.png)\n\n| a | b |\n| --- | --- |\n| 1 | x\\|y |');
});

test('empty and missing bodies', () => {
  assert.equal(bodyToMarkdown(null), '');
  assert.equal(bodyToMarkdown(body('  \n ')), '');
});

test('comments are numbered by reply chain, orphans go to the top level', () => {
  const numbered = numberComments([
    { id: 'a', parentId: null },
    { id: 'b', parentId: 'a' },
    { id: 'c', parentId: 'b' },
    { id: 'd', parentId: 'a' },
    { id: 'e', parentId: null },
    { id: 'f', parentId: 'missing' },
  ]);
  assert.deepEqual(numbered.map(c => `${c.id}=${c.path}`), ['a=1', 'b=1.1', 'c=1.1.1', 'd=1.2', 'e=2', 'f=3']);
});

const capture = {
  url: 'https://www.reddit.com/r/test/comments/abc123/a_title/',
  capturedAt: '2026-10-04T15:00:00.000Z',
  expansion: { clicks: 5, remaining: 3, limitReached: true },
  post: {
    id: 't3_abc123', title: 'A Title: With Ünicode!', author: 'op_person', subreddit: 'test',
    permalink: '/r/test/comments/abc123/a_title/', link: 'https://www.reddit.com/r/test/comments/abc123/a_title/',
    postType: 'text', created: '2026-10-04T12:00:00.000+0000', score: 31, upvoteRatio: 0.642,
    commentCount: 54, flair: 'Rant', body: body(el('p', ['Post body'])),
  },
  comments: [
    { id: 't1_a', parentId: null, author: 'someone', created: '2026-10-04T13:00:00.000+0000', score: 2, depth: 0, permalink: '/r/test/comments/abc123/comment/a/', collapsed: false, body: body(el('p', ['Hi'])) },
    { id: 't1_b', parentId: 't1_a', author: 'op_person', created: '2026-10-04T13:05:00.000+0000', score: 5, depth: 1, permalink: '/r/test/comments/abc123/comment/b/', collapsed: false, body: body(el('p', ['Reply'])) },
    { id: 't1_d', parentId: 't1_b', author: '[deleted]', created: null, score: null, depth: 2, permalink: null, collapsed: false, body: null },
    { id: 't1_c', parentId: null, author: 'AutoModerator', created: '2026-10-04T12:00:01.000+0000', score: 1, depth: 0, permalink: '/r/test/comments/abc123/comment/c/', collapsed: true, body: null },
  ],
};

test('markdown export has the post, metadata, note and numbered comments', () => {
  const md = toMarkdown(capture);
  assert.match(md, /^# A Title: With Ünicode!\n/);
  assert.match(md, /- Score: 31 \(64% upvoted\)/);
  assert.match(md, /- Flair: Rant/);
  assert.match(md, /- Comments: 54 on Reddit, 4 captured/);
  assert.match(md, /- URL: https:\/\/www\.reddit\.com\/r\/test\/comments\/abc123\/a_title\//);
  assert.doesNotMatch(md, /- Link:/);
  assert.match(md, /\nPost body\n/);
  assert.match(md, /Note: 3 "more replies" button\(s\) were not expanded because the click limit \(5\) was reached/);
  assert.match(md, /### \[1\] u\/someone · 2 points · 2026-10-04T13:00:00\.000\+0000\n\nHi\n/);
  assert.match(md, /### \[1\.1\] u\/op_person · OP · 5 points/);
  assert.match(md, /### \[1\.1\.1\] \[deleted\]\n/);
  assert.match(md, /### \[2\] u\/AutoModerator · 1 point · .* · collapsed by Reddit\n\n\*\(no text\)\*/);
});

test('markdown export leaves out the note when nothing is missing', () => {
  const md = toMarkdown({ ...capture, expansion: { clicks: 1, remaining: 0, limitReached: false } });
  assert.doesNotMatch(md, /Note:/);
});

test('json export is valid, ordered and marks OP', () => {
  const data = JSON.parse(toJson(capture));
  assert.equal(data.post.body, 'Post body');
  assert.equal(data.post.permalink, 'https://www.reddit.com/r/test/comments/abc123/a_title/');
  assert.deepEqual(data.comments.map(c => [c.path, c.isOp, c.body]), [['1', false, 'Hi'], ['1.1', true, 'Reply'], ['1.1.1', false, ''], ['2', false, '']]);
});

test('file names are readable and unique per post', () => {
  assert.equal(exportFilename(capture.post, 'md'), 'test_abc123_a-title-with-unicode.md');
  assert.equal(exportFilename({ ...capture.post, title: 'x'.repeat(80) }, 'json'), `test_abc123_${'x'.repeat(50)}.json`);
});
