'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({window: {location: {href: 'http://127.0.0.1/'}}, URL});
vm.runInContext(fs.readFileSync(path.join(root, 'local_ui/news-workspace.js'), 'utf8'), context);
const api = context.window.NewsWorkspace;

const records = [
  {title: 'Trận đấu mới', url: 'https://example.test/story#top', source: 'ESPN', published: '10-07 08:40', groups: ['Bóng đá']},
  {title: 'Trận đấu mới', url: 'https://example.test/story', source: '', published: '', groups: ['Quốc tế', 'Bóng đá']},
  {title: 'Đội thắng trận', url: 'https://vn.example/story', source: 'VnExpress', published: 'Hôm nay', groups: ['Bóng rổ']},
  {title: 'Trận Đấu Mới', url: 'https://example.test/story', source: 'Khác', published: '', groups: ['Khác']},
];

test('chỉ chấp nhận link bài gốc absolute HTTP/HTTPS', () => {
  assert.equal(api.safeHttpUrl('https://EXAMPLE.test/a#part'), 'https://example.test/a#part');
  assert.equal(api.safeHttpUrl('http://example.test/a'), 'http://example.test/a');
  assert.equal(api.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(api.safeHttpUrl('data:text/html,x'), '');
  assert.equal(api.safeHttpUrl('/relative', 'https://example.test/report.html'), 'https://example.test/relative');
  assert.equal(api.safeHttpUrl('/relative'), '');
});

test('dedupe canonical URL plus exact title and merge actual group labels', () => {
  const items = api.dedupeItems(records);
  assert.equal(items.length, 3);
  assert.equal(items[0].url, 'https://example.test/story#top');
  assert.deepEqual(Array.from(items[0].groups), ['Bóng đá', 'Quốc tế']);
  assert.equal(items[0].source, 'ESPN');
  assert.equal(items[0].published, '10-07 08:40');
  assert.equal(items[2].title, 'Trận Đấu Mới');
});

test('search bỏ dấu tiếng Việt và lọc theo nhãn nhóm thực tế', () => {
  const items = api.dedupeItems(records);
  assert.equal(api.filterItems(items, 'bong da', []).length, 1);
  assert.equal(api.filterItems(items, 'vnexpress', []).length, 1);
  assert.equal(api.filterItems(items, 'QUỐC TẾ', []).length, 1);
  assert.equal(api.filterItems(items, '', ['Bóng rổ']).length, 1);
  assert.equal(api.filterItems(items, 'không khớp', []).length, 0);
});
