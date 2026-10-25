'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const FrequencyUI = require('../local_ui/frequency-ui.js');

test('module exports parser and line patcher without requiring a DOM', () => {
  assert.equal(typeof FrequencyUI.parse, 'function');
  assert.equal(typeof FrequencyUI.patch, 'function');
  assert.equal(typeof FrequencyUI.render, 'function');
});

test('parses alias groups, regex, aliases, required, exclusion, limit, legacy and global sections', () => {
  const text = '# Keep this note\n[GLOBAL_FILTER]\nspam\n\n[WORD_GROUPS]\n\n[Premier League]\n+championship\n/Man|City/i => MC\n!gambling\n@5\n\nlegacy word\n';
  const parsed = FrequencyUI.parse(text);
  const allRules = parsed.blocks.flatMap(block => block.rules);
  const globalRule = allRules.find(rule => rule.expression === 'spam');
  const required = allRules.find(rule => rule.kind === 'required');
  const regexAlias = allRules.find(rule => rule.isRegex);
  const excluded = allRules.find(rule => rule.kind === 'exclude');
  const limit = allRules.find(rule => rule.kind === 'limit');
  const legacy = allRules.find(rule => rule.expression === 'legacy word');

  assert.equal(globalRule.section, 'GLOBAL_FILTER');
  assert.equal(globalRule.effective, true);
  assert.equal(parsed.blocks.find(block => block.alias)?.alias.value, '[Premier League]');
  assert.equal(required.section, 'WORD_GROUPS');
  assert.equal(regexAlias.regexPattern, 'Man|City');
  assert.equal(regexAlias.displayAlias, 'MC');
  assert.equal(excluded.effective, true);
  assert.equal(limit.kind, 'limit');
  assert.equal(legacy.section, 'WORD_GROUPS');
});

test('a one-line edit preserves every other byte and comment', () => {
  const text = '# file note\n[WORD_GROUPS]\n\n# group note\n[Basketball]\n/Warriors|GSW/ => Golden State\n+playoffs\n';
  const parsed = FrequencyUI.parse(text);
  const regex = parsed.blocks.flatMap(block => block.rules).find(rule => rule.isRegex);
  const changed = FrequencyUI.patch(text, {
    type: 'replace', start: regex.start, end: regex.end,
    value: '/Warriors|Golden State/ => Golden State',
  });
  assert.equal(changed, text.replace('/Warriors|GSW/ => Golden State', '/Warriors|Golden State/ => Golden State'));
  assert.ok(changed.startsWith('# file note\n[WORD_GROUPS]\n\n# group note\n[Basketball]\n'));
});

test('group-rule and topic additions keep section boundaries and existing text', () => {
  const text = '# preserved\n[WORD_GROUPS]\n\n[Existing]\n+required\n\n[GLOBAL_FILTER]\nspam\n';
  const parsed = FrequencyUI.parse(text);
  const existing = parsed.blocks.find(block => block.alias?.value === '[Existing]');
  const withRule = FrequencyUI.patch(text, {type: 'add-rule', blockIndex: existing.index, value: '/team|club/ => Team'});
  assert.equal(withRule, text.replace('+required\n\n', '+required\n/team|club/ => Team\n\n'));

  const withTopic = FrequencyUI.patch(withRule, {type: 'add-topic', name: 'New topic', value: '+must match'});
  assert.ok(withTopic.startsWith(withRule));
  assert.ok(withTopic.endsWith('\n\n[WORD_GROUPS]\n\n[New topic]\n+must match'));
  const added = FrequencyUI.parse(withTopic).blocks.find(block => block.alias?.value === '[New topic]');
  assert.equal(added.rules[0].kind, 'required');
  assert.equal(added.section, 'WORD_GROUPS');
});

test('legacy files stay legacy and ! exclusions are explained as global in the rendered rule metadata', () => {
  const text = '[Basketball]\nNBA\n!rumor\n';
  const parsed = FrequencyUI.parse(text);
  const exclusion = parsed.blocks.flatMap(block => block.rules).find(rule => rule.kind === 'exclude');
  assert.equal(exclusion.section, 'WORD_GROUPS');
  assert.equal(exclusion.effective, true);
  const changed = FrequencyUI.patch(text, {type: 'add-topic', name: 'Football', value: 'V-League'});
  assert.ok(changed.startsWith(text));
  assert.equal(FrequencyUI.parse(changed).blocks.find(block => block.alias?.value === '[Football]').section, 'WORD_GROUPS');
});

test('special syntax in GLOBAL_FILTER is recognized as ignored by the loader', () => {
  const parsed = FrequencyUI.parse('[GLOBAL_FILTER]\n!ignored here\n+also ignored\n@5\nplain filter\n');
  const globalRules = parsed.blocks.flatMap(block => block.rules);
  assert.deepEqual(globalRules.map(rule => rule.effective), [false, false, false, true]);
});

test('reserved section names are rejected in topic creation, alias rename and generic patch', () => {
  const text = '[WORD_GROUPS]\n\n[Sports]\nNBA\n';
  const group = FrequencyUI.parse(text).blocks.find(block => block.alias);
  for (const name of ['GLOBAL_FILTER', 'global_filter', 'WORD_GROUPS', 'word_groups']) {
    assert.throws(() => FrequencyUI.patch(text, {type: 'add-topic', name, value: 'term'}));
    assert.throws(() => FrequencyUI.patch(text, {type: 'rename-alias', blockIndex: group.index, name}));
  }
  assert.throws(() => FrequencyUI.patch(text, {
    type: 'replace', start: group.alias.start, end: group.alias.end, value: '[global_filter]',
  }));
});

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.open = false;
    this.textContent = '';
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  dispatch(name) {
    const event = {preventDefault() { this.defaultPrevented = true; }};
    for (const listener of this.listeners[name] || []) listener(event);
    return event;
  }
  querySelectorAll(selector) {
    const results = [];
    const visit = node => {
      if (selector === '[data-draft-id]' && node.dataset.draftId !== undefined) results.push(node);
      if (selector === 'details[data-frequency-index]' && node.tagName === 'details' && node.dataset.frequencyIndex !== undefined) results.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return results;
  }
}

function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const result = findNode(child, predicate);
    if (result) return result;
  }
  return null;
}

test('typed controls preserve regex flags and alias and notify without rendering again', () => {
  const previousDocument = global.document;
  global.document = {createElement: tag => new FakeNode(tag)};
  try {
    const text = '# untouched note\n[WORD_GROUPS]\n\n[Premier]\n/Club|City/ig => Existing name\n';
    const container = new FakeNode('div');
    const changes = [];
    FrequencyUI.render(container, text, next => changes.push(next));
    assert.equal(changes.length, 0);
    const rendered = container.children[0];
    const details = findNode(rendered, child => child.tagName === 'details');
    assert.equal(details.children[0].tagName, 'summary');
    assert.equal(details.children[0].textContent, 'Premier');
    details.open = true;
    const expression = findNode(details, node => node.tagName === 'input' && node.attributes['aria-label'] === 'Nội dung quy tắc');
    const alias = findNode(details, node => node.tagName === 'input' && node.attributes['aria-label'] === 'Tên hiển thị');
    const regex = findNode(details, node => node.tagName === 'input' && node.type === 'checkbox');
    assert.equal(expression.value, 'Club|City');
    assert.equal(alias.value, 'Existing name');
    assert.equal(regex.checked, true);

    expression.value = 'Club|Town';
    expression.dispatch('change');
    assert.equal(changes.length, 1);
    assert.ok(changes[0].includes('/Club|Town/ig => Existing name'));
    assert.ok(changes[0].startsWith('# untouched note\n'));
    assert.equal(container.children[0], rendered, 'the module must leave rerendering to its caller');

    FrequencyUI.render(container, changes[0], next => changes.push(next));
    const rerendered = container.children[0];
    assert.equal(findNode(rerendered, child => child.tagName === 'details').open, true);
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test('typed add forms create exclusions and global filters without syntax placeholders', () => {
  const previousDocument = global.document;
  global.document = {createElement: tag => new FakeNode(tag)};
  try {
    const text = '[WORD_GROUPS]\n\n[Sports]\nNBA\n';
    const container = new FakeNode('div');
    const changes = [];
    FrequencyUI.render(container, text, next => changes.push(next));
    const root = container.children[0];
    const ruleForm = findNode(root, node => node.tagName === 'form' && node.className === 'frequency-add-rule');
    const selects = [];
    const collect = node => { if (node.tagName === 'select') selects.push(node); node.children.forEach(collect); };
    collect(ruleForm);
    const ruleInput = findNode(ruleForm, node => node.tagName === 'input' && node.attributes['aria-label'] === 'Nội dung quy tắc mới');
    assert.equal(ruleInput.placeholder || '', '');
    selects[0].value = 'exclude';
    ruleInput.value = 'casino';
    ruleForm.dispatch('submit');
    assert.ok(changes[0].includes('!casino'));

    const globalForm = findNode(root, node => node.tagName === 'form' && node.className === 'frequency-add-global-filter');
    const globalInput = findNode(globalForm, node => node.tagName === 'input');
    globalInput.value = 'advertising';
    globalForm.dispatch('submit');
    assert.ok(changes[1].endsWith('[GLOBAL_FILTER]\n\nadvertising'));
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test('unfinished additions survive other edits and successful submit clears only its own draft', () => {
  const previousDocument = global.document;
  global.document = {createElement: tag => new FakeNode(tag)};
  try {
    const container = new FakeNode('div');
    let text = '[Sports]\nNBA\n';
    const changed = next => { text = next; FrequencyUI.render(container, text, changed); return true; };
    FrequencyUI.render(container, text, changed);
    let name = findNode(container, node => node.dataset.draftId === 'topic-name');
    name.value = 'Football';
    findNode(container, node => node.dataset.draftId === 'topic-rule').value = 'V-League';
    findNode(container, node => node.dataset.draftId === 'global').value = 'unfinished';
    FrequencyUI.render(container, text, changed);
    name = findNode(container, node => node.dataset.draftId === 'topic-name');
    assert.equal(name.value, 'Football');
    findNode(container, node => node.className === 'frequency-add-topic').dispatch('submit');
    assert.ok(text.includes('[Football]\nV-League'));
    assert.equal(findNode(container, node => node.dataset.draftId === 'topic-name').value, '');
    assert.equal(findNode(container, node => node.dataset.draftId === 'global').value, 'unfinished');
  } finally { global.document = previousDocument; }
});

test('delete rule keeps group boundaries; delete group keeps section headers and comments', () => {
  const text = '# file\n[GLOBAL_FILTER]\nspam\n\n[WORD_GROUPS]\n\n# note\n[Sports]\nNBA\nplayoff\n\n[Keep]\nrobot\n';
  const group = FrequencyUI.parse(text).blocks.find(block => block.alias?.value === '[Sports]');
  const withoutRule = FrequencyUI.patch(text, {type: 'delete-rule', blockIndex: group.index, start: group.rules[0].start});
  assert.equal(FrequencyUI.parse(withoutRule).blocks.find(block => block.alias?.value === '[Sports]').rules[0].value, 'playoff');
  const withoutGroup = FrequencyUI.patch(text, {type: 'delete-group', blockIndex: group.index});
  assert(!withoutGroup.includes('[Sports]'));
  assert(withoutGroup.includes('# note'));
  assert(withoutGroup.includes('[GLOBAL_FILTER]'));
  assert(withoutGroup.includes('[WORD_GROUPS]'));
  assert.equal(FrequencyUI.parse(withoutGroup).blocks.find(block => block.alias?.value === '[Keep]').section, 'WORD_GROUPS');
  const globalBlock = FrequencyUI.parse(text).blocks.find(block => block.section === 'GLOBAL_FILTER' && block.rules.length);
  const withoutGlobal = FrequencyUI.patch(text, {type: 'delete-group', blockIndex: globalBlock.index});
  assert(!withoutGlobal.includes('spam'));
  assert(withoutGlobal.includes('[GLOBAL_FILTER]'));
});

test('all suggested presets append exact editable words and reject duplicate aliases', () => {
  for (const preset of FrequencyUI.presets) {
    const old = '# original\n[GLOBAL_FILTER]\nspam\n';
    const next = FrequencyUI.patch(old, {type: 'add-preset', id: preset.id});
    assert(next.startsWith(old));
    const group = FrequencyUI.parse(next).blocks.find(block => block.alias?.value === '[' + preset.name + ']');
    assert.equal(group.section, 'WORD_GROUPS');
    assert.deepEqual(group.rules.map(rule => rule.value), preset.words);
    assert.throws(() => FrequencyUI.patch(next, {type: 'add-preset', id: preset.id}));
  }
});

test('delete buttons require confirmation and cancellation leaves draft intact', () => {
  const oldDocument = global.document, oldWindow = global.window;
  global.document = {createElement: tag => new FakeNode(tag)};
  let allowed = false, prompts = 0, changes = [];
  global.window = {confirm: message => { assert(message.includes('Sports')); prompts++; return allowed; }};
  try {
    const container = new FakeNode('div');
    FrequencyUI.render(container, '[Sports]\nNBA\n', next => changes.push(next));
    const button = findNode(container, node => node.textContent === 'Xóa nhóm Sports');
    button.dispatch('click'); assert.equal(changes.length, 0);
    allowed = true; button.dispatch('click'); assert.equal(changes.length, 1);
    assert(!changes[0].includes('[Sports]')); assert.equal(prompts, 2);
  } finally { global.document = oldDocument; global.window = oldWindow; }
});

test('new keyword version removes Han groups and global rules while original remains unchanged', () => {
  const original = '# giữ ghi chú\n[GLOBAL_FILTER]\n震惊\nspam\n\n[WORD_GROUPS]\n\n[混合]\nrobot\n机器人\n\n[Football]\nV-League\n';
  const crlf = FrequencyUI.withoutChineseGroups(original.replaceAll('\n', '\r\n'));
  assert(crlf.includes('[Football]')); assert(crlf.includes('V-League'));
  const next = FrequencyUI.withoutChineseGroups(original);
  const groups = FrequencyUI.parse(next).blocks;
  assert.equal(groups.filter(block => block.alias).length, 1);
  assert.equal(groups.find(block => block.alias).alias.value, '[Football]');
  assert.deepEqual(groups.filter(block => block.section === 'GLOBAL_FILTER').flatMap(block => block.rules.map(rule => rule.value)), ['spam']);
  assert(original.includes('机器人')); assert(next.includes('# giữ ghi chú'));
});
