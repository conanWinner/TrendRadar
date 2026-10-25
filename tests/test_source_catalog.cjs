'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'trendradar-source-catalog-dom-'));
const fixtureCatalog = path.join(fixtures, 'catalog.json');
fs.copyFileSync(path.join(root, 'local_ui/source-catalog.json'), fixtureCatalog);
console.log('Fixture được giữ tại:', fixtures);

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.type = '';
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

const nodes = node => [node, ...node.children.flatMap(nodes)];
const find = (node, predicate) => nodes(node).find(predicate);
const all = (node, predicate) => nodes(node).filter(predicate);
const addButton = (box, feedId) => find(box, node => node.dataset.catalogAdd === feedId);
const card = (box, publisherId) => find(box, node => node.dataset.publisher === publisherId);

function harness(fetchImpl = async () => ({ok: true, json: async () => JSON.parse(fs.readFileSync(fixtureCatalog, 'utf8'))})) {
  const context = vm.createContext({
    window: {},
    document: {createElement: tag => new FakeNode(tag)},
    URL,
    fetch: fetchImpl,
  });
  for (const filename of ['local_ui/vendor/js-yaml-4.1.0.min.js', 'local_ui/source-catalog.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, filename), 'utf8'), context, {filename});
  }
  const api = context.window.SourceCatalog;
  api.parse = text => JSON.parse(JSON.stringify(context.jsyaml.load(text)));
  return api;
}

const enabledConfig = feeds => `rss:\n  enabled: true\n  feeds: ${feeds.length ? '\n' + feeds.map(feed => `    - id: ${feed.id}\n      url: ${JSON.stringify(feed.url)}\n      enabled: ${feed.enabled === false ? 'false' : 'true'}${feed.name ? `\n      name: ${JSON.stringify(feed.name)}` : ''}${feed.custom_meta ? `\n      custom_meta: ${JSON.stringify(feed.custom_meta)}` : ''}${feed.extra ? `\n      extra: ${JSON.stringify(feed.extra)}` : ''}`).join('\n') : '[]'}\n`;

test('load thất bại có thể thử lại, sau đó render danh sách hợp lệ', async () => {
  let calls = 0;
  const api = harness(async () => {
    calls++;
    if (calls === 1) return {ok: false, json: async () => ({})};
    return {ok: true, json: async () => JSON.parse(fs.readFileSync(fixtureCatalog, 'utf8'))};
  });
  const box = new FakeNode('div');
  await assert.rejects(api.load(), /Chưa tải được thư viện/);
  api.render(box, enabledConfig([]), async () => true, false);
  assert.ok(all(box, node => node.textContent.includes('Chưa tải được thư viện')).length);
  const loaded = await api.load();
  assert.equal(calls, 2);
  assert.ok(loaded.publishers.length > 0);
  api.render(box, enabledConfig([]), async () => true, false);
  assert.ok(card(box, 'espn'));
});
test('lọc theo quốc gia nguồn, lĩnh vực và truy vấn tên báo', async () => {
  const api = harness();
  await api.load();
  const box = new FakeNode('div');
  api.render(box, enabledConfig([]), async () => true, false);
  assert.equal(all(box, node => node.dataset.publisher).length, 50);

  const country = find(box, node => node.dataset.catalogFilter === 'country');
  country.value = 'US'; country.onchange();
  assert.ok(card(box, 'espn'));
  assert.equal(all(box, node => node.dataset.publisher).every(node => node.dataset.publisher !== 'bbc'), true);

  const category = find(box, node => node.dataset.catalogFilter === 'category');
  category.value = 'football'; category.onchange();
  const query = find(box, node => node.dataset.catalogFilter === 'query');
  query.value = 'espn'; query.oninput();
  assert.deepEqual(all(box, node => node.dataset.publisher).map(node => node.dataset.publisher), ['espn']);
  assert.ok(find(box, node => node.textContent.includes('Quốc gia của báo không xác định sự kiện')));
});

test('RSS tổng tắt có cảnh báo; publisher và feed chưa xác minh không thể thêm', async () => {
  const api = harness();
  const data = await api.load();
  const unavailable = data.publishers.find(publisher => publisher.status !== 'verified' || !publisher.feeds.length);
  assert.ok(unavailable);
  const box = new FakeNode('div');
  api.render(box, 'rss:\n  enabled: false\n  feeds: []\n', async () => true, false);
  assert.ok(all(box, node => node.textContent.includes('Nhóm nguồn báo đang tắt')).length);
  const unavailableCard = card(box, unavailable.id);
  assert.ok(all(unavailableCard, node => node.tagName === 'button').some(button => button.disabled));
  assert.ok(all(unavailableCard, node => node.textContent.includes('Chưa có RSS đã xác minh')).length);

  const custom = structuredClone(data);
  const target = custom.publishers.find(item => item.id === 'espn');
  const badFeed = {...target.feeds.find(feed => feed.category === 'football'), id: 'espn-unverified', status: 'unverified'};
  target.feeds.push(badFeed);
  // Feed chưa xác minh vẫn không được mở nút thêm, kể cả khi publisher có RSS tốt.
  const customApi = harness(async () => ({ok: true, json: async () => custom}));
  await customApi.load();
  const customBox = new FakeNode('div');
  customApi.render(customBox, enabledConfig([]), async () => true, false);
  assert.equal(addButton(customBox, badFeed.id).disabled, true);
});

test('URL trùng nhận diện cả nguồn đang tắt và đang bật, bỏ qua fragment', async () => {
  const api = harness();
  const data = await api.load();
  const publisher = data.publishers.find(item => item.id === 'espn');
  const feed = publisher.feeds.find(item => item.category === 'football');
  const off = new FakeNode('div');
  api.render(off, enabledConfig([{id: 'custom-off', url: feed.url + '#existing', enabled: false}]), async () => true, false);
  assert.equal(addButton(off, feed.id).textContent, 'Theo dõi lại');
  assert.equal(addButton(off, feed.id).disabled, false);
  assert.ok(find(card(off, publisher.id), node => node.textContent.includes('Theo dõi lại')));

  const on = new FakeNode('div');
  api.render(on, enabledConfig([{id: 'custom-on', url: feed.url, enabled: true}]), async () => true, false);
  assert.equal(addButton(on, feed.id).textContent, 'Đã thêm · đang bật');
  assert.equal(addButton(on, feed.id).disabled, true);
});

test('callback thành công append đúng nguồn vào bản nháp, không làm mất trường lạ hiện có', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const original = {id: 'existing', url: 'https://example.invalid/current.xml', enabled: false, extra: {keep: 'yes'}};
  const raw = enabledConfig([original]);
  const before = api.parse(raw).rss.feeds[0];
  const calls = [];
  const box = new FakeNode('div');
  api.render(box, raw, async (...args) => {
    calls.push(args);
    const preview = api.parse(raw);
    preview.rss.feeds.push(args[2]);
    assert.deepEqual(preview.rss.feeds[0], before);
    return true;
  }, false);
  await addButton(box, feed.id).onclick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'config');
  assert.deepEqual(Array.from(calls[0][1]), ['rss', 'feeds']);
  assert.equal(calls[0][3], 'append');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
    id: feed.id,
    name: 'ESPN — ' + feed.category_name,
    url: feed.url,
    enabled: true,
    publisher_id: 'espn',
    country: 'US',
    country_name: 'Mỹ',
    category: 'football',
  });
  assert.deepEqual(api.parse(raw).rss.feeds[0], before);
  assert.equal(addButton(box, feed.id).textContent, 'Đã thêm · đang bật');
  assert.ok(all(box, node => node.textContent.includes('chưa lưu')).length);
  assert.ok(!('event_scope' in calls[0][2]));
});

test('callback trả false hoặc lỗi không đánh dấu nguồn đã thêm và cho phép thử lại', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const box = new FakeNode('div');
  let attempts = 0;
  api.render(box, enabledConfig([]), async () => { attempts++; if (attempts === 1) return false; throw new Error('preview failed'); }, false);
  await addButton(box, feed.id).onclick();
  assert.equal(addButton(box, feed.id).textContent, 'Thêm nguồn này');
  assert.equal(addButton(box, feed.id).disabled, false);
  assert.ok(all(box, node => node.textContent.includes('Chưa thêm nguồn')).length);
  await addButton(box, feed.id).onclick();
  assert.equal(addButton(box, feed.id).textContent, 'Thêm nguồn này');
  assert.equal(addButton(box, feed.id).disabled, false);
  assert.ok(all(box, node => node.textContent.includes('Không thêm được nguồn')).length);
});

test('YAML mới nhất xóa trạng thái lạc quan sau khi tải lại hoặc xóa nguồn bằng giao diện', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const box = new FakeNode('div');
  let raw = enabledConfig([]);
  const callback = async () => {
    raw = enabledConfig([{id: feed.id, url: feed.url, enabled: true}]);
    api.render(box, raw, callback, false);
    return true;
  };
  api.render(box, raw, callback, false);
  await addButton(box, feed.id).onclick();
  assert.equal(addButton(box, feed.id).textContent, 'Đã thêm · đang bật');

  // Tải lại cấu hình đã lưu làm mất feed khỏi YAML nháp hiện tại.
  raw = enabledConfig([]);
  api.render(box, raw, callback, false);
  assert.equal(addButton(box, feed.id).textContent, 'Thêm nguồn này');
  assert.equal(addButton(box, feed.id).disabled, false);

  // Thêm lại từ YAML rồi xóa qua giao diện cũng phải theo nguồn dữ liệu mới nhất.
  raw = enabledConfig([{id: feed.id, url: feed.url, enabled: true}]);
  api.render(box, raw, callback, false);
  assert.equal(addButton(box, feed.id).textContent, 'Đã thêm · đang bật');
  raw = enabledConfig([]);
  api.render(box, raw, callback, false);
  assert.equal(addButton(box, feed.id).textContent, 'Thêm nguồn này');
  assert.equal(addButton(box, feed.id).disabled, false);
});

test('rerender đồng bộ trong callback không để nút ở DOM sống bị khóa sau callback fail', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const box = new FakeNode('div');
  let resolveChange;
  const callback = () => {
    api.render(box, enabledConfig([]), callback, false);
    return new Promise(resolve => { resolveChange = resolve; });
  };
  api.render(box, enabledConfig([]), callback, false);
  const country = find(box, node => node.dataset.catalogFilter === 'country');
  country.value = 'US'; country.onchange();
  const category = find(box, node => node.dataset.catalogFilter === 'category');
  category.value = 'football'; category.onchange();
  const query = find(box, node => node.dataset.catalogFilter === 'query');
  query.value = 'espn'; query.oninput();
  const operation = addButton(box, feed.id).onclick();
  assert.ok(addButton(box, feed.id).disabled, 'nút bị khóa trong lúc callback đang chờ');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'country').value, 'US');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'category').value, 'football');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'query').value, 'espn');
  resolveChange(false);
  await operation;
  assert.equal(addButton(box, feed.id).disabled, false, 'render cuối phải áp dụng lên container hiện tại');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'country').value, 'US');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'category').value, 'football');
  assert.equal(find(box, node => node.dataset.catalogFilter === 'query').value, 'espn');
  assert.equal(addButton(box, feed.id).textContent, 'Thêm nguồn này');
  assert.ok(all(box, node => node.textContent.includes('Chưa thêm nguồn')).length);
});

test('khóa toàn cục chặn callback; dữ liệu YAML sai không sinh nút thêm', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const locked = new FakeNode('div');
  let calls = 0;
  api.render(locked, enabledConfig([]), async () => { calls++; return true; }, true);
  assert.ok(all(locked, node => node.dataset.catalogAdd).every(button => button.disabled));
  await addButton(locked, feed.id).onclick();
  assert.equal(calls, 0);

  const invalid = new FakeNode('div');
  api.render(invalid, 'rss: [broken', async () => true, false);
  assert.ok(!all(invalid, node => node.dataset.catalogAdd).length);
});

test('Theo dõi lại gọi đúng path [rss, feeds, index, enabled] = true, không append, giữ nguyên ID/name/metadata', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const dummy1 = {id: 'd1', url: 'https://example.com/feed1', enabled: true};
  const offFeed = {id: 'custom-off-id', name: 'Tên Nguồn Tùy Chỉnh', url: feed.url + '#frag', enabled: false, custom_meta: 'safe_data'};
  const dummy2 = {id: 'd2', url: 'https://example.com/feed2', enabled: false};
  const raw = enabledConfig([dummy1, offFeed, dummy2]);
  const calls = [];
  const box = new FakeNode('div');

  api.render(box, raw, async (...args) => {
    calls.push(args);
    return true;
  }, false);

  const btn = addButton(box, feed.id);
  assert.equal(btn.textContent, 'Theo dõi lại');
  assert.equal(btn.disabled, false);

  await btn.onclick();

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'config');
  assert.deepEqual(Array.from(calls[0][1]), ['rss', 'feeds', 1, 'enabled']);
  assert.equal(calls[0][2], true);
  assert.equal(calls[0][3], undefined, 'không dùng operation append khi bật lại nguồn');

  // Kiểm tra mô phỏng sau khi preview cập nhật giá trị
  const parsed = api.parse(raw);
  assert.equal(parsed.rss.feeds.length, 3, 'không bị append thêm mục mới vào feeds');
  parsed.rss.feeds[1].enabled = true;
  assert.equal(parsed.rss.feeds[1].id, 'custom-off-id');
  assert.equal(parsed.rss.feeds[1].name, 'Tên Nguồn Tùy Chỉnh');
  assert.equal(parsed.rss.feeds[1].custom_meta, 'safe_data');
});

test('Khi URL trùng xuất hiện cả active và off thì ưu tiên active để tránh mở lại nguồn', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const offFeed = {id: 'f-off', url: feed.url, enabled: false};
  const onFeed = {id: 'f-on', url: feed.url, enabled: true};
  const raw = enabledConfig([offFeed, onFeed]);
  const box = new FakeNode('div');
  let calls = 0;

  api.render(box, raw, async () => { calls++; return true; }, false);

  const btn = addButton(box, feed.id);
  assert.equal(btn.textContent, 'Đã thêm · đang bật');
  assert.equal(btn.disabled, true);
  await btn.onclick();
  assert.equal(calls, 0);
});

test('Theo dõi lại thất bại cho phép thử lại và giữ nguyên trạng thái', async () => {
  const api = harness();
  const data = await api.load();
  const feed = data.publishers.find(item => item.id === 'espn').feeds.find(item => item.category === 'football');
  const offFeed = {id: 'f-off', url: feed.url, enabled: false};
  const raw = enabledConfig([offFeed]);
  const box = new FakeNode('div');
  let attempts = 0;

  api.render(box, raw, async () => {
    attempts++;
    if (attempts === 1) return false;
    throw new Error('fail');
  }, false);

  const btn = addButton(box, feed.id);
  assert.equal(btn.textContent, 'Theo dõi lại');

  await btn.onclick();
  assert.equal(addButton(box, feed.id).textContent, 'Theo dõi lại');
  assert.equal(addButton(box, feed.id).disabled, false);
  assert.ok(all(box, node => node.textContent.includes('Chưa bật lại nguồn')).length);

  await addButton(box, feed.id).onclick();
  assert.equal(addButton(box, feed.id).textContent, 'Theo dõi lại');
  assert.equal(addButton(box, feed.id).disabled, false);
  assert.ok(all(box, node => node.textContent.includes('Không bật lại được nguồn')).length);
});
