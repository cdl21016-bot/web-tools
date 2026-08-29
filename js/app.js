/**
 * app.js - 主应用逻辑
 * 页面渲染、交互处理、Markdown 渲染配置
 */

const App = (function () {
  const app = document.getElementById('app');
  const navLinks = document.querySelectorAll('.nav-link');
  const themeToggle = document.getElementById('themeToggle');
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  const backToTop = document.getElementById('backToTop');
  const navbar = document.getElementById('navbar');

  // ============================================
   // Markdown 配置
   // ============================================
  function initMarkdown() {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
        highlight: function (code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {
              console.warn('代码高亮失败:', e);
            }
          }
          if (typeof hljs !== 'undefined') {
            try {
              return hljs.highlightAuto(code).value;
            } catch (e) {
              // ignore
            }
          }
          return code;
        },
      });
    }
  }

  // ============================================
   // 工具函数
   // ============================================
  function renderMarkdown(content) {
    if (typeof marked !== 'undefined') {
      let html = marked.parse(content);
      if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html);
      }
      return html;
    }
    // 降级：简单转义
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${d.getFullYear()}年${months[d.getMonth()]}${d.getDate()}日`;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateActiveNav(path) {
    navLinks.forEach((link) => {
      const route = link.getAttribute('data-route');
      if (path === route || (route !== '/' && path.startsWith(route))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function closeMobileMenu() {
    navMenu.classList.remove('open');
    menuToggle.classList.remove('active');
  }

  function removeReadingProgress() {
    const existing = document.getElementById('readingProgress');
    if (existing) existing.remove();
  }

  // ============================================
   // 页面渲染：首页
   // ============================================
  function renderHome(query) {
    const searchKeyword = query.tag || '';
    const stats = Store.getStats();
    let articles = Store.getArticles();

    // 如果有 tag 参数，按标签筛选
    if (query.tag && query.tag !== '全部') {
      articles = Store.getArticlesByTag(query.tag);
    }

    app.innerHTML = `
      <section class="hero">
        <div class="hero-badge">
          <span class="pulse"></span>
          助力小微企业 · 让办公更高效
        </div>
        <h1>实用办公工具 · 效率提升指南</h1>
        <div class="hero-slogan">
          <span class="hero-slogan-tag">免费</span>
          <span class="hero-slogan-tag">便宜</span>
          <span class="hero-slogan-tag">实用</span>
        </div>
        <p>分享办公工具推荐、效率技巧与自动化方案，让每一分钟都更有价值。</p>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="num">${stats.articles}</div>
            <div class="label">篇文章</div>
          </div>
          <div class="hero-stat">
            <div class="num">${stats.tags}</div>
            <div class="label">个标签</div>
          </div>
          <div class="hero-stat">
            <div class="num">${stats.apps}</div>
            <div class="label">个应用</div>
          </div>
        </div>
      </section>

      ${renderHomeTools()}

      <!-- 广告投放预留窗口 -->
      <div class="ad-slot" id="adSlot">
        <div class="ad-slot-inner">
          <div class="ad-slot-label">
            <span class="ad-slot-icon">📢</span>
            <span class="ad-slot-text">广告位</span>
          </div>
          <div class="ad-slot-content">
            <div class="ad-slot-title">此处为广告投放预留位</div>
            <div class="ad-slot-desc">支持横幅广告 · 轮播广告 · 推广链接</div>
          </div>
          <div class="ad-slot-size">推荐尺寸 728×90</div>
        </div>
      </div>

      <div class="search-bar">
        <div class="search-input-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="search-input" id="searchInput" placeholder="搜索文章标题、摘要或标签..." value="">
        </div>
      </div>

      ${searchKeyword ? `<p style="margin-bottom:16px;color:var(--text-muted);font-size:14px;">当前筛选标签：<span class="tag">${searchKeyword}</span> <a href="#/" style="font-size:13px;">清除筛选</a></p>` : ''}

      ${renderHomeApps()}

      <div class="section-header">
        <h2 class="section-title">最新文章</h2>
      </div>
      <div class="article-grid" id="articleGrid">
        ${renderArticleCards(articles)}
      </div>
    `;

    // 绑定搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const results = e.target.value
            ? Store.searchArticles(e.target.value)
            : Store.getArticles();
          const grid = document.getElementById('articleGrid');
          grid.innerHTML = renderArticleCards(results);
        }, 200);
      });
    }

    // 绑定文章卡片点击
    bindArticleCards();

    // 绑定标签点击
    bindTagClicks();

    // 绑定首页小工具窗口
    bindHomeTools();

    // 绑定首页应用下载区（筛选 + 下载）
    bindHomeAppFilter();
    bindHomeAppGrid(document.getElementById('homeAppGrid'));
  }

  // 首页「应用下载」区块：把应用下载列表放到文章前面
  function renderHomeApps() {
    return `
      <div class="section-header apps-list-header" style="margin-top:32px;">
        <h2 class="section-title">📥 应用推荐</h2>
        <a href="#/apps" style="font-size:13px;color:var(--primary);text-decoration:none;">进入应用中心 →</a>
      </div>
      <div class="app-grid" id="homeAppGrid">
        ${renderAppCards(currentFilteredApps(), false)}
      </div>
    `;
  }

  function bindHomeAppFilter() {
    // 筛选标签已移除，保留空函数避免调用处报错
  }

  function bindHomeAppGrid(grid) {
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const detailBtn = e.target.closest('[data-app-detail]');
      if (detailBtn) {
        const app = Store.getApp(detailBtn.getAttribute('data-app-detail'));
        if (app) showAppDetailModal(app);
      }
    });
  }

  // 与 performAppDownload 类似，但下载后只刷新首页应用网格（不跳转整页）
  async function performAppDownloadHome(id, app, btn, grid) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '准备中...';
    }
    try {
      const fileRecord = await Store.getAppFile(id);
      if (fileRecord && fileRecord.blob) {
        const url = URL.createObjectURL(fileRecord.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileRecord.fileName || app.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Store.incrementDownloadCount(id);
        showToast('开始下载 ' + app.name, 'success');
      } else {
        showToast('文件数据不存在', 'error');
      }
    } catch (err) {
      showToast('下载失败', 'error');
      console.error(err);
    }
    if (grid) grid.innerHTML = renderAppCards(currentFilteredApps(), false);
  }

  function renderArticleCards(articles) {
    if (!articles || articles.length === 0) {
      return `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">📭</div>
          <h3>暂无文章</h3>
          <p>试试其他关键词或清除筛选条件</p>
        </div>
      `;
    }
    return articles
      .map(
        (a, i) => `
      <article class="article-card" data-id="${a.id}">
        <div class="article-card-cover cover-${i % 9}"><span>${a.emoji || '📄'}</span></div>
        <div class="article-card-body">
          <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
          <p class="article-card-excerpt">${escapeHtml(a.excerpt)}</p>
          <div class="article-card-footer">
            <div class="article-card-tags">
              ${a.tags.slice(0, 2).map((t) => `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}
            </div>
            <span class="article-card-date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${a.date}
            </span>
          </div>
        </div>
      </article>
    `
      )
      .join('');
  }

  function bindArticleCards() {
    document.querySelectorAll('.article-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag')) return; // 标签点击单独处理
        const id = card.getAttribute('data-id');
        Router.navigate('/article/' + encodeURIComponent(id));
      });
    });
  }

  function bindTagClicks() {
    document.querySelectorAll('.tag[data-tag]').forEach((tag) => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagName = tag.getAttribute('data-tag');
        Router.navigate('/tags?tag=' + encodeURIComponent(tagName));
      });
    });
  }

  // ============================================
   // 页面渲染：文章详情
   // ============================================
  function renderArticle(params) {
    const id = params.id;
    const article = Store.getArticle(id);

    if (!article) {
      renderNotFound();
      return;
    }

    const { prev, next } = Store.getAdjacentArticles(id);

    // 创建阅读进度条
    removeReadingProgress();
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.id = 'readingProgress';
    progressBar.innerHTML = '<div class="reading-progress-bar" id="readingProgressBar"></div>';
    document.body.appendChild(progressBar);

    const progressHandler = () => {
      const bar = document.getElementById('readingProgressBar');
      if (!bar) return;
      const articleEl = document.querySelector('.article-detail');
      if (!articleEl) return;
      const rect = articleEl.getBoundingClientRect();
      const total = rect.height - window.innerHeight + 100;
      const scrolled = window.scrollY - rect.top + 100;
      const percent = Math.min(100, Math.max(0, (scrolled / total) * 100));
      bar.style.width = percent + '%';
    };
    window.addEventListener('scroll', progressHandler);

    app.innerHTML = `
      <article class="article-detail">
        <a href="#/" class="article-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回首页
        </a>

        <header class="article-detail-header">
          <h1 class="article-detail-title">${escapeHtml(article.title)}</h1>
          <div class="article-detail-meta">
            <span class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span id="articleDateText">${formatDate(article.date)}</span>
            </span>
            <span class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${escapeHtml(article.author || '效率工坊')}
            </span>
            ${isAdmin() ? `
              <button class="btn btn-outline btn-sm" id="editDateBtn" title="手动修改本文的更新日期">🗓 修改日期</button>
            ` : ''}
          </div>
          <div class="article-detail-tags">
            ${article.tags.map((t) => `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}
          </div>
        </header>

        <div class="markdown-body" id="markdownContent">
          <div class="loading"><div class="loading-spinner"></div></div>
        </div>

        <footer class="article-detail-footer">
          <div class="article-nav">
            ${prev ? `
              <div class="article-nav-item prev" data-id="${prev.id}">
                <div class="nav-label">← 上一篇</div>
                <div class="nav-title">${escapeHtml(prev.title)}</div>
              </div>
            ` : '<div></div>'}
            ${next ? `
              <div class="article-nav-item next" data-id="${next.id}">
                <div class="nav-label">下一篇 →</div>
                <div class="nav-title">${escapeHtml(next.title)}</div>
              </div>
            ` : '<div></div>'}
          </div>
        </footer>
      </article>
    `;

    // 渲染 Markdown（延迟一点显示 loading 效果）
    const mdContainer = document.getElementById('markdownContent');
    setTimeout(() => {
      mdContainer.innerHTML = renderMarkdown(article.content);
      // 代码高亮
      if (typeof hljs !== 'undefined') {
        mdContainer.querySelectorAll('pre code').forEach((block) => {
          try {
            hljs.highlightElement(block);
          } catch (e) {
            // ignore
          }
        });
      }
    }, 100);

    // 绑定上下篇导航
    document.querySelectorAll('.article-nav-item[data-id]').forEach((item) => {
      item.addEventListener('click', () => {
        const navId = item.getAttribute('data-id');
        Router.navigate('/article/' + encodeURIComponent(navId));
      });
    });

    // 绑定「修改日期」
    const editDateBtn = document.getElementById('editDateBtn');
    if (editDateBtn) {
      editDateBtn.addEventListener('click', () => showEditDateModal(article));
    }

    // 绑定标签点击
    bindTagClicks();

    scrollToTop();
  }

  // 手动修改文章更新日期
  function showEditDateModal(article) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal" style="max-width:420px;width:92%;">
        <div class="tool-modal-head">
          <span class="tool-modal-title">修改更新日期</span>
          <div class="tool-modal-tools">
            <button class="tool-modal-close" id="dateClose" title="关闭">✕</button>
          </div>
        </div>
        <div style="padding:20px;">
          <div class="form-group">
            <label class="form-label">更新日期</label>
            <input type="date" class="form-input" id="dateInput" value="${escapeHtml(article.date || '')}">
          </div>
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
            <button class="btn btn-primary" id="dateSave">保存</button>
            <button class="btn btn-outline" id="dateCancel">取消</button>
            <button class="btn btn-outline" id="dateToday" style="margin-left:auto;">设为今天</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#dateClose').addEventListener('click', close);
    overlay.querySelector('#dateCancel').addEventListener('click', close);
    overlay.querySelector('#dateToday').addEventListener('click', () => {
      overlay.querySelector('#dateInput').value = new Date().toISOString().slice(0, 10);
    });
    overlay.querySelector('#dateSave').addEventListener('click', () => {
      const val = overlay.querySelector('#dateInput').value;
      if (!val) {
        showToast('请选择日期', 'error');
        return;
      }
      try {
        Store.saveArticle({ id: article.id, date: val });
        // 局部更新详情页日期，避免整页重渲染导致滚动位置丢失
        const dateText = document.getElementById('articleDateText');
        if (dateText) dateText.textContent = formatDate(val);
        showToast('更新日期已修改', 'success');
        close();
      } catch (err) {
        showToast('保存失败：' + (err.message || '未知错误'), 'error');
        console.error(err);
      }
    });
  }

  // ============================================
   // 页面渲染：标签页
   // ============================================
  function renderTags(query) {
    const activeTag = query.tag || '';
    const tags = Store.getAllTags();
    const articles = activeTag ? Store.getArticlesByTag(activeTag) : [];

    app.innerHTML = `
      <div class="tags-page">
        <div class="section-header">
          <h2 class="section-title">标签分类</h2>
        </div>

        <div class="tags-cloud">
          <span class="tag-cloud-item ${!activeTag ? 'active' : ''}" data-tag="全部">
            全部 <span class="tag-cloud-count">${Store.getArticles().length}</span>
          </span>
          ${tags
            .map(
              (t) => `
            <span class="tag-cloud-item ${activeTag === t.name ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">
              ${escapeHtml(t.name)} <span class="tag-cloud-count">${t.count}</span>
            </span>
          `
            )
            .join('')}
        </div>

        ${activeTag ? `
          <div class="section-header" style="margin-top:32px;">
            <h2 class="section-title">「${escapeHtml(activeTag)}」相关文章</h2>
          </div>
          <div class="article-grid">
            ${renderArticleCards(articles)}
          </div>
        ` : `
          <div style="text-align:center;padding:40px;color:var(--text-muted);">
            <p>点击上方标签，查看相关文章 🏷️</p>
          </div>
        `}
      </div>
    `;

    // 绑定标签云点击
    document.querySelectorAll('.tag-cloud-item').forEach((item) => {
      item.addEventListener('click', () => {
        const tag = item.getAttribute('data-tag');
        if (tag === '全部') {
          Router.navigate('/tags');
        } else {
          Router.navigate('/tags?tag=' + encodeURIComponent(tag));
        }
      });
    });

    // 绑定文章卡片
    bindArticleCards();
  }

  // ============================================
   // 页面渲染：关于页面
   // ============================================
  function renderAbout() {
    app.innerHTML = `
      <div class="about-page">
        <div class="about-card">
          <div class="about-avatar">⚡</div>
          <h2 class="about-name">效率工坊</h2>
          <p class="about-bio">专注分享实用办公工具与效率提升技巧</p>
          <div class="about-skills">
            <span class="about-skill">📊 Excel</span>
            <span class="about-skill">📄 Word</span>
            <span class="about-skill">📝 Markdown</span>
            <span class="about-skill">🐍 Python</span>
            <span class="about-skill">🤝 协作工具</span>
            <span class="about-skill">⚙️ 自动化</span>
          </div>
          <div class="about-contact">
            <a href="#/apps">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              应用中心
            </a>
            <a href="#/">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              浏览文章
            </a>
          </div>
        </div>

        <div class="about-card">
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">关于本站</h3>
          <div class="markdown-body">
            <p>「效率工坊」是一个专注于<strong>实用办公工具</strong>分享的个人博客。</p>
            <p>在这里，你会找到：</p>
            <ul>
              <li><strong>工具推荐</strong> — 精选好用、高效的办公软件和在线工具</li>
              <li><strong>效率技巧</strong> — Excel、Word、Markdown 等工具的实用教程</li>
              <li><strong>自动化方案</strong> — 用 Python 等工具实现办公自动化</li>
              <li><strong>应用下载</strong> — 推荐软件的下载链接与使用说明</li>
            </ul>
            <blockquote>
              <p>我们的理念：<strong>工具服务于人，而非人服务于工具。</strong>选择合适的工具，把时间留给更有价值的事情。</p>
            </blockquote>
            <h3>联系方式</h3>
            <p>如果你有好用的工具推荐，或者想交流效率提升的心得，欢迎随时联系！</p>
          </div>
        </div>

        <div class="about-card">
          <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">技术栈</h3>
          <div class="markdown-body">
            <p>本博客使用以下技术构建：</p>
            <ul>
              <li><strong>前端</strong> — 原生 HTML / CSS / JavaScript</li>
              <li><strong>Markdown</strong> — marked.js + highlight.js + DOMPurify</li>
              <li><strong>数据存储</strong> — localStorage + IndexedDB（支持大文件）</li>
              <li><strong>路由</strong> — 自研轻量哈希路由</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    scrollToTop();
  }

  // ============================================
   // 页面渲染：应用中心
   // ============================================
  function currentFilteredApps() {
    return Store.getApps();
  }

  // 管理员判定：localStorage 中存有 adminKey（与 Cloudflare 环境变量 ADMIN_KEY 一致）即为管理员
  function isAdmin() {
    return (typeof localStorage !== 'undefined') && !!localStorage.getItem('adminKey');
  }

  function renderApps() {
    const apps = Store.getApps();
    const categories = Store.getAppCategories();

    app.innerHTML = `
      <div class="apps-page">
        <div class="section-header">
          <h2 class="section-title">应用中心</h2>
        </div>

        <!-- 管理员控制条：始终可见，用于进入 / 退出管理员模式 -->
        <div class="admin-bar" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px;">
          <button type="button" id="adminKeyBtn" style="border:1px solid var(--border-color);background:var(--bg-hover);color:var(--text-secondary);border-radius:var(--radius-md);padding:8px 12px;cursor:pointer;font-size:13px;">🔑 管理员</button>
          <span id="adminModeBadge" style="display:none;font-size:12px;color:var(--accent);font-weight:600;">管理员模式已开启</span>
          <span id="adminHint" style="font-size:12px;color:var(--text-secondary);">点击「管理员」并输入密钥，可发布 / 管理应用</span>
        </div>

        ${isAdmin() ? `
          <div class="app-upload-form" id="uploadForm">
            <h3 style="font-size:18px;font-weight:700;margin-bottom:20px;">添加应用</h3>
            <div class="form-group">
              <label class="form-label">应用名称 *</label>
              <input type="text" class="form-input" id="appName" placeholder="如：Snipaste">
            </div>
            <div class="form-group">
              <label class="form-label">应用链接 *</label>
              <input type="url" class="form-input" id="appLink" placeholder="https://...">
            </div>
            <div class="form-group">
              <label class="form-label">简单说明</label>
              <textarea class="form-textarea" id="appDesc" rows="3" placeholder="一句话介绍这个应用..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">介绍 HTML 文件 · 选填</label>
              <input type="file" id="appIntroInput" accept=".html,.htm,text/html">
              <div id="introInfo" style="margin-top:6px;font-size:13px;color:var(--text-secondary);"></div>
              <div style="margin-top:6px;font-size:12px;color:var(--text-secondary);">上传 .html 文件作为应用介绍页，点击应用卡片时会在弹窗中显示。</div>
            </div>
            <div class="form-group">
              <label class="form-label">定价方式</label>
              <div style="display:flex;gap:16px;align-items:center;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="radio" name="appCharge" value="free" checked id="appChargeFree">
                  <span>免费</span>
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="radio" name="appCharge" value="paid" id="appChargePaid">
                  <span>收费</span>
                </label>
              </div>
            </div>
            <div class="form-group" id="appPriceGroup" style="display:none;">
              <label class="form-label">定价（元） *</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;font-weight:600;">¥</span>
                <input type="number" class="form-input" id="appPrice" min="0.01" step="0.01" placeholder="9.90" style="flex:1;">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">联系邮箱 · 选填</label>
              <input type="email" class="form-input" id="appEmail" placeholder="如：you@example.com">
            </div>
            <div class="form-group">
              <label class="form-label">微信 · 选填</label>
              <input type="text" class="form-input" id="appWechat" placeholder="如：wxid_abc123 或 手机号">
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
              <button class="btn btn-primary" id="uploadBtn">添加应用</button>
            </div>
          </div>
        ` : `
          <div class="apps-upload-zone" id="uploadZone">
            <div class="upload-icon">🔒</div>
            <h3>仅管理员可发布应用</h3>
            <p>如需发布应用，请点击上方「🔑 管理员」并输入管理密钥。</p>
          </div>
        `}

        <!-- 应用列表 -->
        <div class="section-header apps-list-header" style="margin-top:32px;">
          <h2 class="section-title">应用列表</h2>
        </div>
        <div class="app-grid" id="appGrid">
          ${renderAppCards(currentFilteredApps(), isAdmin())}
        </div>
      </div>
    `;

    bindAppInteractions();
    scrollToTop();
  }

  function renderAppCards(apps, showDelete = true) {
    if (!apps || apps.length === 0) {
      return `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-icon">📦</div>
          <h3>暂无应用</h3>
          <p>添加第一个应用吧！</p>
        </div>
      `;
    }
    return apps
      .map(
        (a) => `
      <div class="app-card" data-app-detail="${a.id}" style="cursor:pointer;">
        <div class="app-card-icon">${a.icon || '📦'}</div>
        <h3 class="app-card-name">${escapeHtml(a.name)}</h3>
        <p class="app-card-desc">${escapeHtml(a.description || '暂无描述')}</p>
        <div class="app-card-actions">
          <button class="btn btn-primary btn-sm" data-app-detail="${a.id}">查看详情</button>
          ${showDelete ? `<button class="btn btn-danger btn-sm" data-delete="${a.id}">删除</button>` : ''}
        </div>
      </div>
    `
      )
      .join('');
  }

  function bindAppGridEvents(appGrid) {
    appGrid.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('[data-delete]');
      const detailBtn = e.target.closest('[data-app-detail]');

      // 删除按钮优先，避免点击卡片内部的删除时误开详情
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-delete');
        const app = Store.getApp(id);
        if (app && confirm(`确定要删除「${app.name}」吗？`)) {
          Store.deleteApp(id);
          Store.deleteAppFile(id).catch((err) => console.error('删除文件失败:', err));
          showToast('已删除', 'success');
          renderApps();
        }
        return;
      }

      if (detailBtn) {
        const app = Store.getApp(detailBtn.getAttribute('data-app-detail'));
        if (app) showAppDetailModal(app);
      }
    });
  }

  // 应用详情弹窗：展示链接 + HTML 介绍说明
  function showAppDetailModal(app) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal" style="max-width:760px;width:92%;">
        <div class="tool-modal-head">
          <span class="tool-modal-title">${escapeHtml(app.name)} ${app.price > 0 ? `<span style="margin-left:8px;padding:2px 8px;background:var(--accent-light);color:var(--accent);border-radius:999px;font-size:13px;font-weight:600;">¥${Number(app.price).toFixed(2)}</span>` : `<span style="margin-left:8px;padding:2px 8px;background:var(--bg-hover);color:var(--text-secondary);border-radius:999px;font-size:13px;font-weight:600;">免费</span>`}</span>
          <div class="tool-modal-tools">
            <button class="tool-modal-close" id="detailClose" title="关闭">✕</button>
          </div>
        </div>
        <div style="padding:20px;">
          <p style="margin:0 0 16px;color:var(--text-secondary);line-height:1.6;">${escapeHtml(app.description || '暂无描述')}</p>
          <div style="margin-bottom:16px;padding:12px 14px;background:var(--bg-hover);border-radius:var(--radius-sm);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <a class="btn btn-primary" href="${escapeHtml(app.link || '#')}" target="_blank" rel="noopener" ${app.link ? '' : 'disabled style="pointer-events:none;opacity:0.5;"'}>前往应用 ↗</a>
            <span style="font-size:13px;color:var(--text-secondary);word-break:break-all;">${escapeHtml(app.link || '未填写链接')}</span>
          </div>
          ${app.wechat || app.email ? `
          <div style="margin-bottom:16px;padding:14px 16px;background:var(--accent-light);border:1px solid var(--accent);border-radius:var(--radius-md);">
            ${app.wechat ? `<div style="font-size:15px;line-height:1.6;"><strong style="color:var(--accent);">有意愿请加微信领取：</strong><span style="font-weight:700;letter-spacing:0.5px;">${escapeHtml(app.wechat)}</span></div>` : ''}
            ${app.email ? `<div style="margin-top:8px;font-size:14px;color:var(--text-secondary);">联系邮箱：${escapeHtml(app.email)}</div>` : ''}
          </div>
          ` : ''}
          ${app.introHtml ? `
            <div style="border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;">
              <iframe class="tool-iframe" style="height:380px;width:100%;border:0;" srcdoc="${escapeHtml(app.introHtml)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
            </div>
          ` : '<p style="color:var(--text-secondary);font-size:13px;margin:0;">管理员尚未上传 HTML 介绍说明。</p>'}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#detailClose').addEventListener('click', close);
  }

  function bindAppInteractions() {
    const uploadBtn = document.getElementById('uploadBtn');
    const appGrid = document.getElementById('appGrid');

    // 未登录时只绑定列表事件
    if (!uploadBtn) {
      bindAppGridEvents(appGrid);
      return;
    }

    // 介绍 HTML 文件选择回显
    const introInputEl = document.getElementById('appIntroInput');
    if (introInputEl) {
      introInputEl.addEventListener('change', (e) => {
        const info = document.getElementById('introInfo');
        if (info && e.target.files.length > 0) {
          const f = e.target.files[0];
          info.innerHTML = `<strong>介绍文件：</strong>${escapeHtml(f.name)} (${formatSize(f.size)})`;
        }
      });
    }

    // 定价方式切换：选择收费时显示定价输入
    const chargeRadios = document.querySelectorAll('input[name="appCharge"]');
    const priceGroup = document.getElementById('appPriceGroup');
    if (chargeRadios.length && priceGroup) {
      chargeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
          priceGroup.style.display = radio.checked && radio.value === 'paid' ? 'block' : 'none';
        });
      });
    }

    // 确认添加
    uploadBtn.addEventListener('click', async () => {
      const name = document.getElementById('appName').value.trim();
      const link = (document.getElementById('appLink') || {}).value.trim();
      const desc = document.getElementById('appDesc').value.trim();
      const email = (document.getElementById('appEmail') || {}).value.trim();
      const wechat = (document.getElementById('appWechat') || {}).value.trim();

      const chargeRadio = document.querySelector('input[name="appCharge"]:checked');
      const chargeMode = (chargeRadio && chargeRadio.value) || 'free';
      let price = 0;
      if (chargeMode === 'paid') {
        const priceInput = document.getElementById('appPrice');
        const priceValue = parseFloat((priceInput && priceInput.value) || '');
        if (!priceValue || isNaN(priceValue) || priceValue <= 0) {
          showToast('选择收费后需填写有效的定价金额', 'error');
          return;
        }
        price = priceValue;
      }

      if (!name) {
        showToast('请填写应用名称', 'error');
        return;
      }
      if (!link) {
        showToast('请填写应用链接', 'error');
        return;
      }

      let introHtml = '';
      let introFileName = '';
      const introInput = document.getElementById('appIntroInput');
      if (introInput && introInput.files.length > 0) {
        const f = introInput.files[0];
        introFileName = f.name;
        introHtml = await f.text();
      }

      uploadBtn.disabled = true;
      uploadBtn.textContent = '添加中...';

      try {
        Store.saveApp({
          name: name,
          description: desc,
          link: link,
          email: email,
          wechat: wechat,
          introHtml: introHtml,
          introFileName: introFileName,
          icon: '📦',
          uploadDate: new Date().toISOString().slice(0, 10),
          hasFile: false,
          price: price,
          chargeMode: chargeMode,
        });

        const adminKey = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
        if (adminKey) {
          try {
            await Store.addOfficialApp({
              name: name, description: desc, link: link,
              email: email, wechat: wechat,
              introHtml: introHtml, introFileName: introFileName,
              price: price, chargeMode: chargeMode,
            });
            showToast('应用添加成功，并已发布到官方目录（全员实时可见）！', 'success');
          } catch (e) {
            showToast('本地已保存；发布官方目录失败：' + (e.message || '未知错误'), 'error');
          }
        } else {
          showToast('应用添加成功！', 'success');
        }
        renderApps();
      } catch (err) {
        showToast('添加失败：' + (err.message || '未知错误'), 'error');
        console.error(err);
        uploadBtn.disabled = false;
        uploadBtn.textContent = '添加应用';
      }
    });

    // 管理员密钥：开启后「添加应用」会同时写回官方目录（KV），对所有人实时可见
    const adminKeyBtn = document.getElementById('adminKeyBtn');
    if (adminKeyBtn) {
      const updateBadge = () => {
        const badge = document.getElementById('adminModeBadge');
        const has = (typeof localStorage !== 'undefined') && !!localStorage.getItem('adminKey');
        if (badge) badge.style.display = has ? 'inline' : 'none';
      };
      updateBadge();
      adminKeyBtn.addEventListener('click', () => {
        const cur = (typeof localStorage !== 'undefined') ? (localStorage.getItem('adminKey') || '') : '';
        const input = prompt(cur ? '当前已开启管理员模式，输入新密钥覆盖；留空则关闭：' : '输入管理员密钥以开启「发布到官方目录」（需与 Cloudflare 环境变量 ADMIN_KEY 一致）：', cur);
        if (input === null) return;
        if (input.trim() === '') {
          if (typeof localStorage !== 'undefined') localStorage.removeItem('adminKey');
          showToast('已关闭管理员模式', 'success');
        } else {
          if (typeof localStorage !== 'undefined') localStorage.setItem('adminKey', input.trim());
          showToast('管理员模式已开启', 'success');
        }
        updateBadge();
        // 切换管理员模式后重渲染，使添加表单 / 删除按钮立即出现或消失
        renderApps();
      });
    }

    // 下载、跳转、介绍、删除
    bindAppGridEvents(appGrid);
  }

  // ============================================
  // 首页 HTML 小工具窗口（12 格，2 页，每页 6 格，可翻页）
  // ============================================
  let homeToolPage = 1;
  const TOOL_TOTAL = 24;   // 工具区总容量（4 页，每页 6 格）
  const TOOL_PER_PAGE = 6;

  // 仅渲染当前页的 6 个格子（工具按存储顺序填充，空位为「上传」占位）
  // 编辑 / 删除 / 排序 / 上传入口仅管理员可见
  function renderToolsGridInner() {
    const tools = Store.getHomeTools();
    const admin = isAdmin();
    const start = (homeToolPage - 1) * TOOL_PER_PAGE;
    const slots = [];
    for (let i = start; i < start + TOOL_PER_PAGE; i++) {
      const t = tools[i];
      if (t) {
        const coverHtml = t.cover
          ? `<div class="tool-card-cover"><img src="${escapeHtml(t.cover)}" alt="${escapeHtml(t.name)}"><div class="tool-card-cover-icon">${escapeHtml(t.icon || '🧰')}</div></div>`
          : `<div class="tool-card-icon">${escapeHtml(t.icon || '🧰')}</div>`;
        slots.push(`
          <div class="tool-card${t.cover ? ' has-cover' : ''}" data-open-card="${t.id}">
            ${coverHtml}
            <h3 class="tool-card-name">${escapeHtml(t.name)}</h3>
            <p class="tool-card-desc">${escapeHtml(t.description || '')}</p>
            <div class="tool-card-actions">
              ${admin ? `<button class="btn btn-outline btn-sm tool-move-btn" data-move-tool="${t.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="上移">↑</button>` : ''}
              ${admin ? `<button class="btn btn-outline btn-sm tool-move-btn" data-move-tool="${t.id}" data-dir="1" ${i === tools.length - 1 ? 'disabled' : ''} title="下移">↓</button>` : ''}
              <button class="btn btn-primary btn-sm" data-open="${t.id}">打开</button>
              ${admin ? `<button class="btn btn-outline btn-sm" data-edit="${t.id}">✏️ 编辑</button>` : ''}
              ${admin && !t.builtin ? `<button class="btn btn-danger btn-sm" data-del-tool="${t.id}">删除</button>` : ''}
            </div>
          </div>
        `);
      } else if (admin) {
        slots.push(`
          <div class="tool-card tool-upload">
            <div class="tool-upload-icon">＋</div>
            <h3 class="tool-card-name">上传在线工具</h3>
            <p class="tool-card-desc">点击上传一个 .html 文件</p>
          </div>
        `);
      } else {
        slots.push(`
          <div class="tool-card tool-empty">
            <div class="tool-upload-icon">·</div>
            <h3 class="tool-card-name"> </h3>
            <p class="tool-card-desc"> </p>
          </div>
        `);
      }
    }
    return `<div class="tools-grid">${slots.join('')}</div>`;
  }

  // 渲染页码按钮（最多 4 页）
  function renderToolsPager() {
    const totalPages = Math.ceil(TOOL_TOTAL / TOOL_PER_PAGE);
    if (totalPages <= 1) return '';
    let btns = '';
    for (let p = 1; p <= totalPages; p++) {
      btns += `<button class="tool-page-btn${p === homeToolPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
    }
    return `<div class="tool-pager">${btns}</div>`;
  }

  function renderHomeTools() {
    return `
      <div class="section-header" style="margin-top:8px;">
        <h2 class="section-title">🛠️ 在线工具</h2>
      </div>
      <div id="homeToolsWrap">
        ${renderToolsGridInner()}
        ${renderToolsPager()}
        <input type="file" id="toolFileInput" accept=".html,.htm,text/html" style="display:none;">
      </div>
    `;
  }

  // 只刷新小工具区块（翻页时局部刷新，避免重渲染整个首页导致搜索框/滚动丢失）
  function refreshHomeTools() {
    const wrap = document.getElementById('homeToolsWrap');
    if (!wrap) return;
    wrap.innerHTML =
      renderToolsGridInner() +
      renderToolsPager() +
      '<input type="file" id="toolFileInput" accept=".html,.htm,text/html" style="display:none;">';
    bindHomeTools();
  }

  function bindHomeTools() {
    const grid = document.querySelector('.tools-grid');
    if (!grid) return;
    const fileInput = document.getElementById('toolFileInput');

    // 分页翻页：点击页码局部刷新小工具区块
    const pager = document.querySelector('.tool-pager');
    if (pager) {
      pager.querySelectorAll('.tool-page-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.getAttribute('data-page'), 10);
          if (p === homeToolPage) return;
          homeToolPage = p;
          refreshHomeTools();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }

    grid.querySelectorAll('.tool-upload').forEach((slot) => {
      slot.addEventListener('click', () => fileInput.click());
    });

    // 点击整个卡片（除按钮外）直接打开工具；「打开」按钮同样触发
    grid.querySelectorAll('[data-open-card]').forEach((card) => {
      card.addEventListener('click', async (e) => {
        if (e.target.closest('button')) return; // 编辑/删除/打开按钮自行处理
        const id = card.getAttribute('data-open-card');
        const tool = Store.getHomeTools().find((t) => t.id === id);
        if (tool) await openTool(tool);
      });
    });

    grid.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-open');
        const tool = Store.getHomeTools().find((t) => t.id === id);
        if (tool) await openTool(tool);
      });
    });

    grid.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-edit');
        const tool = Store.getHomeTools().find((t) => t.id === id);
        if (tool) showToolEditModal(tool);
      });
    });

    grid.querySelectorAll('[data-del-tool]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-tool');
        const tool = Store.getHomeTools().find((t) => t.id === id);
        if (tool && confirm('确定删除「' + tool.name + '」？')) {
          Store.deleteHomeTool(id);
          if (tool.fileId) Store.deleteAppFile(tool.fileId).catch((e) => console.error(e));
          showToast('已删除', 'success');
          renderHome({});
        }
      });
    });

    // 调整小工具顺序（上移 / 下移，跨页时自动跟随翻页）
    grid.querySelectorAll('[data-move-tool]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        const id = btn.getAttribute('data-move-tool');
        const dir = parseInt(btn.getAttribute('data-dir'), 10);
        const newIndex = Store.moveHomeTool(id, dir);
        if (newIndex === null) return;
        const targetPage = Math.floor(newIndex / TOOL_PER_PAGE) + 1;
        if (targetPage !== homeToolPage) {
          homeToolPage = targetPage;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        refreshHomeTools();
      });
    });

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleToolFileSelect(e.target.files[0]);
        e.target.value = '';
      });
    }
  }

  // 编辑小工具的使用说明 / 介绍（名称、图标、描述）
  function showToolEditModal(tool) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal edit-modal">
        <div class="tool-modal-head">
          <span class="tool-modal-title">编辑在线工具信息</span>
          <button class="tool-modal-close" id="editClose" title="关闭">✕</button>
        </div>
        <div class="edit-body">
          <div class="form-group">
            <label class="form-label">名称</label>
            <input type="text" class="form-input" id="editName" value="${escapeHtml(tool.name || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">图标（Emoji，最多 2 个字符）</label>
            <input type="text" class="form-input" id="editIcon" value="${escapeHtml(tool.icon || '🧰')}" maxlength="2" style="max-width:200px;">
          </div>
          <div class="form-group">
            <label class="form-label">使用说明 / 介绍</label>
            <textarea class="form-textarea" id="editDesc" rows="4" placeholder="详细描述这个工具怎么用、适用场景等...">${escapeHtml(tool.description || '')}</textarea>
          </div>
          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
            <button class="btn btn-outline" id="editCancel">取消</button>
            <button class="btn btn-primary" id="editSave">保存</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#editClose').addEventListener('click', close);
    overlay.querySelector('#editCancel').addEventListener('click', close);
    overlay.querySelector('#editSave').addEventListener('click', () => {
      const patch = {
        name: overlay.querySelector('#editName').value.trim() || tool.name,
        icon: overlay.querySelector('#editIcon').value.trim() || '🧰',
        description: overlay.querySelector('#editDesc').value.trim(),
      };
      Store.updateHomeTool(tool.id, patch);
      showToast('已更新', 'success');
      close();
      renderHome({});
    });
  }

  function handleToolFileSelect(file) {
    if (Store.getHomeTools().length >= Store.MAX_HOME_TOOLS) {
      showToast('最多 24 个在线工具，请先删除一个', 'error');
      return;
    }
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      showToast('请上传 .html 文件', 'error');
      return;
    }
    const id = 'tool_' + Store.generateId('t');
    const tool = {
      id,
      name: file.name.replace(/\.[^/.]+$/, ''),
      icon: '🧰',
      description: '用户上传的 HTML 小工具',
      builtin: false,
      fileId: id,
    };
    Store.saveHomeTool(tool);
    Store.saveAppFile(id, file, file.name, file.type)
      .then(() => {
        homeToolPage = 1; // 回到第 1 页，确保新上传的小工具可见
        showToast('在线工具已添加', 'success');
        renderHome({});
      })
      .catch((err) => {
        Store.deleteHomeTool(id);
        showToast('上传失败：' + (err.message || '未知错误'), 'error');
        console.error(err);
      });
  }

  async function openTool(tool) {
    let src;
    let isObjectUrl = false;
    if (tool.builtin && tool.src) {
      src = tool.src;
    } else {
      const rec = await Store.getAppFile(tool.fileId);
      if (!rec || !rec.blob) {
        showToast('工具文件缺失', 'error');
        return;
      }
      src = URL.createObjectURL(rec.blob);
      isObjectUrl = true;
    }
    showToolModal(tool.name, src, isObjectUrl);
  }

  function showToolModal(name, src, isObjectUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal">
        <div class="tool-modal-head">
          <span class="tool-modal-title">${escapeHtml(name)}</span>
          <div class="tool-modal-tools">
            <a class="btn btn-outline btn-sm" href="${src}" target="_blank" rel="noopener">新窗口打开</a>
            <button class="tool-modal-close" id="toolClose" title="关闭">✕</button>
          </div>
        </div>
        <iframe class="tool-iframe" src="${src}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-downloads-without-user-activation"></iframe>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
      if (isObjectUrl) URL.revokeObjectURL(src);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#toolClose').addEventListener('click', close);
  }

  // 应用介绍 HTML 弹窗（srcdoc 渲染用户上传的 .html）
  function showIntroModal(name, html) {
    const overlay = document.createElement('div');
    overlay.className = 'tool-modal-overlay';
    overlay.innerHTML = `
      <div class="tool-modal" style="max-width:920px;width:92%;">
        <div class="tool-modal-head">
          <span class="tool-modal-title">${escapeHtml(name)} · 应用介绍</span>
          <div class="tool-modal-tools">
            <button class="tool-modal-close" id="introClose" title="关闭">✕</button>
          </div>
        </div>
        <iframe class="tool-iframe" srcdoc="${escapeHtml(html)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#introClose').addEventListener('click', close);
  }

  // 真正执行应用下载（在广告弹窗之后调用）
  async function performAppDownload(id, app, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '准备中...';
    }
    try {
      const fileRecord = await Store.getAppFile(id);
      if (fileRecord && fileRecord.blob) {
        const url = URL.createObjectURL(fileRecord.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileRecord.fileName || app.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Store.incrementDownloadCount(id);
        showToast('开始下载 ' + app.name, 'success');
      } else {
        showToast('文件数据不存在', 'error');
      }
    } catch (err) {
      showToast('下载失败', 'error');
      console.error(err);
    }
    renderApps();
  }

  // 下载前弹广告（变现下载流量）
  function showDownloadAd(onProceed) {
    const overlay = document.createElement('div');
    overlay.className = 'ad-modal-overlay';
    overlay.innerHTML = `
      <div class="ad-modal">
        <div class="ad-label">广告 · AD</div>
        <div class="ad-box">
          <div class="ad-box-title">🎯 推荐：高效办公好物</div>
          <div class="ad-box-desc">此处为广告投放位，可替换为你的联盟推广链接 / Google AdSense / 自定义 HTML。</div>
          <div class="ad-ph">[ 广告位 300×250 ]</div>
        </div>
        <button class="btn btn-primary" id="adContinue" style="width:100%;margin-top:14px;">继续下载</button>
        <div class="ad-skip">下载即将开始，感谢支持本站 ❤</div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };
    overlay.querySelector('#adContinue').addEventListener('click', () => {
      close();
      onProceed();
    });
  }


  // ============================================
  // 404 页面
  // ============================================
  function renderNotFound() {
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>页面未找到</h3>
        <p>你访问的页面不存在，<a href="#/">返回首页</a></p>
      </div>
    `;
  }

  // ============================================
   // HTML 转义
   // ============================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
   // 主题切换
   // ============================================
  function initTheme() {
    const theme = Store.getTheme();
    document.documentElement.setAttribute('data-theme', theme);

    themeToggle.addEventListener('click', () => {
      const current = Store.getTheme();
      const newTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      Store.setTheme(newTheme);
    });
  }

  // ============================================
   // 导航栏滚动效果 & 回到顶部
   // ============================================
  function initScrollEffects() {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 10;
      navbar.classList.toggle('scrolled', scrolled);
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });

    backToTop.addEventListener('click', scrollToTop);
  }

  // ============================================
   // 移动端菜单
   // ============================================
  function initMobileMenu() {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });

    // 点击导航链接后关闭菜单
    navLinks.forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });
  }

  // ============================================
   // 初始化路由
   // ============================================
  function initRouter() {
    Router.register('/', (ctx) => {
      removeReadingProgress();
      renderHome(ctx.query);
      updateActiveNav('/');
      closeMobileMenu();
    });

    Router.register('/article/:id', (ctx) => {
      renderArticle(ctx.params);
      updateActiveNav('/');
      closeMobileMenu();
    });

    Router.register('/tags', (ctx) => {
      removeReadingProgress();
      renderTags(ctx.query);
      updateActiveNav('/tags');
      closeMobileMenu();
    });

    Router.register('/apps', () => {
      removeReadingProgress();
      renderApps();
      updateActiveNav('/apps');
      closeMobileMenu();
    });

    Router.register('/about', () => {
      removeReadingProgress();
      renderAbout();
      updateActiveNav('/about');
      closeMobileMenu();
    });

    Router.notFound(() => {
      removeReadingProgress();
      renderNotFound();
      closeMobileMenu();
    });

    Router.init();
  }

  // ============================================
   // 启动
   // ============================================
  async function init() {
    initMarkdown();
    initTheme();
    initScrollEffects();
    initMobileMenu();
    // 等待官方应用目录（data/official-apps.json）加载完成，确保首屏应用列表完整
    if (typeof Store.ready === 'function') {
      try { await Store.ready(); } catch (e) { /* 加载失败则回退内置示例 */ }
    }
    initRouter();
  }

  return { init };
})();

// DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
