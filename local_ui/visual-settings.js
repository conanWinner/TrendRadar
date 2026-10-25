/* Các biểu mẫu dùng cùng bản nháp và nút lưu của ứng dụng. */
window.VisualSettings = (() => {
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const safeLabel = (path, value) => {
    const key = String(path.at(-1));
    const labels = window.SettingsLabels || {};
    if (path.length === 1 && labels.sections?.[key]) return labels.sections[key];
    if (path.includes('week_map')) return ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'][Number(key) - 1] || key;
    return labels.fields?.[path.join('.')] || labels.fields?.[key] || labels.sections?.[key] || (value && typeof value === 'object' && value.name) || key.replaceAll('_', ' ');
  };
  const secret = (path, value) => /api_key|password|secret|bot_token|access_key|webhook|(^|\.)token$|notification\.channels\.bark\.url/.test(path.join('.')) || (typeof value === 'string' && /:\/\/[^/]+:[^/]+@|[?&](token|key|secret)=/i.test(value));
  function render(container, text, file, onChange, locked, groups = null) {
    const expanded = new Set([...container.querySelectorAll('details[open]')].map(node => node.dataset.path));
    const drafts = new Map([...container.querySelectorAll('[data-draft-id]')].map(node => [node.dataset.draftId, node.value]));
    container.replaceChildren();
    let root;
    try { root = jsyaml.load(text); if (!root || typeof root !== 'object' || Array.isArray(root)) throw Error(); }
    catch { container.append(el('p', 'help', 'Chưa đọc được thiết lập. Hãy tải lại lựa chọn đã lưu hoặc kiểm tra tệp gốc.')); return; }
    const labels = window.SettingsLabels || {};
    function change(path, value, operation = 'set') { return onChange(file, path, value, operation); }
    function removeButton(parent, path, name, blocked = '') {
      const button = el('button', 'danger', 'Xóa ' + name); button.type = 'button';
      button.dataset.deletePath = JSON.stringify(path); button.disabled = locked || !!blocked;
      button.onclick = () => {
        if (window.confirm('Xóa “' + name + '” khỏi cấu hình? Chỉ áp dụng sau khi bấm “Lưu thay đổi”. Bản cũ sẽ được sao lưu; tin đã thu thập vẫn được giữ.')) change(path, null, 'delete');
      };
      parent.append(button);
      if (blocked) parent.append(el('p', 'help', blocked));
    }
    function draw(parent, value, path) {
      const key = String(path.at(-1));
      if (value !== null && typeof value === 'object') {
        const section = el('details', 'setting-group'); section.dataset.path = path.join('.');
        section.open = expanded.has(section.dataset.path) || path.length === 1 && (file === 'timeline' && key === 'custom');
        const label = safeLabel(path, value); section.append(el('summary', '', label));
        const body = el('div', 'setting-body'); section.append(body); parent.append(section);
        if (Array.isArray(value)) {
          if (!value.length) body.append(el('p', 'help', 'Chưa có mục nào.'));
          value.forEach((item, i) => {
            const row = el('div', 'setting-item'); body.append(row);
            if (item !== null && typeof item === 'object') draw(row, item, [...path, i]);
            else { row.append(el('h3', '', `Mục ${i + 1}`)); draw(row, item, [...path, i]); }
            if (file === 'config' && ['rss.feeds', 'platforms.sources'].includes(path.join('.'))) removeButton(row, [...path, i], item?.name || item?.id || 'nguồn ' + (i + 1));
            if (file === 'timeline' && path.includes('day_plans') && key === 'periods') removeButton(row, [...path, i], 'liên kết khung giờ ' + (i + 1));
          });
          if (file === 'config' && path.join('.') === 'rss.feeds') {
            const add = el('div', 'setting-grid');
            const name = el('input'), url = el('input'), id = el('input');
            name.placeholder = 'Tên nguồn'; url.placeholder = 'https://…'; url.type = 'url'; id.placeholder = 'Mã nguồn duy nhất';
            [name, url, id].forEach((input, i) => { input.dataset.draftId = path.join('.') + ':' + i; });
            for (const [input, title] of [[name, 'Tên nguồn mới'], [url, 'Địa chỉ RSS mới'], [id, 'Mã nguồn mới']]) { const label = el('label', 'field', title); label.append(input); add.append(label); input.disabled = locked; }
            const button = el('button', '', 'Thêm nguồn RSS'); button.type = 'button'; button.disabled = locked;
            button.onclick = async () => {
              const sourceId = id.value.trim(), sourceName = name.value.trim();
              let address; try { address = new URL(url.value.trim()); } catch { window.alert('Nhập địa chỉ RSS hợp lệ.'); return; }
              if (!sourceName || !/^[a-zA-Z0-9_-]+$/.test(sourceId) || value.some(item => item.id === sourceId) || !['http:', 'https:'].includes(address.protocol)) { window.alert('Nhập tên, mã nguồn duy nhất và địa chỉ HTTP hoặc HTTPS.'); return; }
              if (await change(path, {id: sourceId, name: sourceName, url: address.href, enabled: true}, 'append')) container.querySelectorAll('[data-draft-id]').forEach(input => { if (input.dataset.draftId.startsWith(path.join('.') + ':')) input.value = ''; });
            };
            body.append(add, button);
          } else if (value.every(item => typeof item === 'string')) {
            const label = el('label', 'field', 'Thêm một mục'); let input;
            if (file === 'timeline' && path.includes('day_plans') && key === 'periods') {
              input = el('select'); const scope = path.slice(0, path.indexOf('day_plans')); let plan = root; scope.forEach(k => { plan = plan[k]; });
              Object.entries(plan.periods || {}).forEach(([id, period]) => { const option = el('option', '', period.name || id); option.value = id; input.append(option); });
              label.firstChild.textContent = 'Thêm khung giờ vào ngày này';
            } else input = el('input');
            input.disabled = locked; label.append(input);
            input.dataset.draftId = path.join('.') + ':item';
            const button = el('button', '', 'Thêm mục'); button.type = 'button'; button.disabled = locked;
            button.onclick = async () => { if (input.value.trim() && await change(path, input.value.trim(), 'append')) container.querySelectorAll('[data-draft-id]').forEach(node => { if (node.dataset.draftId === path.join('.') + ':item') node.value = ''; }); };
            body.append(label, button);
          }
        } else {
          Object.entries(value).forEach(([k, v]) => draw(body, v, [...path, /^\d+$/.test(k) ? Number(k) : k]));
          if (file === 'timeline' && ['periods', 'day_plans'].includes(path.at(-2))) {
            let plan = root; path.slice(0, -2).forEach(k => { plan = plan[k]; });
            const isPeriod = path.at(-2) === 'periods';
            const used = isPeriod ? Object.values(plan.day_plans || {}).some(day => (day.periods || []).includes(path.at(-1))) : Object.values(plan.week_map || {}).includes(path.at(-1));
            removeButton(body, path, value.name || key, used ? (isPeriod ? 'Đang dùng trong kế hoạch ngày. Bỏ liên kết khung giờ ở kế hoạch đó trước khi xóa.' : 'Đang dùng trong lịch tuần. Chọn kế hoạch khác cho các ngày liên quan trước khi xóa.') : '');
          }
          if (file === 'timeline' && ['periods', 'day_plans'].includes(key)) {
            const field = el('label', 'field', key === 'periods' ? 'Tên khung giờ mới' : 'Tên kế hoạch ngày mới'); const input = el('input'); input.disabled = locked; field.append(input);
            input.dataset.draftId = path.join('.') + ':name';
            const button = el('button', '', key === 'periods' ? 'Thêm khung giờ' : 'Thêm kế hoạch ngày'); button.type = 'button'; button.disabled = locked;
            button.onclick = async () => {
              const name = input.value.trim(); if (!name) return;
              const id = 'custom_' + Date.now().toString(36);
              if (await change([...path, id], key === 'periods' ? {name, start: '08:00', end: '09:00'} : {name, periods: []}, 'add')) container.querySelectorAll('[data-draft-id]').forEach(node => { if (node.dataset.draftId === path.join('.') + ':name') node.value = ''; });
            };
            body.append(field, button);
          }
          if (file === 'timeline' && path.at(-2) === 'periods') {
            for (const task of ['collect', 'analyze', 'push']) if (!Object.hasOwn(value, task)) {
              const label = el('label', 'field', safeLabel([...path, task])); const input = el('select');
              [['', 'Theo mặc định'], ['true', 'Bật trong khung giờ này'], ['false', 'Tắt trong khung giờ này']].forEach(([v, name]) => { const option = el('option', '', name); option.value = v; input.append(option); });
              input.disabled = locked; input.onchange = () => { if (input.value) change([...path, task], input.value === 'true'); };
              label.append(input); body.append(label);
            }
          }
          if (file === 'config' && path[0] === 'rss' && path[1] === 'feeds' && !Object.hasOwn(value, 'enabled')) draw(body, true, [...path, 'enabled']);
        }
        return;
      }
      const label = el('label', 'field', safeLabel(path, value)); let input;
      let options = labels.options?.[path.join('.')] || labels.options?.[key];
      if (file === 'timeline' && path.includes('week_map')) {
        const planPath = path.slice(0, path.indexOf('week_map')); let plan = root; planPath.forEach(k => { plan = plan[k]; });
        options = Object.keys(plan.day_plans || {}).map(v => ({value: v, label: plan.day_plans[v].name || safeLabel([v])}));
      }
      if (file === 'timeline' && path.includes('day_plans') && path.includes('periods') && typeof path.at(-1) === 'number') {
        const scope = path.slice(0, path.indexOf('day_plans')); let plan = root; scope.forEach(k => { plan = plan[k]; });
        options = Object.entries(plan.periods || {}).map(([v, period]) => ({value: v, label: period.name || v}));
      }
      if (typeof value === 'boolean') { input = el('input'); input.type = 'checkbox'; input.checked = value; label.classList.add('toggle'); }
      else if (options?.length && !secret(path, value)) {
        input = el('select');
        if (!options.some(option => String(option.value) === String(value))) options = [{value, label: String(value ?? 'Chưa đặt')}, ...options];
        options.forEach(option => { const node = el('option', '', option.label); node.value = option.value; input.append(node); }); input.value = value ?? '';
      } else {
        input = el('input');
        input.type = secret(path, value) ? 'password' : typeof value === 'number' ? 'number' : ['start', 'end'].includes(key) && file === 'timeline' ? 'time' : 'text';
        input.value = value ?? ''; if (typeof value === 'number') input.step = Number.isInteger(value) ? '1' : 'any';
        input.autocomplete = 'off'; if (input.type === 'password') input.autocomplete = 'new-password';
      }
      input.disabled = locked || key === 'retention_days' || (key === 'id' && file === 'config');
      input.dataset.settingPath = JSON.stringify(path); input.dataset.settingFile = file;
      input.onchange = () => {
        let next = input.type === 'checkbox' ? input.checked : typeof value === 'number' ? Number(input.value) : input.value;
        if (typeof value === 'number' && (!input.value.trim() || !Number.isFinite(next))) { input.value = value; return; }
        if (typeof value === 'number' && Number.isInteger(value) && !Number.isInteger(next)) { input.value = value; return; }
        change(path, next);
      };
      label.append(input);
      const help = key === 'retention_days' ? 'Giữ nguyên để tránh tác vụ tự xóa dữ liệu.' : labels.help?.[path.join('.')] || (secret(path, value) ? 'Thông tin kết nối được che. Không tự gọi dịch vụ khi lưu.' : '');
      if (help) label.append(el('small', 'help', help));
      parent.append(label);
    }
    Object.entries(root).forEach(([key, value]) => { if (file === 'config' && key === 'schedule' || groups && !groups.includes(key)) return; draw(container, value, [key]); });
    container.querySelectorAll('[data-draft-id]').forEach(input => { if (drafts.has(input.dataset.draftId)) input.value = drafts.get(input.dataset.draftId); });
  }
  return {render};
})();
