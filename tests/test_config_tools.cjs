'use strict';

// Chạy: node --test tests/test_config_tools.cjs
// Dùng đúng thư viện của giao diện, không gọi mạng hoặc ứng dụng lấy tin.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({window: {}, structuredClone});
for (const filename of ['local_ui/vendor/js-yaml-4.1.0.min.js', 'local_ui/config-tools.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, filename), 'utf8'), context, {filename});
}
const tools = context.window.ConfigTools;
const readYaml = text => JSON.parse(JSON.stringify(context.jsyaml.load(text)));
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'trendradar-config-tools-'));
function fixture(name, text) {
  fs.writeFileSync(path.join(fixtures, name), text, {flag: 'wx'});
  return text;
}
console.log('Fixtures được giữ tại:', fixtures);

const config = fixture('config.yaml', `# Thiết lập đang dùng
rss:
  enabled: true # Bình luận công tắc
  extension: "giữ nguyên # bên trong giá trị"
  feeds:
    - id: first
      name: "Nguồn # 1"
      url: https://example.invalid/feed#sports
      enabled: true # Bình luận nguồn
      extra_field: [one, two]
    - enabled: false # Công tắc đứng đầu nguồn
      id: second
      custom:
        title: giữ nguyên
    - id: third
      name: Nguồn chưa đặt công tắc
      url: https://example.invalid/third
  unknown_nested:
    keep: yes
schedule:
  enabled: false
  preset: "old # preset" # Bình luận chế độ
unknown_feature:
  enabled: true
  options: [a, b]
`);
const timeline = fixture('timeline.yaml', `presets:
  always_on:
    name: Theo dõi cả ngày
custom:
  name: Tự đặt
`);

test('sửa scalar chỉ thay giá trị được chọn, giữ trường lạ và bình luận', () => {
  const actual = tools.setScalar(config, ['rss', 'enabled'], false);
  assert.equal(actual, config.replace('  enabled: true # Bình luận công tắc', '  enabled: false # Bình luận công tắc'));
  const expected = readYaml(config);
  expected.rss.enabled = false;
  assert.deepEqual(readYaml(actual), expected);
});

for (const [index, label] of [[0, 'đã có enabled'], [1, 'enabled là khóa đầu tiên'], [2, 'chưa có enabled']]) {
  test(`bật/tắt RSS khi nguồn ${label}`, () => {
    const before = readYaml(config);
    const value = before.rss.feeds[index].enabled !== true;
    const actual = tools.setScalar(config, ['rss', 'feeds', index, 'enabled'], value);
    const expected = structuredClone(before);
    expected.rss.feeds[index].enabled = value;
    assert.deepEqual(readYaml(actual), expected);
    assert.ok(actual.includes('# Bình luận nguồn'));
    assert.ok(actual.includes('# Công tắc đứng đầu nguồn'));
    assert.ok(actual.includes('      name: "Nguồn # 1"'));
    if (index === 0) assert.equal(actual, config.replace('      enabled: true # Bình luận nguồn', '      enabled: false # Bình luận nguồn'));
    if (index === 1) assert.equal(actual, config.replace('    - enabled: false # Công tắc đứng đầu nguồn', '    - enabled: true # Công tắc đứng đầu nguồn'));
    if (index === 2) assert.equal(actual, config.replace('    - id: third\n', '    - id: third\n      enabled: true\n'));
  });
}

test('dấu # trong quote không bị nhầm thành bình luận', () => {
  for (const scalar of ['"old # preset"', "'old # preset'", "'old ''quoted # preset'"]) {
    const text = config.replace('"old # preset"', scalar);
    const actual = tools.setScalar(text, ['schedule', 'preset'], 'new # preset');
    assert.equal(actual, text.replace(scalar + ' # Bình luận chế độ', '"new # preset" # Bình luận chế độ'));
    assert.equal(readYaml(actual).schedule.preset, 'new # preset');
  }
});

test('YAML sai cấu trúc bị từ chối trước khi chỉnh hoặc đọc lựa chọn', () => {
  const invalid = fixture('invalid.yaml', 'rss:\n  enabled: [true\n');
  assert.throws(() => tools.readSettings(invalid, timeline));
  assert.throws(() => tools.readSettings(config, invalid));
  assert.throws(() => tools.setScalar(invalid, ['rss', 'enabled'], false));
  assert.throws(() => tools.readSettings('rss:\n  enabled: "false"\n', timeline));
  assert.throws(() => tools.readSettings('rss:\n  feeds: {}\n', timeline));
});

test('tên chủ đề dành cho cấu trúc tệp bị từ chối, kể cả chữ thường', () => {
  for (const name of ['GLOBAL_FILTER', 'global_filter', ' Global_Filter ', 'WORD_GROUPS', 'word_groups', ' Word_Groups ']) {
    assert.throws(() => tools.addTopic('[WORD_GROUPS]\n', name, 'bóng đá'));
  }
});

test('nhóm chỉ chứa từ bắt buộc vẫn hiện trong danh sách chủ đề', () => {
  const text = fixture('required-only.txt', '[WORD_GROUPS]\n\n[Bóng đá Việt Nam]\n+bóng đá\n+Việt Nam\n\n+NBA\n+playoffs\n');
  assert.deepEqual(Array.from(tools.topicNames(text)), ['Bóng đá Việt Nam', 'NBA / playoffs']);
});

test('thêm chủ đề giữ nguyên toàn bộ phần cũ và loại bỏ khoảng trắng từ khóa', () => {
  const text = fixture('words.txt', '# Giữ bình luận\n[GLOBAL_FILTER]\n震惊\n\n[WORD_GROUPS]\n\n[Tin cũ]\n/华为|HUAWEI/ => Huawei\n!quảng cáo\n@5\n');
  const actual = tools.addTopic(text, ' Bóng đá ', ' bóng đá, V-League, , đội tuyển ');
  assert.equal(actual, text + '\n\n[Bóng đá]\nbóng đá\nV-League\nđội tuyển\n');
  assert.deepEqual(Array.from(tools.topicNames(actual)), ['Tin cũ', 'Bóng đá']);
});

test('tệp kết thúc bằng GLOBAL_FILTER mở lại đúng WORD_GROUPS khi thêm chủ đề', () => {
  const text = fixture('ends-with-global.txt', '[WORD_GROUPS]\n\n[Tin cũ]\nNBA\n\n[GLOBAL_FILTER]\nquảng cáo\n');
  const actual = tools.addTopic(text, 'Bóng rổ', 'bóng rổ, NBA');
  assert.equal(actual, text + '\n\n[WORD_GROUPS]\n\n[Bóng rổ]\nbóng rổ\nNBA\n');
  assert.deepEqual(Array.from(tools.topicNames(actual)), ['Tin cũ', 'Bóng rổ']);
});

test('thiếu WORD_GROUPS không được thêm từ vào GLOBAL_FILTER', () => {
  const text = fixture('global-only.txt', '[GLOBAL_FILTER]\nquảng cáo\n');
  assert.throws(() => tools.addTopic(text, 'Bóng đá', 'bóng đá'));
  assert.equal(text, fs.readFileSync(path.join(fixtures, 'global-only.txt'), 'utf8'));
});
