/* Thư viện tuyển chọn: thêm vào bản nháp, dùng nút lưu chung của ứng dụng. */
window.SourceCatalog = (() => {
  let catalog = null, loading = null;
  const states = new WeakMap();
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const address = value => {
    try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) return ''; url.hash = ''; return url.href; }
    catch { return ''; }
  };
  async function load() {
    if (catalog) return catalog;
    if (!loading) loading = (async () => {
      const response = await fetch('/local_ui/source-catalog.json', {credentials: 'same-origin'});
      if (!response.ok) throw new Error('Chưa tải được thư viện nguồn tin. Hãy tải lại trang.');
      const data = await response.json();
      if (!Array.isArray(data.publishers) || !Array.isArray(data.countries) || !Array.isArray(data.categories)) throw new Error('Thư viện nguồn tin chưa hợp lệ.');
      catalog = data; return data;
    })().catch(error => { loading = null; throw error; });
    return loading;
  }
  function render(container, configText, onChange, locked) {
    const state = states.get(container) || {country: '', category: '', query: '', message: '', pending: false, added: new Map()};
    states.set(container, state); container.replaceChildren();
    state.renderLatest = () => render(container, configText, onChange, locked);
    if (!catalog) { container.append(el('p', 'help', 'Chưa tải được thư viện nguồn tin. Các nguồn đang theo dõi vẫn được giữ nguyên.')); return; }
    let config, current;
    try {
      config = jsyaml.load(configText);
      if (!config || typeof config !== 'object' || Array.isArray(config) || !config.rss || typeof config.rss !== 'object' || !Array.isArray(config.rss.feeds)) throw Error();
      current = config.rss.feeds;
      if (current.some(feed => !feed || typeof feed !== 'object' || Array.isArray(feed))) throw Error();
    } catch { container.append(el('p', 'help', 'Chưa đọc được danh sách nguồn hiện tại. Kiểm tra thiết lập trước khi thêm nguồn.')); return; }
    for (const [url, optimistic] of state.added) {
      if (current.some(item => address(item.url) === url) || configText !== optimistic.configText) state.added.delete(url);
    }
    state.latestConfigText = configText;
    container.append(el('p', 'help', 'Chọn quốc gia và lĩnh vực, rồi thêm từng nguồn bạn muốn. Quốc gia của báo không xác định sự kiện thuộc Việt Nam hay Quốc tế. Thư viện không tự bật tất cả nguồn.'));
    if (config.rss.enabled !== true) container.append(el('p', 'help', 'Nhóm nguồn báo đang tắt. Sau khi thêm, bật “Lấy tin từ các nguồn báo và trang tin” trong Nguồn tin và bấm “Lưu thay đổi”.'));
    const filters = el('div', 'setting-grid');
    function selector(labelText, choices, value, key) {
      const label = el('label', 'field', labelText), select = el('select');
      const all = el('option', '', 'Tất cả'); all.value = ''; select.append(all);
      choices.forEach(choice => { const option = el('option', '', choice.name); option.value = choice.id; select.append(option); });
      select.value = value; select.dataset.catalogFilter = key;
      select.onchange = () => { state[key] = select.value; draw(); };
      label.append(select); filters.append(label);
    }
    selector('Quốc gia của nguồn', catalog.countries, state.country, 'country');
    selector('Lĩnh vực tin', catalog.categories, state.category, 'category');
    const searchLabel = el('label', 'field', 'Tìm tên báo'), search = el('input');
    search.type = 'search'; search.value = state.query; search.placeholder = 'Ví dụ: VnExpress, BBC, ESPN';
    search.dataset.catalogFilter = 'query'; search.oninput = () => { state.query = search.value; draw(); };
    searchLabel.append(search); filters.append(searchLabel); container.append(filters);
    const status = el('p', 'help', state.message); status.setAttribute('role', 'status'); state.statusNode = status;
    const count = el('p', 'help'), list = el('div', 'source-catalog-list'); container.append(count, status, list);
    function draw() {
      list.replaceChildren();
      const query = state.query.trim().toLocaleLowerCase('vi');
      const publishers = catalog.publishers.filter(publisher => (!state.country || publisher.country === state.country) && (!state.category || publisher.categories.includes(state.category)) && (!query || publisher.name.toLocaleLowerCase('vi').includes(query)));
      count.textContent = `${publishers.length} tòa soạn phù hợp. Chỉ nguồn đã kiểm tra RSS mới có nút thêm.`;
      if (!publishers.length) list.append(el('p', 'help', 'Chưa tìm thấy nguồn phù hợp. Thử đổi lĩnh vực, quốc gia hoặc tên báo.'));
      for (const publisher of publishers) {
        const card = el('article', 'setting-item'); card.dataset.publisher = publisher.id;
        card.append(el('h3', '', publisher.name), el('p', 'help', publisher.country_name));
        const home = el('a', '', 'Mở trang báo gốc ↗'); home.href = address(publisher.homepage); home.target = '_blank'; home.rel = 'noopener noreferrer'; card.append(home);
        if (publisher.status !== 'verified' || !publisher.feeds.length) {
          card.append(el('p', 'help', 'Chưa có RSS đã xác minh: ' + publisher.check_note));
          const button = el('button', '', 'Chưa thể thêm tự động'); button.type = 'button'; button.disabled = true; card.append(button);
        } else {
          const feeds = publisher.feeds.filter(feed => !state.category || feed.category === state.category);
          for (const feed of feeds) {
            const row = el('div', 'source-catalog-feed'); row.dataset.feed = feed.id;
            row.append(el('b', '', feed.category_name), el('p', 'help', feed.feed_title || publisher.name));
            const feedAddress = address(feed.url);
            let existingIndex = -1, existing = null, hasActive = false;
            for (let i = 0; i < current.length; i++) {
              const item = current[i];
              if (address(item.url) === feedAddress) {
                if (item.enabled !== false) {
                  hasActive = true;
                  existingIndex = i;
                  existing = item;
                  break;
                } else if (existingIndex === -1) {
                  existingIndex = i;
                  existing = item;
                }
              }
            }
            if (!existing && state.added.has(feedAddress)) {
              existing = state.added.get(feedAddress).source;
              if (existing.enabled !== false) hasActive = true;
            }
            const active = hasActive;
            const canReactivate = !active && existingIndex !== -1;
            const buttonText = active ? 'Đã thêm · đang bật' : canReactivate ? 'Theo dõi lại' : existing ? 'Đã thêm · đang tắt' : 'Thêm nguồn này';
            const button = el('button', '', buttonText);
            button.type = 'button'; button.dataset.catalogAdd = feed.id;
            button.disabled = !!locked || state.pending || active || feed.status !== 'verified' || !feedAddress;
            if (active) {
              row.append(el('p', 'help', 'Nguồn đã có trong danh sách theo dõi.'));
            } else if (canReactivate) {
              row.append(el('p', 'help', 'Nguồn đã có nhưng đang tắt. Bấm “Theo dõi lại” để bật lại nguồn này.'));
            } else if (existing) {
              row.append(el('p', 'help', 'Nguồn đã có nhưng đang tắt. Bật lại nguồn này trong danh sách nguồn đang theo dõi.'));
            }
            button.onclick = async () => {
              if (locked || state.pending || active || feed.status !== 'verified' || !feedAddress || typeof onChange !== 'function') return;
              state.pending = true; state.draw();
              try {
                if (canReactivate) {
                  const changed = await onChange('config', ['rss', 'feeds', existingIndex, 'enabled'], true);
                  if (changed) {
                    state.message = 'Đã bật lại nguồn vào lựa chọn chưa lưu. Bấm “Lưu thay đổi” để áp dụng.' + (config.rss.enabled !== true ? ' Bật “Lấy tin từ các nguồn báo và trang tin” trong Nguồn tin để dùng nguồn này.' : '');
                  } else {
                    state.message = 'Chưa bật lại nguồn. Các lựa chọn được giữ nguyên; kiểm tra thông báo của ứng dụng.';
                  }
                } else {
                  if (existing) return;
                  const used = new Set([...current.map(item => item.id), ...[...state.added.values()].map(item => item.source.id)]); let id = feed.id, suffix = 2;
                  while (used.has(id)) id = feed.id + '-' + suffix++;
                  const source = {id, name: publisher.name + ' — ' + feed.category_name, url: feed.url, enabled: true, publisher_id: publisher.id, country: publisher.country, country_name: publisher.country_name, category: feed.category};
                  const changed = await onChange('config', ['rss', 'feeds'], source, 'append');
                  if (changed) {
                    state.message = 'Đã thêm vào lựa chọn chưa lưu. Bấm “Lưu thay đổi” để áp dụng.' + (config.rss.enabled !== true ? ' Bật “Lấy tin từ các nguồn báo và trang tin” trong Nguồn tin để dùng nguồn này.' : '');
                    const latestHasFeed = jsyaml.load(state.latestConfigText).rss.feeds.some(item => address(item.url) === feedAddress);
                    if (!latestHasFeed) state.added.set(feedAddress, {source, configText: state.latestConfigText});
                    else state.added.delete(feedAddress);
                  } else {
                    state.message = 'Chưa thêm nguồn. Các lựa chọn được giữ nguyên; kiểm tra thông báo của ứng dụng.';
                  }
                }
              } catch {
                state.message = canReactivate ? 'Không bật lại được nguồn. Các lựa chọn được giữ nguyên; hãy thử lại.' : 'Không thêm được nguồn. Các lựa chọn được giữ nguyên; hãy thử lại.';
              } finally {
                state.pending = false; state.renderLatest();
              }
            };
            row.append(button);
            const date = feed.checked_at?.slice(0, 10) || 'chưa rõ';
            row.append(el('small', 'help', `RSS được kiểm tra ngày ${date}; tình trạng có thể thay đổi.`));
            card.append(row);
          }
        }
        list.append(card);
      }
    }
    state.draw = draw; draw();
  }
  return {load, render};
})();
