'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../local_ui/app.js'), 'utf8');
const start = app.indexOf('function renderSettings()');
const end = app.indexOf('async function loadConfig()', start);
class Node {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.value = ''; this._text = ''; this.disabled = false; this.hidden = false; this.open = false; this.attributes = {}; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  get firstChild() { return this._text ? {textContent: this._text} : this.children[0]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  focus() {}
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
function harness() {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const config = {rss: {enabled: true, feeds: [
    {id: 'paused-a', name: 'Nguồn A', url: 'https://a.example/rss', enabled: false},
    {id: 'active-b', name: 'Nguồn B', url: 'https://b.example/rss', enabled: true},
    {id: 'paused-c', name: 'Nguồn C', url: 'https://c.example/rss', enabled: false},
  ]}};
  const calls = [];
  let invalid = false;
  const context = vm.createContext({$: get, window: {}, document: {activeElement: {}, createElement: tag => new Node(tag)},
    ConfigTools: {readSettings: () => { if (invalid) throw Error('invalid fixture'); return {config, choices: {}}; }, topicNames: () => []},
    busy: false, saving: false, previewing: false, pendingVisual: null, connected: true,
    settingsValid: true, settingsError: '', updateButtons() {}, message() {}, editVisual() {},
    editScalar(key, value) { calls.push({key: Array.from(key), value}); config.rss.feeds[key[2]].enabled = value; },
  });
  vm.runInContext(app.slice(start, end), context);
  return {get, config, calls, render: () => context.renderSettings(), invalidate: () => { invalid = true; }};
}
test('bỏ tích ẩn đúng nguồn đang theo dõi và giữ index gốc cùng cấu hình nguồn', () => {
  const h = harness(); h.render();
  const checkboxes = descendants(h.get('source-list')).filter(node => node.tagName === 'INPUT');
  assert.equal(checkboxes.length, 1);
  assert.equal(checkboxes[0].id, 'source-1');
  checkboxes[0].checked = false; checkboxes[0].onchange(); h.render();
  assert.deepEqual(h.calls, [{key: ['rss', 'feeds', 1, 'enabled'], value: false}]);
  assert.equal(descendants(h.get('source-list')).filter(node => node.tagName === 'INPUT').length, 0);
  assert.equal(h.config.rss.feeds.length, 3);
  assert.equal(h.config.rss.feeds[1].url, 'https://b.example/rss');
  assert.equal(h.get('paused-sources').hidden, false);
});
test('Theo dõi lại bật chính nguồn tạm dừng và làm nó xuất hiện lại', () => {
  const h = harness(); h.render();
  const buttons = descendants(h.get('paused-source-list')).filter(node => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 2); buttons[1].onclick(); h.render();
  assert.deepEqual(h.calls, [{key: ['rss', 'feeds', 2, 'enabled'], value: true}]);
  assert.deepEqual(descendants(h.get('source-list')).filter(node => node.tagName === 'INPUT').map(node => node.id), ['source-1', 'source-2']);
  assert.equal(h.config.rss.feeds.length, 3);
  assert.equal(h.config.rss.feeds[2].id, 'paused-c');
});
test('tắt nhóm RSS giữ các lựa chọn và YAML lỗi không để nút tạm dừng cũ còn hiện', () => {
  const h = harness(); h.config.rss.enabled = false; h.render();
  const input = descendants(h.get('source-list')).find(node => node.tagName === 'INPUT');
  assert.equal(input.disabled, true); assert.equal(h.config.rss.feeds[1].enabled, true);
  h.invalidate(); h.render();
  assert.equal(h.get('paused-sources').hidden, true);
  assert.equal(h.get('paused-source-list').children.length, 0);
});
