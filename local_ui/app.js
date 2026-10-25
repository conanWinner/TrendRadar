const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="app-token"]').content;
const editorIds = {config: 'yaml-editor', frequency: 'frequency-editor', timeline: 'timeline-editor'};
let revision, reports = [], finished, editorReady = false, dirty = false, busy = false, saving = false, connected = false, savedContents, settingsValid = false, settingsError = '', reportsLoaded = false, pendingSave = null, previewing = false;
let pendingSaveAttempts = [];
let pendingVisual = null;
let catalogLoaded = false, catalogLoading = false;
let versionsLoaded = false;
let versionDraftName = "";
let selectedReportId = null, selectedReportRevision = null, trashedReports = [], historyWorking = false, pendingHistory = null;
const newsWorkspace = window.NewsWorkspace?.mount({
  workspace: $('news-workspace'), list: $('news-list'), detail: $('news-detail'),
  search: $('news-search'), filters: $('news-filter-list'), count: $('news-count'),
  viewToggle: $('report-view-toggle'), frame: $('report-frame')
});
function setTheme(theme) {
  document.body.dataset.theme = theme === 'calm' ? 'calm' : 'playful';
  if ($('theme-toggle')) {
    $('theme-toggle').textContent = theme === 'calm' ? 'Giao diện cá tính' : 'Giao diện nhẹ nhàng';
    $('theme-toggle').setAttribute('aria-pressed', String(theme === 'calm'));
  }
  try { localStorage.setItem('trendradar-ui-theme', document.body.dataset.theme); } catch { /* Vẫn đổi được giao diện khi trình duyệt không cho lưu. */ }
}
let initialTheme = 'playful';
try { initialTheme = localStorage.getItem('trendradar-ui-theme') || initialTheme; } catch { /* Dùng giao diện mặc định. */ }
setTheme(initialTheme);
if ($('theme-toggle')) $('theme-toggle').onclick = () => setTheme(document.body.dataset.theme === 'calm' ? 'playful' : 'calm');
async function api(path, data) {
  const response = await fetch('/api/' + path, {method: data ? 'POST' : 'GET', headers: {'X-App-Token': token, 'Content-Type': 'application/json'}, body: data ? JSON.stringify(data) : undefined});
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Không thực hiện được yêu cầu.');
    error.status = response.status;
    throw error;
  }
  return result;
}
function message(text) { $('message').textContent = text; }
function contents() { return Object.fromEntries(Object.entries(editorIds).map(([key, id]) => [key, $(id).value])); }
function refreshDirty() { dirty = !!savedContents && Object.entries(contents()).some(([key, value]) => value !== savedContents[key]); updateButtons(); }
function tab(name) {
  ['report', 'config', 'sources', 'settings', 'history'].forEach(id => $(id).hidden = id !== name);
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === name);
    if (button.dataset.tab === name) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('save-bar').hidden = !['config', 'sources', 'settings'].includes(name);
  const labels = {report: 'Tin mới', config: 'Theo dõi', sources: 'Nguồn tin', settings: 'Cài đặt', history: 'Lịch sử'};
  if ($('workspace-title')) $('workspace-title').textContent = labels[name] || 'TrendRadar';
}
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => tab(button.dataset.tab));
document.querySelectorAll('[data-go]').forEach(button => button.onclick = () => tab(button.dataset.go));
function timestamp(report) {
  const date = new Date(report.generated_at);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định thời gian' : 'Cập nhật lúc ' + new Intl.DateTimeFormat('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'}).format(date) + ' (giờ Việt Nam)';
}
function showReport(report) {
  selectedReportId = report?.id || null;
  selectedReportRevision = report?.revision || null;
  $('empty').hidden = !!report; $('report-frame').hidden = !report; $('open-report').hidden = !report;
  if (report) { const url = report.url + '?t=' + Date.now(); $('report-frame').src = url; $('open-report').href = url; $('report-time').textContent = timestamp(report); }
  else { $('report-frame').removeAttribute('src'); $('open-report').removeAttribute('href'); $('report-time').textContent = 'Chưa có báo cáo lịch sử'; }
  if (newsWorkspace) { if (report) newsWorkspace.show(report); else newsWorkspace.clear(); }
}
async function loadReports(selectNewest = false) {
  const [active, trash] = await Promise.all([api('reports'), api('report-trash')]);
  reports = active; trashedReports = trash;
  if (pendingHistory) {
    const done = pendingHistory.action === 'trash'
      ? trashedReports.some(item => item.id === pendingHistory.data.request_id)
      : !trashedReports.some(item => item.id === pendingHistory.data.id) && reports.some(item => item.path === pendingHistory.report.path && item.revision === pendingHistory.data.revision);
    if (done) { pendingHistory = null; $('history-status').textContent = 'Đã xác nhận kết quả thao tác. Lịch sử và thùng báo cáo đã được cập nhật.'; }
  }
  renderHistory();
  const selected = reports.find(report => report.id === selectedReportId);
  if (selectNewest || !selected || selected.revision !== selectedReportRevision || !$('report-frame').getAttribute('src')) showReport(selectNewest ? reports[0] : selected || reports[0]);
  reportsLoaded = true;
  updateButtons();
}
function renderHistory() {
  for (const [id, items, removed] of [['history-list', reports, false], ['trash-list', trashedReports, true]]) {
    const list = $(id); list.replaceChildren();
    if (!items.length) list.textContent = removed ? 'Thùng báo cáo đang trống.' : 'Chưa có báo cáo lịch sử được lưu.';
    items.forEach(report => {
      const row = document.createElement('div'); row.className = 'history-row';
      const info = document.createElement('div');
      const name = document.createElement('b'); name.textContent = report.name; info.append(name);
      const time = document.createElement('p'); time.textContent = timestamp(report); info.append(time);
      const path = document.createElement('small'); path.textContent = 'Tệp: ' + report.path; info.append(path);
      if (removed) { const label = document.createElement('small'); label.textContent = 'Đã bỏ vào thùng: ' + timestamp({generated_at: report.removed_at}).replace('Cập nhật lúc ', ''); info.append(label); }
      const actions = document.createElement('div'); actions.className = 'actions';
      if (!removed) {
        const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Mở báo cáo';
        open.setAttribute('aria-label', 'Mở báo cáo ' + report.name);
        open.onclick = () => { showReport(report); tab('report'); }; actions.append(open);
      }
      const button = document.createElement('button'); button.type = 'button'; button.dataset.historyAction = removed ? 'restore' : 'trash';
      button.textContent = removed ? 'Khôi phục' : 'Bỏ vào thùng'; button.dataset.removable = String(removed || report.can_remove !== false);
      button.setAttribute('aria-label', button.textContent + ' báo cáo ' + report.name);
      button.onclick = () => confirmHistoryAction(removed ? 'restore' : 'trash', report); actions.append(button);
      if (!removed && report.can_remove === false) { const note = document.createElement('small'); note.textContent = 'Bản hiện tại được giữ; chọn bản theo thời điểm để bỏ.'; info.append(note); }
      row.append(info, actions); list.append(row);
    });
  }
}
async function confirmHistoryAction(action, report) {
  if (busy || historyWorking || pendingHistory || !connected) return;
  const description = action === 'trash'
    ? 'Bỏ đúng 1 tệp HTML vào thùng báo cáo. Bạn có thể khôi phục sau.'
    : 'Đưa đúng 1 tệp HTML về đường dẫn ban đầu. Nếu đã có tệp mới, thao tác sẽ dừng và giữ cả hai bản.';
  if (!confirm(`${description}\n\nBáo cáo: ${report.name}\n${timestamp(report)}\nTệp: ${report.path}\n\n${action === 'trash' ? 'Dữ liệu tin, RSS, cấu hình, bản hiện tại và bản sao lưu vẫn được giữ.\n\n' : ''}Xác nhận thực hiện?`)) return;
  const data = {id: report.id, revision: report.revision, confirmed: true};
  if (action === 'trash') data.request_id = crypto.randomUUID().replaceAll('-', '');
  pendingHistory = {action, report, data};
  await performHistoryAction();
}
async function performHistoryAction() {
  if (!pendingHistory || busy || historyWorking || !connected) return;
  historyWorking = true; updateButtons();
  const operation = pendingHistory;
  let completedMessage = null;
  try {
    const result = await api('reports/' + operation.action, operation.data);
    completedMessage = result.message;
    pendingHistory = null; $('history-status').textContent = result.message;
    await loadReports();
    if (!$('history').hidden) $('refresh-history').focus();
  } catch (error) {
    if (error.status) pendingHistory = null;
    $('history-status').textContent = completedMessage ? completedMessage + ' Chưa tải lại được danh sách; bấm “Tải lại lịch sử”.' : error.status ? error.message : 'Chưa nhận được kết quả. Tải lại lịch sử để kiểm tra hoặc thử lại đúng thao tác đã xác nhận; không bỏ thêm báo cáo nào.';
    try { await loadReports(); } catch { reportsLoaded = false; }
  } finally { historyWorking = false; updateButtons(); }
}
$('retry-history').onclick = performHistoryAction;
$('refresh-history').onclick = async () => {
  if (historyWorking) return;
  historyWorking = true; updateButtons();
  try { await loadReports(); if (!pendingHistory) $('history-status').textContent = 'Đã cập nhật lịch sử và thùng báo cáo.'; }
  catch (error) { $('history-status').textContent = error.message; }
  finally { historyWorking = false; updateButtons(); }
};
function updateButtons() {
  const locked = busy || saving || previewing || !!pendingVisual || !editorReady || !connected;
  $('run').disabled = locked || dirty || !settingsValid || !!pendingSave || historyWorking || !!pendingHistory; $('run').textContent = busy ? 'Đang lấy tin…' : 'Lấy tin mới';
  $('save').disabled = locked || !dirty || !settingsValid; $('save').textContent = saving ? 'Đang lưu…' : 'Lưu thay đổi';
  ['version-select', 'version-name', 'load-version', 'save-version'].forEach(id => { $(id).disabled = locked; });
  $('save-version').disabled ||= !settingsValid;
  $('load-version').disabled ||= !$('version-select').value;
  $('reload').disabled = busy || saving || previewing || !!pendingVisual || !connected;
  $('tracking-fields').disabled = locked || !settingsValid; $('sources-fields').disabled = locked || !settingsValid; $('settings-fields').disabled = locked;
  $('schedule-fields').disabled = locked || !settingsValid;
  $('save-state').textContent = !editorReady ? 'Chưa tải được lựa chọn' : !settingsValid ? 'Thiết lập cần được sửa' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu các lựa chọn';
  $('hint').textContent = !connected ? 'Đang chờ kết nối với ứng dụng trên máy.' : !editorReady ? 'Chưa tải được lựa chọn. Hãy thử “Tải lại lựa chọn đã lưu” trong Cài đặt.' : !settingsValid ? 'Thiết lập chưa hợp lệ. Kiểm tra thông báo trong Cài đặt hoặc tải lại lựa chọn đã lưu.' : dirty ? 'Bấm “Lưu thay đổi” trong Theo dõi, Nguồn tin hoặc Cài đặt trước khi lấy tin.' : busy ? 'Bạn vẫn có thể đọc kết quả cũ trong lúc chờ.' : 'Bấm “Lấy tin mới” để cập nhật từ các nguồn đã lưu.';
  if (pendingSave && connected && editorReady && settingsValid) {
    $('save-state').textContent = 'Đang xác nhận kết quả lần lưu trước';
    $('hint').textContent = 'Ứng dụng đang đối chiếu lần lưu trước. Nội dung đang chỉnh vẫn được giữ; bạn có thể thử lưu lại.';
  }
  document.body.classList.toggle('busy', busy);
  $('preview-error').hidden = !pendingVisual;
  $('retry-preview').disabled = !connected || busy || saving || previewing;
  $('cancel-preview').disabled = previewing;
  document.querySelectorAll('[data-history-action]').forEach(button => { button.disabled = busy || historyWorking || !!pendingHistory || !connected || button.dataset.removable === 'false'; });
  $('refresh-history').disabled = historyWorking || !connected;
  $('retry-history').hidden = !pendingHistory; $('retry-history').disabled = historyWorking || busy || !connected;
}
async function editVisual(file, path, value, operation) {
  if (busy || saving || previewing || !connected || !settingsValid) return;
  previewing = true; updateButtons();
  try {
    const editor = $(editorIds[file]); const before = editor.value;
    const result = await api('preview-setting', {text: before, path, value, operation});
    if (editor.value !== before) throw new Error('Nội dung đã đổi trong lúc chỉnh. Hãy thử lại.');
    ConfigTools.readSettings(file === 'config' ? result.text : $('yaml-editor').value, file === 'timeline' ? result.text : $('timeline-editor').value);
    pendingVisual = null; editor.value = result.text; refreshDirty(); message(operation === 'delete' ? 'Đã bỏ mục khỏi bản nháp. Bấm “Lưu thay đổi” để áp dụng; bản cũ sẽ được sao lưu.' : 'Đã thay đổi lựa chọn. Bấm “Lưu thay đổi” để áp dụng.');
    return true;
  } catch (error) { pendingVisual = {file, path, value, operation}; message(error.message); return false; }
  finally { previewing = false; if (!pendingVisual) renderSettings(); updateButtons(); }
}
$('retry-preview').onclick = () => { if (pendingVisual) { const {file, path, value, operation} = pendingVisual; editVisual(file, path, value, operation); } };
$('cancel-preview').onclick = () => { pendingVisual = null; renderSettings(); updateButtons(); };
function editScalar(path, value) { return editVisual('config', path, value); }

function renderSettings() {
  const focusId = document.activeElement?.id;
  try {
    const {config, choices} = ConfigTools.readSettings($('yaml-editor').value, $('timeline-editor').value);
    settingsValid = true; settingsError = '';
    $('rss-enabled').checked = config.rss?.enabled === true;
    $('platforms-enabled').checked = config.platforms?.enabled === true;
    $('schedule-enabled').checked = config.schedule?.enabled === true;
    const list = $('source-list'); list.replaceChildren();
    const pausedList = $('paused-source-list'); pausedList.replaceChildren();
    const pausedDetails = $('paused-sources');
    const pausedSummary = $('paused-source-summary');
    let pausedCount = 0;
    (config.rss?.feeds || []).forEach((feed, index) => {
      const feedName = feed.name || feed.id || 'Nguồn chưa đặt tên';
      if (feed.enabled === false) {
        pausedCount++;
        const row = document.createElement('div'); row.className = 'paused-source-row';
        const name = document.createElement('span'); name.textContent = feedName;
        const button = document.createElement('button'); button.type = 'button'; button.id = 'paused-source-' + index; button.textContent = 'Theo dõi lại';
        button.setAttribute('aria-label', 'Theo dõi lại ' + feedName);
        button.onclick = () => editScalar(['rss', 'feeds', index, 'enabled'], true);
        row.append(name, button); pausedList.append(row);
        return;
      }
      const label = document.createElement('label'); label.className = 'toggle';
      const name = document.createElement('span'); name.textContent = feedName;
      const state = document.createElement('small'); state.textContent = config.rss?.enabled ? 'Nguồn báo / trang tin' : 'Chưa lấy tin vì nhóm nguồn đang tắt'; name.append(state);
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.disabled = !config.rss?.enabled;
      input.id = 'source-' + index;
      input.setAttribute('aria-label', 'Theo dõi ' + feedName);
      input.onchange = () => editScalar(['rss', 'feeds', index, 'enabled'], input.checked);
      label.append(name, input); list.append(label);
    });
    pausedSummary.textContent = `Nguồn đã tạm dừng (${pausedCount})`;
    pausedDetails.hidden = pausedCount === 0;
    if (pausedCount === 0) pausedDetails.open = false;
    if (!list.children.length) list.textContent = pausedCount ? 'Chưa có nguồn đang theo dõi. Bạn có thể chọn lại trong mục “Nguồn đã tạm dừng” bên dưới.' : 'Chưa có nguồn báo nào. Chọn nguồn trong thư viện bên dưới.';
    const topics = $('topic-list');
    if (!window.FrequencyUI) {
      topics.replaceChildren();
      ConfigTools.topicNames($('frequency-editor').value).forEach(name => { const item = document.createElement('span'); item.className = 'topic'; item.textContent = name; topics.append(item); });
      if (!topics.children.length) topics.textContent = 'Chưa có chủ đề nào. Thêm chủ đề đầu tiên bên dưới.';
    }
    const select = $('schedule-preset'); select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Chọn chế độ xử lý'; placeholder.disabled = true; select.append(placeholder);
    Object.entries(choices).forEach(([key, preset]) => { const option = document.createElement('option'); option.value = key; option.textContent = preset.name || key; select.append(option); });
    const preset = config.schedule?.preset;
    if (preset && !Object.hasOwn(choices, preset)) { const option = document.createElement('option'); option.value = preset; option.textContent = 'Chế độ đang dùng: ' + preset + ' (không tìm thấy trong lịch)'; select.append(option); }
    select.value = preset || '';
    select.disabled = !config.schedule?.enabled || !Object.keys(choices).length;
    $('schedule-description').textContent = choices[preset]?.description || 'Chọn chế độ để xem cách xử lý tin.';
    if (focusId?.startsWith('source-')) {
      const activeControl = $(focusId);
      if (activeControl) activeControl.focus();
      else if (!pausedDetails.hidden) pausedSummary.focus();
    } else if (focusId?.startsWith('paused-source-')) {
      const activeControl = $('source-' + focusId.slice('paused-source-'.length));
      if (activeControl) activeControl.focus();
      else if (!pausedDetails.hidden) pausedSummary.focus();
    }
    const locked = busy || saving || previewing || !!pendingVisual || !connected;
    if (window.SourceCatalog) SourceCatalog.render($('source-catalog'), $('yaml-editor').value, editVisual, locked);
    if (window.VisualSettings) {
      VisualSettings.render($('visual-sources'), $('yaml-editor').value, 'config', editVisual, locked, ['rss', 'platforms']);
      VisualSettings.render($('visual-config'), $('yaml-editor').value, 'config', editVisual, locked, Object.keys(config).filter(key => !['rss', 'platforms'].includes(key)));
      VisualSettings.render($('visual-timeline'), $('timeline-editor').value, 'timeline', editVisual, locked);
    }
    if (window.FrequencyUI) {
      $('add-topic').parentElement.hidden = true;
      FrequencyUI.render($('topic-list'), $('frequency-editor').value, text => {
      if (busy || saving || previewing || pendingVisual || !connected) return false;
      $('frequency-editor').value = text; refreshDirty(); renderSettings(); message('Đã sửa quy tắc theo dõi. Bấm “Lưu thay đổi” để áp dụng.');
      return true;
      }, locked);
    }
  } catch (error) {
    settingsValid = false; settingsError = error.message;
    $('source-list').textContent = 'Chưa đọc được danh sách nguồn. Kiểm tra thông báo trong Cài đặt hoặc tải lại lựa chọn đã lưu.';
    $('paused-source-list').replaceChildren(); $('paused-sources').hidden = true; $('paused-sources').open = false; $('paused-source-summary').textContent = 'Nguồn đang tắt (0)';
    $('topic-list').textContent = 'Tạm dừng chỉnh chủ đề cho đến khi thiết lập hợp lệ.';
    $('schedule-preset').replaceChildren(); $('schedule-description').textContent = 'Chưa đọc được lịch xử lý.';
    ['rss-enabled', 'platforms-enabled', 'schedule-enabled'].forEach(id => { $(id).checked = false; });
    message(settingsError);
    $('visual-config').textContent = 'Không đọc được cấu hình. Nội dung tệp gốc vẫn được giữ nguyên; hãy tải lại sau khi kiểm tra tệp.';
    $('visual-timeline').textContent = 'Không đọc được lịch xử lý.';
    $('source-catalog').textContent = 'Kiểm tra thiết lập hiện tại trước khi thêm nguồn từ thư viện.';
  }
  updateButtons();
}
async function loadConfig() {
  const data = await api('config');
  if (Object.keys(editorIds).some(key => typeof data[key] !== 'string') || typeof data.revision !== 'string') throw new Error('Ứng dụng trả về thiết lập chưa đầy đủ. Hãy tải lại.');
  for (const [key, id] of Object.entries(editorIds)) $(id).value = data[key];
  versionDraftName = ''; $('version-name').value = ''; $('version-select').value = ''; $('version-info').textContent = 'Cấu hình đang áp dụng. Mỗi phiên bản giữ nguồn tin, chủ đề và lịch xử lý.';
  revision = data.revision; savedContents = contents(); pendingSave = null; pendingSaveAttempts = []; dirty = false; editorReady = true;
  renderSettings(); updateButtons();
}
async function loadVersions() {
  const items = await api('versions');
  const select = $('version-select'), previous = select.value;
  select.replaceChildren();
  const current = document.createElement('option'); current.value = ''; current.textContent = 'Cấu hình đang áp dụng'; select.append(current);
  items.forEach(item => {
    const option = document.createElement('option'); option.value = item.id;
    const date = new Intl.DateTimeFormat('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'}).format(new Date(item.created_at));
    option.textContent = item.name + ' · ' + date + (item.revision === revision ? ' · đang áp dụng' : '');
    select.append(option);
  });
  if (items.some(item => item.id === previous)) select.value = previous;
  versionsLoaded = true; updateButtons();
}
$('version-select').onchange = updateButtons;
$('load-version').onclick = async () => {
  if ($('load-version').disabled) return;
  const unfinished = [...document.querySelectorAll('[data-draft-id]')].some(node => node.tagName === 'INPUT' && (node.type === 'checkbox' ? node.checked : node.value.trim()));
  if ((dirty || unfinished) && !confirm('Mở phiên bản sẽ thay bản nháp và nội dung đang nhập. Bạn nên lưu thành phiên bản mới trước nếu muốn giữ. Tiếp tục?')) return;
  saving = true; updateButtons();
  try {
    const data = await api('version', {id: $('version-select').value});
    ConfigTools.readSettings(data.config, data.timeline);
    for (const [key, id] of Object.entries(editorIds)) $(id).value = data[key];
    ['topic-list', 'visual-sources', 'visual-config', 'visual-timeline'].forEach(id => $(id).replaceChildren());
    versionDraftName = data.version.name; $('version-name').value = versionDraftName;
    refreshDirty(); renderSettings();
    $('version-info').textContent = 'Bản nháp: ' + versionDraftName + '. Bấm “Lưu thay đổi” để áp dụng.';
    message('Đã mở phiên bản để chỉnh. Cấu hình đang chạy vẫn giữ nguyên cho đến khi bạn lưu.');
  } catch (error) { message(error.message); }
  finally { saving = false; renderSettings(); updateButtons(); }
};
$('save-version').onclick = async () => {
  if ($('save-version').disabled) return;
  const name = $('version-name').value.trim();
  if (!name) { message('Nhập tên cho phiên bản mới.'); $('version-name').focus(); return; }
  saving = true; updateButtons();
  try {
    const item = await api('versions', {...contents(), name});
    await loadVersions(); $('version-select').value = item.id;
    message('Đã lưu phiên bản “' + item.name + '”. Bấm “Lưu thay đổi” nếu muốn áp dụng bản nháp này.');
  } catch (error) { message(error.message); }
  finally { saving = false; updateButtons(); }
};
$('rss-enabled').onchange = event => editScalar(['rss', 'enabled'], event.target.checked);
$('platforms-enabled').onchange = event => editScalar(['platforms', 'enabled'], event.target.checked);
$('schedule-enabled').onchange = event => editScalar(['schedule', 'enabled'], event.target.checked);
$('schedule-preset').onchange = event => editScalar(['schedule', 'preset'], event.target.value);
$('add-topic').onclick = () => {
  try {
    $('frequency-editor').value = ConfigTools.addTopic($('frequency-editor').value, $('topic-name').value, $('topic-words').value);
    $('topic-name').value = ''; $('topic-words').value = ''; refreshDirty(); renderSettings(); message('Đã thêm chủ đề. Bấm “Lưu thay đổi” để áp dụng.');
  } catch (error) { message(error.message); }
};
Object.values(editorIds).forEach(id => $(id).addEventListener('input', () => { refreshDirty(); renderSettings(); if (settingsValid) message('Đã thay đổi nội dung. Bấm “Lưu thay đổi” để áp dụng.'); }));
$('reload').onclick = async () => {
  if (dirty && !confirm('Tải lại sẽ thay nội dung chưa lưu trên màn hình bằng lựa chọn đã lưu. Tiếp tục?')) return;
  saving = true; updateButtons();
  try { await loadConfig(); message(settingsValid ? 'Đã tải lại các lựa chọn đã lưu.' : settingsError); } catch (error) { message(error.message); }
  finally { saving = false; renderSettings(); updateButtons(); }
};
$('save').onclick = async () => {
  if (pendingVisual || previewing) return;
  renderSettings(); refreshDirty();
  if (busy || saving || previewing || pendingVisual || !connected || !editorReady || !dirty || !settingsValid) return;
  saving = true; updateButtons();
  const snapshot = contents();
  try {
    const result = await api('config', {...snapshot, revision, version_name: $('version-name').value.trim() || versionDraftName || 'Cấu hình đã lưu'});
    pendingSave = null; pendingSaveAttempts = []; savedContents = snapshot; revision = result.revision; refreshDirty(); message(result.message);
    try { await loadVersions(); } catch { versionsLoaded = false; message(result.message + " Chưa tải được danh sách phiên bản."); }
  } catch (error) {
    if (!error.status) {
      if (pendingSave) pendingSaveAttempts.push(pendingSave);
      pendingSave = snapshot;
    }
    message(error.message);
    try { await reconcileSave(); } catch { /* Đối chiếu lại khi kết nối phục hồi. */ }
  }
  finally { saving = false; updateButtons(); }
};
async function reconcileSave() {
  if (!pendingSave) return;
  const snapshot = pendingSave;
  const data = await api('config');
  if (pendingSave !== snapshot) return;
  if (Object.keys(editorIds).some(key => typeof data[key] !== 'string') || typeof data.revision !== 'string') throw new Error('Chưa đối chiếu được kết quả lưu.');
  const matched = [snapshot, ...pendingSaveAttempts].find(attempt => Object.entries(attempt).every(([key, value]) => data[key] === value));
  if (matched) {
    pendingSave = null; pendingSaveAttempts = [];
    // Cập nhật bản đã lưu, giữ nguyên mọi chỉnh sửa mới trên màn hình.
    savedContents = matched; revision = data.revision; refreshDirty();
    message(dirty ? 'Đã xác nhận lần lưu trước. Bạn vẫn còn thay đổi mới chưa lưu.' : 'Đã xác nhận các lựa chọn được lưu.');
  }
}
$('run').onclick = async () => {
  if (historyWorking || pendingHistory) return;
  if (pendingVisual) return;
  renderSettings(); refreshDirty(); if (dirty || busy || saving || previewing || !connected || !editorReady || !settingsValid || pendingSave) return;
  try {
    busy = true; updateButtons();
    await api('run', {revision, allow_ai: $('allow-ai').checked, allow_notification: $('allow-notification').checked});
    message('Đã bắt đầu lấy tin. Bạn có thể đọc kết quả cũ trong lúc chờ.'); await poll();
  } catch (error) { busy = false; updateButtons(); message(error.message); }
};
let polling = false;
async function poll() {
  if (polling) return; polling = true;
  try {
    const status = await api('status'); connected = true; busy = status.running; updateButtons(); $('phase').textContent = status.phase;
    if (pendingSave && !saving && !busy) { try { await reconcileSave(); } catch { /* Giữ nội dung chưa lưu và thử lại ở lượt sau. */ } }
    if (!editorReady && !saving) { try { await loadConfig(); } catch (error) { message(error.message); } }
    if (editorReady && !versionsLoaded && !saving) { try { await loadVersions(); } catch { /* Thử lại sau khi kết nối phục hồi. */ } }
    if (!reportsLoaded) { try { await loadReports(); } catch (error) { message(error.message); } }
    if (status.finished && status.finished !== finished) {
      try {
        await loadReports(true); finished = status.finished;
        message((status.warnings || []).join(' ') || (status.success ? 'Tin tức đã được cập nhật.' : status.phase));
        if (status.success && !dirty && !saving) tab('report');
      } catch (error) { message('Đã kết nối ứng dụng nhưng chưa đọc được kết quả: ' + error.message); }
    }
  } catch { connected = false; $('phase').textContent = 'Mất kết nối ứng dụng'; updateButtons(); message('Kiểm tra cửa sổ chạy TrendRadar. Ứng dụng sẽ tự kết nối lại.'); }
  finally { polling = false; }
}
async function loadCatalog() {
  if (catalogLoading || catalogLoaded || !window.SourceCatalog) return;
  catalogLoading = true; $('retry-catalog').disabled = true;
  try { await SourceCatalog.load(); catalogLoaded = true; $('retry-catalog').hidden = true; }
  catch { $('retry-catalog').hidden = false; }
  finally { catalogLoading = false; $('retry-catalog').disabled = false; if (editorReady) renderSettings(); }
}
$('retry-catalog').onclick = loadCatalog;
async function initialize() {
  await poll();
}
initialize(); loadCatalog(); setInterval(poll, 1500);
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); if (!$('save').disabled) $('save').click(); } });
window.addEventListener('beforeunload', event => { if (dirty || pendingVisual) { event.preventDefault(); event.returnValue = ''; } });
