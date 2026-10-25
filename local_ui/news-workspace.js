/* Browse report headlines with an inert parser; article pages stay unopened. */
window.NewsWorkspace = (() => {
  const FALLBACK_NOTE = 'Không đọc được danh sách tin này. Bạn vẫn có thể xem báo cáo gốc.';
  const NO_ITEMS_NOTE = 'Không tìm thấy tiêu đề đọc được. Hãy mở báo cáo gốc để xem nội dung.';
  const ARTICLE_NOTE = 'Thông tin ở đây chỉ gồm tiêu đề và dữ liệu có sẵn trong báo cáo. Hãy đọc bài gốc trước khi sử dụng.';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  function safeHttpUrl(value, base) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim(), base);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (!/^https?:\/\//i.test(value.trim()) && !base) return '';
      return url.href;
    } catch { return ''; }
  }

  function canonicalUrl(value) {
    try {
      const url = new URL(value);
      url.hash = '';
      url.hostname = url.hostname.toLowerCase();
      if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) url.port = '';
      return url.href;
    } catch { return ''; }
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = clean(node && node.textContent);
      if (value) return value;
    }
    return '';
  }

  function dedupeItems(records) {
    const items = [], byKey = new Map();
    for (const record of records) {
      const key = canonicalUrl(record.url) + '\n' + record.title;
      const previous = byKey.get(key);
      if (previous) {
        for (const label of record.groups || []) if (label && !previous.groups.includes(label)) previous.groups.push(label);
        if (!previous.source && record.source) previous.source = record.source;
        if (!previous.published && record.published) previous.published = record.published;
      } else {
        const item = {...record, groups: [...new Set((record.groups || []).filter(Boolean))]};
        byKey.set(key, item); items.push(item);
      }
    }
    return items;
  }

  function extractReport(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const records = [];
    const add = (node, group, selectors) => {
      const anchor = node.querySelector(selectors.title);
      const title = clean(anchor && anchor.textContent);
      const url = safeHttpUrl(anchor && anchor.getAttribute('href'));
      if (!title || !url) return;
      const source = firstText(node, selectors.source);
      const published = firstText(node, selectors.time);
      records.push({title, url, source, published, groups: group ? [group] : []});
    };

    doc.querySelectorAll('.feed-group').forEach(group => {
      const label = firstText(group, ['.feed-name']);
      group.querySelectorAll('.rss-item').forEach(node => add(node, label, {
        title: '.rss-title a', source: ['.rss-author'], time: ['.rss-time'],
      }));
    });
    doc.querySelectorAll('.word-group').forEach(group => {
      const label = firstText(group, ['.word-name']);
      group.querySelectorAll('.news-item').forEach(node => add(node, label, {
        title: '.news-title a', source: ['.news-source', '.source-name'], time: ['.news-time', '.time-info'],
      }));
    });
    return dedupeItems(records);
  }

  function filterItems(items, query, selectedGroups) {
    const needle = norm(query);
    const chosen = new Set(selectedGroups || []);
    return items.filter(item => {
      const textMatch = !needle || norm([item.title, item.source, ...item.groups].join(' ')).includes(needle);
      const groupMatch = !chosen.size || item.groups.some(group => chosen.has(group));
      return textMatch && groupMatch;
    });
  }

  function mount(options) {
    const {workspace, list, detail, search, filters, count, viewToggle, frame} = options;
    let items = [], selected = -1, generation = 0, controller = null, reportUrl = '', mode = 'news';

    if (detail.classList) detail.classList.add('news-detail');
    const fallbackNote = document.createElement('p');
    fallbackNote.className = 'news-workspace-note'; fallbackNote.setAttribute('role', 'status');
    fallbackNote.setAttribute('aria-live', 'polite'); fallbackNote.hidden = true;
    if (workspace.parentNode && typeof workspace.parentNode.insertBefore === 'function') workspace.parentNode.insertBefore(fallbackNote, workspace);
    else if (workspace.parentNode) workspace.parentNode.append(fallbackNote);

    const clearDetail = () => detail.replaceChildren();
    const setCount = value => { count.textContent = value; };
    const setMode = next => {
      mode = next;
      viewToggle.setAttribute('aria-pressed', String(mode === 'news'));
      viewToggle.textContent = mode === 'news' ? 'Xem báo cáo gốc' : 'Quay lại danh sách tin';
      workspace.hidden = mode !== 'news' || !items.length;
      frame.hidden = mode === 'news';
    };
    const visibleItems = () => {
      const chosen = Array.from(filters.querySelectorAll('.news-filter[aria-pressed="true"]')).map(button => button.dataset.group).filter(Boolean);
      const visible = new Set(filterItems(items, search.value, chosen));
      return items.map((item, index) => ({item, index})).filter(({item}) => visible.has(item));
    };
    const renderDetail = item => {
      clearDetail();
      if (!item) return;
      const heading = document.createElement('h2'); heading.className = 'news-detail-title'; heading.textContent = item.title; detail.append(heading);
      const source = document.createElement('p'); source.className = 'news-detail-source'; source.textContent = item.source || 'Chưa có thông tin nguồn'; detail.append(source);
      const published = document.createElement('p'); published.className = 'news-detail-published'; published.textContent = item.published || 'Chưa có thời gian đăng'; detail.append(published);
      const groups = document.createElement('p'); groups.className = 'news-detail-groups'; groups.textContent = item.groups.length ? item.groups.join(', ') : 'Chưa phân nhóm'; detail.append(groups);
      const link = document.createElement('a'); link.className = 'news-original-link'; link.textContent = 'Đọc bài gốc'; link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; detail.append(link);
      const note = document.createElement('p'); note.className = 'news-detail-note'; note.textContent = ARTICLE_NOTE; detail.append(note);
    };
    const render = (preserveFocus = false) => {
      const focusedCard = preserveFocus && document.activeElement && document.activeElement.classList && typeof document.activeElement.classList.contains === 'function' && document.activeElement.classList.contains('news-card')
        ? document.activeElement : null;
      const restoreFocusIndex = focusedCard ? focusedCard.dataset.index : null;
      const visible = visibleItems();
      if (!visible.some(entry => entry.index === selected)) selected = visible.length ? visible[0].index : -1;
      list.replaceChildren();
      for (const {item, index} of visible) {
        const card = document.createElement('button'); card.type = 'button'; card.className = 'news-card' + (selected === index ? ' is-selected' : ''); card.dataset.index = String(index); card.setAttribute('aria-pressed', String(selected === index));
        const heading = document.createElement('span'); heading.className = 'news-card-title'; heading.style.display = 'block'; heading.textContent = item.title; card.append(heading);
        const source = document.createElement('span'); source.className = 'news-card-source'; source.textContent = item.source || 'Chưa có thông tin nguồn'; card.append(source);
        const meta = document.createElement('span'); meta.className = 'news-card-meta';
        for (const label of item.groups) { const badge = document.createElement('span'); badge.className = 'news-card-group'; badge.textContent = label; meta.append(badge); }
        if (item.published) { const published = document.createElement('span'); published.className = 'news-card-published'; published.textContent = item.published; meta.append(published); }
        card.append(meta);
        card.onclick = () => {
          selected = index; render(true);
          if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1099px)').matches && typeof detail.scrollIntoView === 'function') {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            detail.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest'});
          }
        };
        list.append(card);
      }
      if (restoreFocusIndex !== null) {
        const replacement = list.querySelector(`.news-card[data-index="${restoreFocusIndex}"]`);
        if (replacement && typeof replacement.focus === 'function') replacement.focus({preventScroll: true});
      }
      if (!visible.length) {
        const empty = document.createElement('p'); empty.className = 'news-empty';
        empty.textContent = 'Không có tiêu đề phù hợp. Thử từ khóa khác hoặc chọn Tất cả.'; list.append(empty);
      }
      setCount(`${visible.length} / ${items.length} tiêu đề`);
      if (selected >= 0) renderDetail(items[selected]);
      else clearDetail();
    };
    const renderFilters = () => {
      filters.replaceChildren();
      const all = document.createElement('button'); all.type = 'button'; all.className = 'news-filter';
      all.textContent = 'Tất cả'; all.setAttribute('aria-pressed', 'true');
      all.onclick = () => {
        filters.querySelectorAll('.news-filter').forEach(button => button.setAttribute('aria-pressed', String(button === all)));
        render();
      };
      filters.append(all);
      const groups = [...new Set(items.flatMap(item => item.groups).filter(Boolean))];
      for (const label of groups) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'news-filter'; button.textContent = label; button.dataset.group = label; button.setAttribute('aria-pressed', 'false');
        button.onclick = () => {
          button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
          const any = Array.from(filters.querySelectorAll('.news-filter[aria-pressed="true"]')).some(node => node.dataset.group);
          all.setAttribute('aria-pressed', String(!any)); render();
        };
        filters.append(button);
      }
    };
    const reset = () => {
      items = []; selected = -1; reportUrl = ''; mode = 'news';
      list.replaceChildren(); filters.replaceChildren(); clearDetail(); search.value = ''; setCount('');
      viewToggle.hidden = true; viewToggle.setAttribute('aria-pressed', 'true'); viewToggle.textContent = 'Xem báo cáo gốc';
      frame.hidden = true; workspace.hidden = true; fallbackNote.hidden = true; fallbackNote.textContent = '';
    };

    search.addEventListener('input', render);
    viewToggle.addEventListener('click', () => setMode(mode === 'news' ? 'original' : 'news'));

    return {
      async show(report) {
        const currentGeneration = ++generation;
        if (controller) controller.abort();
        controller = new AbortController();
        reset();
        if (!report || !report.url) return;
        reportUrl = safeHttpUrl(report.url, window.location.href);
        if (!reportUrl) {
          fallbackNote.textContent = FALLBACK_NOTE; fallbackNote.hidden = false; viewToggle.hidden = true; return;
        }
        const fallback = message => {
          if (currentGeneration !== generation) return;
          reset(); reportUrl = safeHttpUrl(report.url, window.location.href); fallbackNote.textContent = message || FALLBACK_NOTE; fallbackNote.hidden = false; frame.hidden = false;
        };
        try {
          const response = await fetch(reportUrl, {credentials: 'same-origin', signal: controller.signal});
          if (!response.ok) throw new Error('report fetch failed');
          const html = await response.text();
          if (currentGeneration !== generation) return;
          const parsedItems = extractReport(html, reportUrl);
          if (!parsedItems.length) { fallback(NO_ITEMS_NOTE); return; }
          items = parsedItems; selected = 0; renderFilters(); render();
          if (!items.length) { fallback(NO_ITEMS_NOTE); return; }
          viewToggle.hidden = false; frame.hidden = true; workspace.hidden = false;
        } catch (error) {
          if (error.name === 'AbortError' || currentGeneration !== generation) return;
          fallback(FALLBACK_NOTE);
        }
      },
      clear() {
        generation++;
        if (controller) controller.abort();
        controller = null;
        reset();
      },
    };
  }

  return {mount, extractReport, safeHttpUrl, dedupeItems, filterItems};
})();
