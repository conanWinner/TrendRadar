/* Sửa đúng một giá trị, giữ nguyên các trường khác và bình luận trong tệp. */
window.ConfigTools = (() => {
  const isMap = value => !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
  function readSettings(configText, timelineText) {
    let config, timeline;
    try { config = jsyaml.load(configText); timeline = jsyaml.load(timelineText); }
    catch { throw new Error('Thiết lập có lỗi cấu trúc. Mở Cài đặt nâng cao để sửa thụt lề hoặc tải lại lựa chọn đã lưu.'); }
    if (!isMap(config) || !isMap(timeline)) throw new Error('Thiết lập ứng dụng và lịch xử lý phải là các nhóm thiết lập, không được để trống.');
    for (const key of ['app', 'platforms', 'rss', 'report', 'filter', 'notification', 'ai', 'ai_analysis', 'ai_translation', 'schedule', 'storage', 'advanced']) {
      if (Object.hasOwn(config, key) && !isMap(config[key])) throw new Error('Một phần thiết lập phải là nhóm cấu hình. Kiểm tra Cài đặt nâng cao.');
      if (config[key] && Object.hasOwn(config[key], 'enabled') && typeof config[key].enabled !== 'boolean') throw new Error('Công tắc enabled phải là true hoặc false, không đặt trong dấu ngoặc kép.');
    }
    if (config.rss?.feeds !== undefined && (!Array.isArray(config.rss.feeds) || config.rss.feeds.some(feed => !isMap(feed) || (feed.enabled !== undefined && typeof feed.enabled !== 'boolean')))) throw new Error('Danh sách nguồn tin không hợp lệ. Mở Cài đặt nâng cao để kiểm tra.');
    if (timeline.presets !== undefined && !isMap(timeline.presets)) throw new Error('Danh sách chế độ xử lý không hợp lệ. Kiểm tra tệp khung giờ trong Cài đặt nâng cao.');
    if (timeline.custom !== undefined && !isMap(timeline.custom)) throw new Error('Chế độ tự đặt không hợp lệ. Kiểm tra tệp khung giờ trong Cài đặt nâng cao.');
    const choices = {...timeline.presets, ...(timeline.custom ? {custom: timeline.custom} : {})};
    if (Object.values(choices).some(preset => !isMap(preset) || (preset.name !== undefined && typeof preset.name !== 'string') || (preset.description !== undefined && typeof preset.description !== 'string'))) throw new Error('Nội dung chế độ xử lý không hợp lệ. Kiểm tra Cài đặt nâng cao.');
    if (config.schedule?.preset !== undefined && typeof config.schedule.preset !== 'string') throw new Error('Mã chế độ xử lý phải là văn bản. Kiểm tra Cài đặt nâng cao.');
    if (config.schedule?.enabled && !Object.hasOwn(choices, config.schedule.preset)) throw new Error('Chế độ xử lý đang bật nhưng không có trong tệp khung giờ. Sửa mã chế độ trong Cài đặt nâng cao.');
    return {config, timeline, choices};
  }
  function commentAt(line) {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote === '"' && c === '\\') { i++; continue; }
      if (quote) { if (c === quote) { if (quote === "'" && line[i + 1] === "'") i++; else quote = null; } }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return i;
    }
    return -1;
  }
  function setScalar(text, path, value) {
    if (!Array.isArray(path) || !([2, 4].includes(path.length)) || path.some(key => !['string', 'number'].includes(typeof key)) || path.filter(key => typeof key === 'string').some(key => !/^[a-z_]+$/.test(key))) throw new Error('Không thể sửa an toàn trường thiết lập này.');
    const before = jsyaml.load(text);
    const expected = structuredClone(before);
    let obj = expected;
    for (const key of path.slice(0, -1)) {
      if (!obj || !Object.hasOwn(obj, key)) throw new Error('Thiếu mục thiết lập. Hãy kiểm tra Cài đặt nâng cao.');
      obj = obj[key];
    }
    obj[path.at(-1)] = value;
    const lines = text.split('\n');
    const start = lines.findIndex(line => line.startsWith(path[0] + ':'));
    if (start < 0) throw new Error('Không tìm thấy mục thiết lập.');
    let end = lines.findIndex((line, i) => i > start && /^\S[^:]*:/.test(line) && !line.startsWith('#'));
    if (end < 0) end = lines.length;
    let indent = 2, insertion = start + 1;
    let targetStart = start + 1;
    if (path.length === 4) {
      const listLine = lines.findIndex((line, i) => i > start && i < end && new RegExp('^  ' + path[1] + ':').test(line));
      if (listLine < 0) throw new Error('Không tìm thấy danh sách nguồn.');
      const nextField = lines.findIndex((line, i) => i > listLine && i < end && /^  [a-z_]+:/.test(line));
      if (nextField >= 0) end = nextField;
      const items = [];
      for (let i = listLine + 1; i < end; i++) if (/^    -\s/.test(lines[i])) items.push(i);
      const itemStart = items[path[2]];
      if (itemStart === undefined) throw new Error('Không tìm thấy nguồn đã chọn.');
      end = items[path[2] + 1] ?? end;
      targetStart = itemStart;
      insertion = itemStart + 1;
      indent = 6;
    }
    const key = path.at(-1);
    const matcher = new RegExp('^( {' + indent + '}| {' + (indent - 2) + '}- )' + key + ':([ \\t]*)(.*)$');
    const index = lines.findIndex((line, i) => i >= targetStart && i < end && matcher.test(line));
    const scalar = typeof value === 'string' ? JSON.stringify(value) : String(value);
    if (index < 0) lines.splice(insertion, 0, ' '.repeat(indent) + key + ': ' + scalar);
    else {
      const old = lines[index], match = old.match(matcher), hash = commentAt(old);
      const comment = hash >= 0 ? ' ' + old.slice(hash) : '';
      lines[index] = match[1] + key + ': ' + scalar + comment;
    }
    const result = lines.join('\n');
    if (JSON.stringify(jsyaml.load(result)) !== JSON.stringify(expected)) {
      // Thứ tự khóa có thể thay đổi khi thêm một trường, so sánh cấu trúc theo khóa.
      const normalize = x => Array.isArray(x) ? x.map(normalize) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, normalize(x[k])])) : x;
      if (JSON.stringify(normalize(jsyaml.load(result))) !== JSON.stringify(normalize(expected))) throw new Error('Không thể sửa an toàn cấu trúc này. Hãy dùng Cài đặt nâng cao.');
    }
    return result;
  }
  function topicNames(text) {
    const names = []; let words = [], name = '', active = false;
    function flush() {
      if (!words.length) { name = ''; return; }
      names.push(name || words.map(w => w.includes('=>') ? w.split('=>').slice(1).join('=>').trim() : /[\u4e00-\u9fff]/.test(w) ? '' : w).filter(Boolean).join(' / ') || `Chủ đề ${names.length + 1}`);
      words = []; name = '';
    }
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (s.toUpperCase() === '[WORD_GROUPS]') { flush(); active = true; continue; }
      if (s.toUpperCase() === '[GLOBAL_FILTER]') { flush(); active = false; continue; }
      if (!active || s.startsWith('#')) continue;
      if (!s) { flush(); continue; }
      if (/^\[.+\]$/.test(s)) name = s.slice(1, -1);
      else if (s.startsWith('+') && s.length > 1) words.push(s.slice(1).trim());
      else if (!/^[!@]/.test(s)) words.push(s);
    }
    flush(); return names;
  }
  function addTopic(text, name, input) {
    name = name.trim();
    const words = input.split(',').map(w => w.trim()).filter(Boolean);
    if (!name || !words.length) throw new Error('Hãy nhập tên chủ đề và ít nhất một từ khóa.');
    if (['GLOBAL_FILTER', 'WORD_GROUPS'].includes(name.toUpperCase())) throw new Error('Tên này dành cho cấu trúc tệp. Hãy dùng tên chủ đề khác.');
    if (/[\[\]\r\n]/.test(name) || words.some(w => /[\r\n\[\]]|=>/.test(w) || /^[!+@/#]/.test(w))) throw new Error('Dùng tên và từ khóa thông thường; quy tắc đặc biệt nằm trong Cài đặt nâng cao.');
    if (!/^\[WORD_GROUPS\]\s*$/m.test(text)) throw new Error('Thiếu phần nhóm từ khóa. Hãy kiểm tra Cài đặt nâng cao.');
    // Tệp nâng cao có thể kết thúc bằng phần loại trừ: mở lại đúng phần theo dõi.
    const sections = [...text.matchAll(/^\[(GLOBAL_FILTER|WORD_GROUPS)\]\s*$/gim)];
    const section = sections.at(-1)?.[1].toUpperCase();
    return text + (section === 'WORD_GROUPS' ? '' : '\n\n[WORD_GROUPS]') + '\n\n[' + name + ']\n' + words.join('\n') + '\n';
  }
  return {readSettings, setScalar, topicNames, addTopic};
})();
