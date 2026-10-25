(function (root) {
  'use strict';

  const SECTION_WORDS = 'WORD_GROUPS';
  const SECTION_GLOBAL = 'GLOBAL_FILTER';

  const PRESETS = [
    {id: 'technology', name: 'Công nghệ', description: 'Sản phẩm, phần mềm và xu hướng công nghệ.', words: ['công nghệ', 'technology', 'phần mềm', 'software', 'chip', 'bán dẫn', 'semiconductor', 'smartphone']},
    {id: 'robotics', name: 'Robotics', description: 'Robot, tự động hóa và ứng dụng trong sản xuất.', words: ['robot', 'robotics', 'người máy', 'tự động hóa', 'automation', 'humanoid', 'cánh tay robot', 'ROS 2']},
    {id: 'football', name: 'Bóng đá', description: 'Bóng đá Việt Nam và quốc tế.', words: ['bóng đá', 'football', 'soccer', 'V-League', 'V.League', 'Premier League', 'Champions League', 'World Cup', 'tuyển Việt Nam']},
    {id: 'sports', name: 'Thể thao', description: 'Tin tổng hợp về nhiều môn thể thao.', words: ['thể thao', 'sports', 'bóng đá', 'bóng rổ', 'tennis', 'cầu lông', 'badminton', 'bóng chuyền', 'volleyball', 'Olympic']},
    {id: 'basketball', name: 'Bóng rổ', description: 'Bóng rổ Việt Nam và quốc tế.', words: ['bóng rổ', 'basketball', 'NBA', 'WNBA', 'VBA', 'EuroLeague', 'FIBA']},
    {id: 'ai', name: 'AI', description: 'Trí tuệ nhân tạo, mô hình và ứng dụng.', words: ['trí tuệ nhân tạo', 'artificial intelligence', 'machine learning', 'học máy', 'LLM', 'generative AI', 'OpenAI', 'Gemini', 'Claude']},
  ];

  function splitBlocks(text) {
    const blocks = [];
    let start = 0;
    let match;
    const separator = /\r?\n\r?\n/g;
    while ((match = separator.exec(text))) {
      blocks.push({raw: text.slice(start, match.index), start, end: match.index});
      start = match.index + match[0].length;
    }
    blocks.push({raw: text.slice(start), start, end: text.length});
    return blocks;
  }

  function parse(text) {
    if (typeof text !== 'string') throw new TypeError('Nội dung từ khóa phải là văn bản.');
    let activeSection = SECTION_WORDS;
    const blocks = splitBlocks(text).map((block, index) => {
      const lines = [];
      let offset = block.start;
      for (const raw of block.raw.split('\n')) {
        const content = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        const trimmed = content.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          lines.push({raw: content, value: trimmed, start: offset, end: offset + content.length});
        }
        offset += raw.length + 1;
      }

      let header = null;
      if (lines[0]?.value.startsWith('[') && lines[0].value.endsWith(']')) {
        const candidate = lines[0].value.slice(1, -1).toUpperCase();
        if (candidate === SECTION_WORDS || candidate === SECTION_GLOBAL) {
          header = lines.shift();
          activeSection = candidate;
        }
      }

      let alias = null;
      if (activeSection === SECTION_WORDS && lines[0]?.value.startsWith('[') && lines[0].value.endsWith(']')) {
        alias = lines.shift();
      }

      const rules = lines.map(line => {
        const value = line.value;
        const prefix = value[0];
        const kind = prefix === '+' ? 'required'
          : prefix === '!' ? 'exclude'
            : prefix === '@' ? 'limit' : 'normal';
        const effective = activeSection !== SECTION_GLOBAL || !['+', '!', '@'].includes(prefix);
        const withoutPrefix = ['required', 'exclude', 'limit'].includes(kind) ? value.slice(1).trim() : value;
        const aliasParts = withoutPrefix.split(/\s*=>\s*/, 2);
        const expression = aliasParts[0].trim();
        const displayAlias = aliasParts.length > 1 && aliasParts[1].trim() ? aliasParts[1].trim() : null;
        const regex = expression.match(/^\/(.+)\/([a-z]*)$/);
        return {
          ...line,
          kind,
          section: activeSection,
          effective,
          expression,
          displayAlias,
          isRegex: !!regex,
          regexPattern: regex ? regex[1] : null,
          regexFlags: regex ? regex[2] : '',
        };
      });
      return {index, ...block, section: activeSection, header, alias, rules};
    });
    return {blocks, sections: [...new Set(blocks.map(block => block.section))]};
  }

  function patch(text, operation) {
    const parsed = parse(text);
    if (!operation || typeof operation !== 'object') throw new TypeError('Thao tác từ khóa không hợp lệ.');
    if (operation.type === 'add-preset') {
      const preset = PRESETS.find(item => item.id === operation.id);
      if (!preset) throw new TypeError('Bộ theo dõi không hợp lệ.');
      if (parsed.blocks.some(block => block.alias?.value.slice(1, -1).trim().toLocaleLowerCase('vi') === preset.name.toLocaleLowerCase('vi'))) throw new TypeError('Nhóm này đã có. Hãy chỉnh nhóm hiện có.');
      let next = patch(text, {type: 'add-topic', name: preset.name, value: preset.words[0]});
      for (const word of preset.words.slice(1)) {
        const block = parse(next).blocks.find(block => block.alias?.value === '[' + preset.name + ']');
        next = patch(next, {type: 'add-rule', blockIndex: block.index, value: word});
      }
      return next;
    }
    if (operation.type === 'delete-group' || operation.type === 'delete-rule') {
      const block = parsed.blocks[operation.blockIndex];
      if (!block || (!block.alias && !block.rules.length)) throw new TypeError('Không tìm thấy nhóm cần xóa.');
      const removed = operation.type === 'delete-group' ? [...block.rules, ...(block.alias ? [block.alias] : [])] : [block.rules.find(rule => rule.start === operation.start)];
      if (removed.some(line => !line)) throw new TypeError('Không tìm thấy quy tắc cần xóa.');
      const starts = new Set(removed.map(line => line.start));
      let offset = block.start;
      const kept = block.raw.split('\n').filter(line => {
        const keep = !starts.has(offset); offset += line.length + 1; return keep;
      });
      return text.slice(0, block.start) + kept.join('\n') + text.slice(block.end);
    }
    if (operation.type === 'replace') {
      const {start, end, value} = operation;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length || typeof value !== 'string') {
        throw new TypeError('Dòng cần sửa không hợp lệ.');
      }
      const aliasBlock = parsed.blocks.find(block => block.alias && block.alias.start === start && block.alias.end === end);
      if (aliasBlock) throw new TypeError('Hãy đổi tên nhóm bằng thao tác đổi tên an toàn.');
      return text.slice(0, start) + value + text.slice(end);
    }
    if (operation.type === 'rename-alias') {
      const block = parsed.blocks[operation.blockIndex];
      const name = typeof operation.name === 'string' ? operation.name.trim() : '';
      if (!block?.alias || !name || reservedName(name) || /[\[\]\r\n]/.test(name)) throw new TypeError('Tên này dành riêng cho cấu trúc tệp hoặc không hợp lệ.');
      return text.slice(0, block.alias.start) + '[' + name + ']' + text.slice(block.alias.end);
    }
    if (operation.type === 'add-rule') {
      const block = parsed.blocks[operation.blockIndex];
      if (!block || block.section !== SECTION_WORDS || !validRule(operation.value)) throw new TypeError('Không thể thêm quy tắc vào nhóm này.');
      return insertInBlock(text, block, operation.value);
    }
    if (operation.type === 'add-topic') {
      const name = typeof operation.name === 'string' ? operation.name.trim() : '';
      const rule = operation.value;
      if (!name || reservedName(name) || /[\[\]\r\n]/.test(name) || !validRule(rule)) throw new TypeError('Tên chủ đề không hợp lệ hoặc dành riêng. Hãy nhập tên khác và một quy tắc hợp lệ.');
      const needsSection = parsed.blocks.at(-1)?.section !== SECTION_WORDS;
      const separator = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
      const prefix = separator + (needsSection ? '[WORD_GROUPS]\n\n' : '');
      return text + prefix + '[' + name + ']\n' + rule;
    }
    if (operation.type === 'add-global') {
      const value = typeof operation.value === 'string' ? operation.value.trim() : '';
      if (!value || /[\r\n]/.test(value) || /^[!+@]/.test(value) || /^\[.*\]$/.test(value)) throw new TypeError('Nhập một từ hoặc cụm từ loại trừ thông thường.');
      const endsInGlobal = parsed.blocks.at(-1)?.section === SECTION_GLOBAL;
      if (endsInGlobal) return text + (text.endsWith('\n') ? '' : '\n') + value;
      const separator = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
      return text + separator + '[GLOBAL_FILTER]\n\n' + value;
    }
    throw new TypeError('Loại thao tác từ khóa không được hỗ trợ.');
  }

  function withoutChineseGroups(text) {
    const han = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3134f}]/u;
    let next = text;
    for (;;) {
      const block = parse(next).blocks.find(block => block.section === SECTION_WORDS && (han.test(block.alias?.value || '') || block.rules.some(rule => han.test(rule.value))));
      if (!block) break;
      next = patch(next, {type: 'delete-group', blockIndex: block.index});
    }
    for (;;) {
      const block = parse(next).blocks.find(block => block.section === SECTION_GLOBAL && block.rules.some(rule => han.test(rule.value)));
      if (!block) break;
      const rule = block.rules.find(rule => han.test(rule.value));
      next = patch(next, {type: 'delete-rule', blockIndex: block.index, start: rule.start});
    }
    return next;
  }

  function validRule(value) {
    return typeof value === 'string' && value.trim().length > 0 && !/[\r\n]/.test(value);
  }

  function reservedName(value) {
    return ['GLOBAL_FILTER', 'WORD_GROUPS'].includes(value.trim().toUpperCase());
  }

  function insertInBlock(text, block, value) {
    const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
    let insertion = block.end;
    if (insertion > block.start && text[insertion - 1] !== '\n') return text.slice(0, insertion) + lineEnding + value + text.slice(insertion);
    return text.slice(0, insertion) + value + text.slice(insertion);
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function render(container, text, onChange, disabled = false) {
    if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('Cần vùng hiển thị từ khóa.');
    if (typeof onChange !== 'function') throw new TypeError('Cần hàm nhận nội dung chưa lưu.');
    const parsed = parse(text);
    const rootNode = element('div', undefined, 'frequency-ui');
    const expanded = new Map();
    const expandedTools = new Map();
    const drafts = new Map();
    if (typeof container.querySelectorAll === 'function') {
      for (const field of container.querySelectorAll('[data-draft-id]')) drafts.set(field.dataset.draftId, {value: field.value, checked: field.checked});
      for (const tool of container.querySelectorAll('details[data-tool-id]')) expandedTools.set(tool.dataset.toolId, tool.open);
      for (const details of container.querySelectorAll('details[data-frequency-index]')) {
        expanded.set(Number(details.dataset.frequencyIndex), details.open);
      }
    }
    const help = element('p', 'Chỉnh từng nhóm theo dõi bên dưới. Thay đổi sẽ được lưu cùng các cài đặt khác.');
    rootNode.append(help);

    const layout = element('div', undefined, 'frequency-editor-layout');
    const groups = element('div', undefined, 'frequency-groups');
    const tools = element('aside', undefined, 'frequency-tools');
    layout.append(groups, tools); rootNode.append(layout);
    const notify = nextText => onChange(nextText);
    function draft(field, id) { field.dataset.draftId = id; return field; }
    function submitDraft(nextText, fields) {
      const old = fields.map(field => ({value: field.value, checked: field.checked}));
      fields.forEach(field => { field.value = ''; field.checked = false; });
      try {
        if (notify(nextText) === false) fields.forEach((field, i) => Object.assign(field, old[i]));
      } catch (error) { fields.forEach((field, i) => Object.assign(field, old[i])); throw error; }
    }
    const presets = element('div', undefined, 'topic-presets');
    presets.append(element('h3', 'Bộ theo dõi gợi ý'), element('p', 'Chọn một bộ để xem từ khóa. Chỉ thêm nhóm mới; nguồn tin và các nhóm đang có vẫn được giữ.'));
    const chooserLabel = element('label', 'Chủ đề gợi ý');
    const chooser = element('select'); chooser.disabled = disabled; chooser.dataset.draftId = 'preset-choice';
    PRESETS.forEach(preset => { const option = element('option', preset.name); option.value = preset.id; chooser.append(option); });
    chooser.value = drafts.get('preset-choice')?.value || PRESETS[0].id;
    chooserLabel.append(chooser);
    const description = element('p'); const words = element('p');
    const addPreset = element('button', 'Thêm bộ theo dõi'); addPreset.type = 'button';
    const updatePreset = () => {
      const preset = PRESETS.find(item => item.id === chooser.value);
      description.textContent = preset.description;
      words.textContent = 'Từ khóa: ' + preset.words.join(', ');
      addPreset.disabled = disabled || parsed.blocks.some(block => block.alias?.value.slice(1, -1).trim().toLocaleLowerCase('vi') === preset.name.toLocaleLowerCase('vi'));
      addPreset.textContent = addPreset.disabled && !disabled ? 'Nhóm đã có trong danh sách' : 'Thêm bộ theo dõi';
    };
    chooser.addEventListener('change', updatePreset); updatePreset();
    addPreset.addEventListener('click', () => { try { notify(patch(text, {type: 'add-preset', id: chooser.value})); } catch (error) { window.alert(error.message); } });
    presets.append(chooserLabel, description, words, addPreset, element('small', 'Bạn có thể chỉnh lại từ khóa trước khi lưu. Bộ gợi ý không tự thêm nguồn hoặc phân loại Việt Nam/Quốc tế.'));
    tools.append(presets);
    function deleteButton(parent, label, operation) {
      const button = element('button', 'Xóa ' + label, 'danger'); button.type = 'button'; button.disabled = disabled;
      button.addEventListener('click', () => {
        if (window.confirm('Xóa “' + label + '” khỏi danh sách theo dõi? Chỉ áp dụng sau khi bấm “Lưu thay đổi”. Bản cũ được sao lưu; tin đã thu thập vẫn được giữ.')) notify(patch(text, operation));
      });
      parent.append(button);
    }
    parsed.blocks.forEach(block => {
      if (!block.alias && !block.rules.length) return;
      const details = element('details', undefined, 'frequency-block');
      details.dataset.frequencyIndex = String(block.index);
      details.open = expanded.has(block.index) ? expanded.get(block.index) : false;
      const summaryName = block.section === SECTION_GLOBAL ? 'Từ loại trừ chung'
        : block.alias ? block.alias.value.slice(1, -1).trim()
          : block.rules.slice(0, 3).map(rule => rule.displayAlias || rule.expression).join(' / ') || 'Nhóm từ khóa';
      const summary = element('summary', summaryName); summary.append(element('span', ' · ' + block.rules.length + ' quy tắc', 'group-count')); details.append(summary);
      const section = element('div', undefined, 'frequency-block-content');
      deleteButton(section, 'nhóm ' + summaryName, {type: 'delete-group', blockIndex: block.index});
      if (block.alias) {
        const aliasLabel = element('label', 'Tên nhóm');
        const aliasInput = element('input');
        aliasInput.type = 'text';
        aliasInput.value = block.alias.value.slice(1, -1).trim();
        aliasInput.disabled = disabled;
        aliasInput.setAttribute('aria-label', 'Tên nhóm từ khóa');
        aliasInput.addEventListener('change', () => {
          const value = aliasInput.value.trim();
          if (!value || reservedName(value) || /[\[\]\r\n]/.test(value)) { aliasInput.value = block.alias.value.slice(1, -1).trim(); return; }
          if (value !== block.alias.value.slice(1, -1).trim()) notify(patch(text, {type: 'rename-alias', blockIndex: block.index, name: value}));
        });
        aliasLabel.append(aliasInput);
        section.append(aliasLabel);
      }
      block.rules.forEach(rule => {
        const row = element('div', undefined, 'frequency-rule');
        const globalRule = rule.section === SECTION_GLOBAL;
        const kindSelect = createKindSelect(globalRule && !rule.effective ? 'normal' : (globalRule ? 'normal' : rule.kind), disabled || globalRule);
        const valueInput = element('input');
        valueInput.type = rule.kind === 'limit' && !globalRule ? 'number' : 'text';
        valueInput.min = '1';
        valueInput.value = globalRule ? rule.value : (rule.kind === 'limit' ? rule.expression : (rule.isRegex ? rule.regexPattern : rule.expression));
        valueInput.disabled = disabled;
        valueInput.setAttribute('aria-label', globalRule ? 'Từ loại trừ chung' : 'Nội dung quy tắc');
        const aliasInput = element('input');
        aliasInput.type = 'text';
        aliasInput.value = globalRule ? '' : (rule.displayAlias || '');
        aliasInput.placeholder = 'Tên hiển thị (không bắt buộc)';
        aliasInput.disabled = disabled || globalRule || rule.kind === 'limit';
        aliasInput.setAttribute('aria-label', 'Tên hiển thị');
        const regexLabel = element('label', 'Biểu thức chính quy');
        const regexInput = element('input');
        regexInput.type = 'checkbox';
        regexInput.checked = !globalRule && rule.kind !== 'limit' && rule.isRegex;
        regexInput.disabled = disabled || globalRule || rule.kind === 'limit';
        regexLabel.append(regexInput);
        if (globalRule) {
          row.append(element('span', 'Từ loại trừ chung'));
        } else {
          const typeLabel = element('label', 'Loại quy tắc');
          typeLabel.append(kindSelect);
          row.append(typeLabel);
        }
        const valueLabel = element('label', globalRule ? 'Từ/cụm từ' : (rule.kind === 'limit' ? 'Số tin tối đa' : 'Nội dung'));
        valueLabel.append(valueInput);
        row.append(valueLabel);
        if (!globalRule && rule.kind !== 'limit') {
          const aliasLabel = element('label', 'Tên hiển thị');
          aliasLabel.append(aliasInput);
          row.append(aliasLabel, regexLabel);
        }
        const serialize = () => {
          if (globalRule) return valueInput.value.trim();
          return serializeRule({
            kind: kindSelect.value,
            value: valueInput.value.trim(),
            alias: aliasInput.value.trim(),
            isRegex: regexInput.checked,
            regexFlags: rule.regexFlags,
          });
        };
        const edit = () => {
          const nextRule = serialize();
          if (!validRule(nextRule) || (kindSelect.value === 'limit' && (!/^\d+$/.test(valueInput.value) || Number(valueInput.value) < 1))) {
            valueInput.value = rule.kind === 'limit' ? rule.expression : (rule.isRegex ? rule.regexPattern : rule.expression);
            return;
          }
          if (nextRule !== rule.raw) notify(patch(text, {type: 'replace', start: rule.start, end: rule.end, value: nextRule}));
        };
        kindSelect.addEventListener('change', () => {
          const isLimit = kindSelect.value === 'limit';
          valueInput.type = isLimit ? 'number' : 'text';
          aliasInput.disabled = disabled || isLimit;
          regexInput.disabled = disabled || isLimit;
          valueLabel.firstChild.textContent = isLimit ? 'Số tin tối đa' : 'Nội dung';
          if (isLimit && rule.kind !== 'limit') { valueInput.value = ''; valueInput.placeholder = 'Ví dụ: 5'; return; }
          edit();
        });
        valueInput.addEventListener('change', edit);
        aliasInput.addEventListener('change', edit);
        regexInput.addEventListener('change', edit);
        row.append(element('small', globalRule
          ? (rule.effective ? 'Khớp chuỗi chính xác; không dùng tên hiển thị hoặc biểu thức.' : 'Cú pháp đặc biệt này bị bộ lọc bỏ qua trong phần loại trừ chung.')
          : (rule.kind === 'exclude' ? 'Từ loại trừ có hiệu lực trên toàn bộ nhóm theo dõi.' : ruleDescription(rule))));
        deleteButton(row, ruleLabel(rule) + ': ' + rule.value, {type: 'delete-rule', blockIndex: block.index, start: rule.start});
        section.append(row);
      });
      if (block.section === SECTION_WORDS && (block.rules.length || block.alias)) {
        const addForm = element('form', undefined, 'frequency-add-rule');
        const addKind = createKindSelect('normal', disabled);
        const input = element('input'); input.type = 'text'; input.disabled = disabled;
        input.setAttribute('aria-label', 'Nội dung quy tắc mới');
        const alias = element('input'); alias.type = 'text'; alias.disabled = disabled; alias.placeholder = 'Tên hiển thị (không bắt buộc)';
        const regex = element('input'); regex.type = 'checkbox'; regex.disabled = disabled;
        draft(input, 'rule-' + block.index); draft(alias, 'alias-' + block.index); draft(regex, 'regex-' + block.index); draft(addKind, 'kind-' + block.index);
        const label = element('label', 'Nội dung quy tắc mới'); label.append(input);
        const typeLabel = element('label', 'Loại quy tắc'); typeLabel.append(addKind);
        const aliasLabel = element('label', 'Tên hiển thị'); aliasLabel.append(alias);
        const regexLabel = element('label', 'Biểu thức chính quy'); regexLabel.append(regex);
        const button = element('button', 'Thêm quy tắc');
        button.type = 'submit';
        button.disabled = disabled;
        addKind.addEventListener('change', () => {
          const isLimit = addKind.value === 'limit';
          input.type = isLimit ? 'number' : 'text';
          input.value = '';
          input.placeholder = isLimit ? 'Ví dụ: 5' : '';
          alias.disabled = disabled || isLimit;
          regex.disabled = disabled || isLimit;
        });
        addForm.addEventListener('submit', event => {
          event.preventDefault();
          const value = serializeRule({kind: addKind.value, value: input.value.trim(), alias: alias.value.trim(), isRegex: regex.checked, regexFlags: 'i'});
          if (!validRule(value) || (addKind.value === 'limit' && (!/^\d+$/.test(input.value) || Number(input.value) < 1))) return;
          submitDraft(patch(text, {type: 'add-rule', blockIndex: block.index, value}), [input, alias, regex]);
        });
        addForm.append(typeLabel, label, aliasLabel, regexLabel, button);
        section.append(addForm);
      }
      details.append(section);
      groups.append(details);
    });

    const topicForm = element('form', undefined, 'frequency-add-topic');
    topicForm.append(element('h3', 'Thêm chủ đề'));
    const topicLabel = element('label', 'Tên chủ đề');
    const topicInput = element('input');
    topicInput.type = 'text'; topicInput.maxLength = 100; topicInput.disabled = disabled;
    topicInput.placeholder = 'Ví dụ: Bóng đá Việt Nam';
    topicLabel.append(topicInput);
    const ruleLabelNode = element('label', 'Quy tắc đầu tiên');
    const ruleInput = element('input');
    ruleInput.type = 'text'; ruleInput.disabled = disabled;
    ruleInput.placeholder = 'Ví dụ: V-League';
    ruleLabelNode.append(ruleInput);
    const addTopicButton = element('button', 'Thêm chủ đề');
    addTopicButton.type = 'submit'; addTopicButton.disabled = disabled;
    topicForm.append(topicLabel, ruleLabelNode, addTopicButton);
    topicForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!topicInput.value.trim() || !validRule(ruleInput.value)) return;
      submitDraft(patch(text, {type: 'add-topic', name: topicInput.value, value: ruleInput.value.trim()}), [topicInput, ruleInput]);
    });
    const customTopic = element('details', undefined, 'tool-section'); customTopic.dataset.toolId = 'custom-topic'; customTopic.open = expandedTools.get('custom-topic') || false; customTopic.append(element('summary', 'Thêm chủ đề riêng'), topicForm);
    tools.append(customTopic);

    const globalForm = element('form', undefined, 'frequency-add-global-filter');
    globalForm.append(element('h3', 'Thêm từ loại trừ chung'));
    globalForm.append(element('p', 'Từ này loại tin trên tất cả nhóm theo dõi. Nhập từ hoặc cụm từ thông thường.'));
    const globalLabel = element('label', 'Từ/cụm từ');
    const globalInput = element('input'); globalInput.type = 'text'; globalInput.disabled = disabled;
    globalLabel.append(globalInput);
    const globalButton = element('button', 'Thêm từ loại trừ'); globalButton.type = 'submit'; globalButton.disabled = disabled;
    globalForm.append(globalLabel, globalButton);
    globalForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!globalInput.value.trim()) return;
      submitDraft(patch(text, {type: 'add-global', value: globalInput.value}), [globalInput]);
    });
    const globalTool = element('details', undefined, 'tool-section'); globalTool.dataset.toolId = 'global-filter'; globalTool.open = expandedTools.get('global-filter') || false; globalTool.append(element('summary', 'Thêm từ loại trừ chung'), globalForm);
    tools.append(globalTool);
    draft(topicInput, 'topic-name'); draft(ruleInput, 'topic-rule'); draft(globalInput, 'global');
    for (const field of rootNode.querySelectorAll('[data-draft-id]')) if (drafts.has(field.dataset.draftId)) Object.assign(field, drafts.get(field.dataset.draftId));
    container.replaceChildren(rootNode);
  }

  function ruleLabel(rule) {
    if (rule.section === SECTION_GLOBAL) return 'Từ loại trừ chung';
    return ({required: 'Từ bắt buộc', exclude: 'Từ loại trừ', limit: 'Giới hạn nhóm', normal: 'Từ khóa'})[rule.kind];
  }

  function createKindSelect(value, disabled) {
    const select = element('select');
    for (const [kind, label] of [
      ['normal', 'Theo dõi'],
      ['required', 'Bắt buộc'],
      ['exclude', 'Loại trừ'],
      ['limit', 'Giới hạn số tin'],
    ]) {
      const option = element('option', label);
      option.value = kind;
      select.append(option);
    }
    select.value = value === 'required' || value === 'exclude' || value === 'limit' ? value : 'normal';
    select.disabled = disabled;
    select.setAttribute('aria-label', 'Loại quy tắc');
    return select;
  }

  function serializeRule({kind, value, alias = '', isRegex = false, regexFlags = ''}) {
    const prefixes = {normal: '', required: '+', exclude: '!', limit: '@'};
    if (!Object.hasOwn(prefixes, kind)) throw new TypeError('Loại quy tắc không hợp lệ.');
    const content = String(value ?? '').trim();
    if (!content) return '';
    const body = kind === 'limit' ? content : (isRegex ? '/' + content + '/' + regexFlags : content);
    const displayAlias = kind === 'limit' ? '' : String(alias ?? '').trim();
    return prefixes[kind] + body + (displayAlias ? ' => ' + displayAlias : '');
  }

  function ruleAriaLabel(rule) {
    const label = ruleLabel(rule);
    if (rule.displayAlias) return label + ', tên hiển thị ' + rule.displayAlias;
    if (rule.isRegex) return label + ', biểu thức tìm kiếm';
    return label;
  }

  function ruleDescription(rule) {
    const parts = [];
    if (rule.kind === 'required') parts.push('Phải khớp trong tiêu đề.');
    if (rule.kind === 'limit') parts.push('Giới hạn số tin hiển thị của nhóm.');
    if (rule.isRegex) parts.push('Dùng biểu thức tìm kiếm.');
    if (rule.displayAlias) parts.push('Tên hiển thị: ' + rule.displayAlias + '.');
    return parts.join(' ') || 'Khớp nội dung tiêu đề.';
  }

  const api = {render, parse, patch, presets: PRESETS, withoutChineseGroups};
  root.FrequencyUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
