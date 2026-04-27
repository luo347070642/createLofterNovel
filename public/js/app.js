let isProcessing = false;
let currentPage = 1;
let currentGengPage = 1;
let currentArticlePage = 1;
const pageSize = 3;

let allWorkCpItems = [];
let allGengContent = [];
let allArticles = [];
let originalGengContent = [];
let originalArticles = [];

function generatePagination(totalPages, currentPage, callbackName) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
      <button 
        onclick="${callbackName}(${page})"
        class="w-8 h-8 border border-gray-300 rounded-md transition-colors flex items-center justify-center ${currentPage === page ? 'bg-blue-500 text-white border-blue-500' : 'hover:bg-gray-100'}"
      >
        ${page}
      </button>
    `).join('');
  }

  let html = '';

  html += `
    <button 
      onclick="${callbackName}(1)"
      class="w-8 h-8 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center ${currentPage === 1 ? 'bg-blue-500 text-white border-blue-500' : ''}"
    >
      1
    </button>
  `;

  if (currentPage > 4) {
    html += '<span class="px-2 text-gray-400">...</span>';
  }

  let startPage, endPage;
  if (currentPage <= 3) {
    startPage = 2;
    endPage = Math.min(5, totalPages - 1);
  } else if (currentPage >= totalPages - 2) {
    startPage = Math.max(2, totalPages - 4);
    endPage = totalPages - 1;
  } else {
    startPage = currentPage - 1;
    endPage = currentPage + 1;
  }

  for (let page = startPage; page <= endPage; page++) {
    html += `
      <button 
        onclick="${callbackName}(${page})"
        class="w-8 h-8 border border-gray-300 rounded-md transition-colors flex items-center justify-center ${currentPage === page ? 'bg-blue-500 text-white border-blue-500' : 'hover:bg-gray-100'}"
      >
        ${page}
      </button>
    `;
  }

  if (currentPage < totalPages - 3) {
    html += '<span class="px-2 text-gray-400">...</span>';
  }

  if (totalPages > 1) {
    html += `
      <button 
        onclick="${callbackName}(${totalPages})"
        class="w-8 h-8 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center ${currentPage === totalPages ? 'bg-blue-500 text-white border-blue-500' : ''}"
      >
        ${totalPages}
      </button>
    `;
  }

  return html;
}

async function addWorkCp() {
  const workName = document.getElementById('workName').value.trim();
  const cpName = document.getElementById('cpName').value.trim();

  if (!workName || !cpName) {
    showNotification('请填写作品名和CP名', 'error');
    return;
  }

  const response = await fetch('/api/work-cp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workName, cpName })
  });
  const data = await response.json();

  if (data.success) {
    showNotification('添加成功', 'success');
    document.getElementById('workName').value = '';
    document.getElementById('cpName').value = '';
    loadData();
  } else {
    showNotification('添加失败: ' + data.message, 'error');
  }
}

async function deleteWorkCp(id) {
  const confirmed = await showCustomConfirm('确定删除这条记录吗？');
  if (!confirmed) return;

  const response = await fetch(`/api/work-cp/${id}`, { method: 'DELETE' });
  const data = await response.json();

  if (data.success) {
    loadData();
    showNotification('删除成功', 'success');
  } else {
    showNotification('删除失败: ' + data.message, 'error');
  }
}

async function searchGeng(workName, cpName) {
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 搜梗中...';

  const response = await fetch('/api/search-geng', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workName, cpName })
  });
  const data = await response.json();

  btn.disabled = false;
  btn.innerHTML = '<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> 搜梗';

  if (data.success) {
    showNotification(`搜梗成功！获取到 ${data.count} 条梗`, 'success');
    loadData();
  } else {
    showNotification('搜梗失败: ' + data.message, 'error');
  }
}

async function generateArticles() {
  const workCpFilterSelect = document.getElementById('gengWorkCpFilter');
  const statusFilterSelect = document.getElementById('gengStatusFilter');

  const workCpFilter = workCpFilterSelect.value;
  const statusFilter = statusFilterSelect.value;

  const gengRes = await fetch('/api/geng-content');
  const gengData = await gengRes.json();

  if (gengData.success) {
    let gengList = gengData.data || [];

    if (workCpFilter) {
      gengList = gengList.filter(item => {
        const itemWorkCp = `${item.work_name} / ${item.cp_name}`;
        return itemWorkCp === workCpFilter;
      });
    }

    let pendingGengs = gengList.filter(geng => geng.status === 'pending');

    if (statusFilter && statusFilter !== 'pending') {
      pendingGengs = [];
    }

    if (gengList.length === 0) {
      showNotification('没有符合条件的梗内容', 'error');
      return;
    }

    if (pendingGengs.length === 0) {
      showNotification('筛选后的梗内容都已生成文章，无需再次生成', 'info');
      return;
    }
  }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 生成中...';

  updateStatus('running', '正在生成文章，请耐心等待...');

  const response = await fetch('/api/generate-articles', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workCpFilter, statusFilter })
  });
  const data = await response.json();

  btn.disabled = false;
  btn.innerHTML = '<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> 开始生成文章';

  updateStatus('ready', '就绪');

  if (data.success) {
    showNotification(`文章生成完成！成功生成 ${data.count} 篇文章`, 'success');
    loadData();
  } else {
    showNotification('生成失败: ' + data.message, 'error');
  }
}

async function deleteArticle(id) {
  const confirmed = await showCustomConfirm('确定删除这篇文章吗？');
  if (!confirmed) return;

  const response = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
  const data = await response.json();

  if (data.success) {
    loadData();
    showNotification('删除成功', 'success');
  } else {
    showNotification('删除失败: ' + data.message, 'error');
  }
}

async function deleteGengContent(id) {
  const confirmed = await showCustomConfirm('确定删除这条梗内容吗？');
  if (!confirmed) return;

  const response = await fetch(`/api/geng-content/${id}`, { method: 'DELETE' });
  const data = await response.json();

  if (data.success) {
    loadData();
    showNotification('删除成功', 'success');
  } else {
    showNotification('删除失败: ' + data.message, 'error');
  }
}

async function generateSingleArticle(gengId) {
  if (isProcessing) {
    showNotification('正在处理中，请稍后', 'error');
    return;
  }

  isProcessing = true;
  updateStatus('running', '正在生成文章...');

  try {
    const response = await fetch('/api/generate-single-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gengId })
    });
    const data = await response.json();

    if (data.success) {
      showNotification('文章生成成功', 'success');
      loadData();
    } else {
      showNotification('生成失败: ' + data.message, 'error');
    }
  } catch (error) {
    showNotification('生成失败: ' + error.message, 'error');
  } finally {
    isProcessing = false;
    updateStatus('ready', '就绪');
  }
}

function populateWorkCpDropdown(workCpItems) {
  const gengWorkCpSelect = document.getElementById('gengWorkCpFilter');
  const articleWorkCpSelect = document.getElementById('articleWorkCpFilter');
  const gengStatusSelect = document.getElementById('gengStatusFilter');
  const articleStatusSelect = document.getElementById('articleStatusFilter');

  gengWorkCpSelect.innerHTML = '<option value="">所有作品/CP</option>';
  articleWorkCpSelect.innerHTML = '<option value="">所有作品/CP</option>';

  workCpItems.forEach(item => {
    const optionText = `${item.work_name} / ${item.cp_name}`;

    const option1 = document.createElement('option');
    option1.value = optionText;
    option1.textContent = optionText;
    gengWorkCpSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = optionText;
    option2.textContent = optionText;
    articleWorkCpSelect.appendChild(option2);
  });

  const savedGengWorkCpFilter = localStorage.getItem('gengWorkCpFilter');
  const savedGengStatusFilter = localStorage.getItem('gengStatusFilter');
  const savedArticleWorkCpFilter = localStorage.getItem('articleWorkCpFilter');
  const savedArticleStatusFilter = localStorage.getItem('articleStatusFilter');

  if (savedGengWorkCpFilter) {
    gengWorkCpSelect.value = savedGengWorkCpFilter;
  }
  if (savedGengStatusFilter) {
    gengStatusSelect.value = savedGengStatusFilter;
  }
  if (savedArticleWorkCpFilter) {
    articleWorkCpSelect.value = savedArticleWorkCpFilter;
  }
  if (savedArticleStatusFilter) {
    articleStatusSelect.value = savedArticleStatusFilter;
  }
}

function renderWorkCpList(items) {
  const container = document.getElementById('workCpList');

  allWorkCpItems = items;

  if (items.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">暂无数据</div>';
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const currentItems = items.slice(start, end);

  const totalPages = Math.ceil(items.length / pageSize);

  let html = currentItems.map(item => `
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div>
        <div class="font-medium text-gray-800">${escapeHtml(item.work_name)} / ${escapeHtml(item.cp_name)}</div>
      </div>
      <div class="flex gap-2">
        <button 
          onclick="searchGeng('${escapeHtml(item.work_name)}', '${escapeHtml(item.cp_name)}')"
          class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          搜梗
        </button>
        <button 
          data-id="${escapeHtml(item.id)}"
          onclick="deleteWorkCp(this.dataset.id)"
          class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  `).join('');

  if (totalPages > 1) {
    html += `
      <div class="flex items-center justify-center mt-4 gap-2 flex-wrap">
        <button 
          onclick="changePage(${Math.max(1, currentPage - 1)})"
          ${currentPage === 1 ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          ← 上一页
        </button>
        ${generatePagination(totalPages, currentPage, 'changePage')}
        <button 
          onclick="changePage(${Math.min(totalPages, currentPage + 1)})"
          ${currentPage === totalPages ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          下一页 →
        </button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function changePage(page) {
  currentPage = page;
  renderWorkCpList(allWorkCpItems);
}

function renderGengContentList(items) {
  const container = document.getElementById('gengContentList');

  originalGengContent = items;
  allGengContent = items;

  if (items.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">暂无数据</div>';
    return;
  }

  GengActions.setGengContentMap(items);

  const start = (currentGengPage - 1) * pageSize;
  const end = start + pageSize;
  const currentItems = items.slice(start, end);

  const totalPages = Math.ceil(items.length / pageSize);

  let html = currentItems.map(item => {
    return `
    <div class="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
         data-geng-id="${escapeHtml(item.id)}"
         onclick="GengActions.viewGengContent(this.dataset.gengId)">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-blue-600">${escapeHtml(item.work_name)} / ${escapeHtml(item.cp_name)} / ${GengActions.getStatusBadge(item)}</span>
        <div class="flex items-center gap-2">
          ${GengActions.getItemButtonsHtml(item, () => loadData())}
        </div>
      </div>
      <div class="text-sm text-gray-700 line-clamp-2">${escapeHtml(item.geng_text)}</div>
    </div>
  `;
  }).join('');

  if (totalPages > 1) {
    html += `
      <div class="flex items-center justify-center mt-4 gap-2 flex-wrap">
        <button 
          onclick="changeGengPage(${Math.max(1, currentGengPage - 1)})"
          ${currentGengPage === 1 ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentGengPage === 1 ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          ← 上一页
        </button>
        ${generatePagination(totalPages, currentGengPage, 'changeGengPage')}
        <button 
          onclick="changeGengPage(${Math.min(totalPages, currentGengPage + 1)})"
          ${currentGengPage === totalPages ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentGengPage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          下一页 →
        </button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function changeGengPage(page) {
  currentGengPage = page;
  filterGengContent(false);
}

async function filterGengContent(resetPage = true) {
  const gengRes = await fetch('/api/geng-content');
  const gengData = await gengRes.json();
  const allItems = gengData.data || [];

  const workCpFilterSelect = document.getElementById('gengWorkCpFilter');
  const statusFilterSelect = document.getElementById('gengStatusFilter');

  const workCpFilter = workCpFilterSelect.value;
  const statusFilter = statusFilterSelect.value;

  localStorage.setItem('gengWorkCpFilter', workCpFilter);
  localStorage.setItem('gengStatusFilter', statusFilter);

  if (resetPage) {
    currentGengPage = 1;
  }

  let filteredItems = allItems;

  if (workCpFilter) {
    filteredItems = filteredItems.filter(item => {
      const itemWorkCp = `${item.work_name} / ${item.cp_name}`;
      return itemWorkCp === workCpFilter;
    });
  }

  if (statusFilter) {
    filteredItems = filteredItems.filter(item => item.status === statusFilter);
  }

  originalGengContent = allItems;
  allGengContent = allItems;

  renderGengContentList(filteredItems);
}

function renderArticleList(items) {
  const container = document.getElementById('articleList');

  originalArticles = items;
  allArticles = items;

  if (items.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">暂无数据</div>';
    return;
  }

  const start = (currentArticlePage - 1) * pageSize;
  const end = start + pageSize;
  const currentItems = items.slice(start, end);

  const totalPages = Math.ceil(items.length / pageSize);

  let html = currentItems.map((item, index) => {
    const actualIndex = start + index;
    const content = item.article_content || '';

    const extracted = ArticleActions.extractArticleContent(content);

    window.articleContents = window.articleContents || [];
    window.articleContents[actualIndex] = extracted;

    const articleId = item.id;
    const titleCopied = item.title_copied === 1;
    const normalContentCopied = item.normal_content_copied === 1;
    const payContentCopied = item.pay_content_copied === 1;
    const allCopied = titleCopied && normalContentCopied && payContentCopied;

    const hasPayPoint = content.includes('【付费卡点】') || content.includes('【付费卡点】\u200b');

    let statusText = '';

    if (!hasPayPoint) {
      statusText = '内容异常';
    } else if (allCopied) {
      statusText = '已发布';
    } else {
      statusText = '未发布';
    }

    return `
      <div class="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors cursor-pointer"
           data-index="${actualIndex}"
           onclick="viewArticleContent(${actualIndex})">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-green-600">${escapeHtml(item.work_name)} / ${escapeHtml(item.cp_name)} / <span class="px-2 py-1 ${hasPayPoint ? (allCopied ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 'bg-red-100 text-red-700'} text-xs rounded">${statusText}</span></span>
          <div class="flex items-center gap-2">
            ${ArticleActions.getItemButtonsHtml(item, actualIndex, () => loadData())}
          </div>
        </div>
        <div class="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">${escapeHtml(content)}</div>
      </div>
    `;
  }).join('');

  if (totalPages > 1) {
    html += `
      <div class="flex items-center justify-center mt-4 gap-2 flex-wrap">
        <button 
          onclick="changeArticlePage(${Math.max(1, currentArticlePage - 1)})"
          ${currentArticlePage === 1 ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentArticlePage === 1 ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          ← 上一页
        </button>
        ${generatePagination(totalPages, currentArticlePage, 'changeArticlePage')}
        <button 
          onclick="changeArticlePage(${Math.min(totalPages, currentArticlePage + 1)})"
          ${currentArticlePage === totalPages ? 'disabled' : ''}
          class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center text-sm font-medium ${currentArticlePage === totalPages ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          下一页 →
        </button>
      </div>
    `;
  }

  container.innerHTML = html;
}

function changeArticlePage(page) {
  currentArticlePage = page;
  filterArticleContent(false);
}

async function filterArticleContent(resetPage = true) {
  const articleRes = await fetch('/api/articles');
  const articleData = await articleRes.json();
  const allItems = articleData.data || [];

  const workCpFilterSelect = document.getElementById('articleWorkCpFilter');
  const statusFilterSelect = document.getElementById('articleStatusFilter');

  const workCpFilter = workCpFilterSelect.value;
  const statusFilter = statusFilterSelect.value;

  localStorage.setItem('articleWorkCpFilter', workCpFilter);
  localStorage.setItem('articleStatusFilter', statusFilter);

  if (resetPage) {
    currentArticlePage = 1;
  }

  let filteredItems = allItems;

  if (workCpFilter) {
    filteredItems = filteredItems.filter(item => {
      const itemWorkCp = `${item.work_name} / ${item.cp_name}`;
      return itemWorkCp === workCpFilter;
    });
  }

  if (statusFilter) {
    filteredItems = filteredItems.filter(item => {
      const titleCopied = item.title_copied === 1;
      const normalContentCopied = item.normal_content_copied === 1;
      const payContentCopied = item.pay_content_copied === 1;
      const allCopied = titleCopied && normalContentCopied && payContentCopied;

      if (statusFilter === 'published') {
        return allCopied;
      } else if (statusFilter === 'unpublished') {
        return !allCopied;
      }
      return true;
    });
  }

  originalArticles = allItems;
  allArticles = allItems;

  renderArticleList(filteredItems);
}

function copyContentByIndex(index, type, articleId) {
  const updateCallback = function(type, articleId) {
    const articleElement = document.querySelector(`[onclick="copyContentByIndex(${index}, '${type}', ${articleId})"]`).closest('.p-4');
    if (articleElement) {
      const statusElement = articleElement.querySelector('.text-xs.rounded-full, .text-xs.rounded');
      if (statusElement && statusElement.tagName !== 'BUTTON') {
        const titleCopied = type === 'title' || statusElement.textContent.includes('已发布');
        const normalContentCopied = type === 'normalContent' || statusElement.textContent.includes('已发布');
        const payContentCopied = type === 'payContent' || statusElement.textContent.includes('已发布');
        const allCopied = titleCopied && normalContentCopied && payContentCopied;

        if (allCopied) {
          statusElement.className = 'px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full';
          statusElement.textContent = '已发布';
        } else {
          statusElement.className = 'px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full';
          statusElement.textContent = '未发布';
        }
      }
    }

    if (articleId) {
      fetch(`/api/articles/${articleId}/copy-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 不触发 loadData，只更新本地状态显示
        }
      })
      .catch(err => {
        console.error('更新复制状态失败:', err);
      });
    }
  };

  ArticleActions.copyContentByIndex(index, type, articleId, updateCallback);
}

function updateStatus(status, text) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  indicator.className = `w-3 h-3 rounded-full ${
    status === 'running' ? 'bg-green-500 animate-pulse' :
    status === 'error' ? 'bg-red-500' : 'bg-gray-300'
  }`;
  statusText.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function viewGengContent(id, text) {
  const modal = document.getElementById('gengContentModal');
  const modalContent = document.getElementById('gengContentText');
  modalContent.textContent = text;
  modal.classList.remove('hidden');
}

function viewArticleContent(index) {
  ArticleActions.viewArticleContent(index);
}

// 这些函数已移至components.js中

async function switchDatabase(type) {
  const btnSqlite = document.getElementById('btnSqlite');
  const btnMysql = document.getElementById('btnMysql');

  if (type === 'sqlite') {
    // SQLite 选中状态
    btnSqlite.classList.remove('bg-blue-50', 'text-blue-600', 'border-2', 'border-blue-500');
    btnSqlite.classList.add('bg-blue-600', 'text-white', 'border-2', 'border-blue-700', 'shadow-lg', 'font-bold');
    // MySQL 未选中状态
    btnMysql.classList.remove('bg-orange-600', 'text-white', 'border-2', 'border-orange-700', 'shadow-lg', 'font-bold');
    btnMysql.classList.add('bg-orange-50', 'text-orange-600', 'border-2', 'border-orange-500');
  } else {
    // MySQL 选中状态
    btnMysql.classList.remove('bg-orange-50', 'text-orange-600', 'border-2', 'border-orange-500');
    btnMysql.classList.add('bg-orange-600', 'text-white', 'border-2', 'border-orange-700', 'shadow-lg', 'font-bold');
    // SQLite 未选中状态
    btnSqlite.classList.remove('bg-blue-600', 'text-white', 'border-2', 'border-blue-700', 'shadow-lg', 'font-bold');
    btnSqlite.classList.add('bg-blue-50', 'text-blue-600', 'border-2', 'border-blue-500');
  }

  const response = await fetch('/api/database/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type })
  });
  const data = await response.json();

  if (data.success) {
    showNotification(`已切换到 ${type.toUpperCase()} 数据库`, 'success');
    loadData();
  } else {
    showNotification('切换数据库失败: ' + data.message, 'error');
    if (type === 'sqlite') {
      btnSqlite.classList.remove('bg-blue-600', 'text-white', 'border-2', 'border-blue-700', 'shadow-lg', 'font-bold');
      btnSqlite.classList.add('bg-blue-50', 'text-blue-600', 'border-2', 'border-blue-500');
    } else {
      btnMysql.classList.remove('bg-orange-600', 'text-white', 'border-2', 'border-orange-700', 'shadow-lg', 'font-bold');
      btnMysql.classList.add('bg-orange-50', 'text-orange-600', 'border-2', 'border-orange-500');
    }
  }
}

async function syncFromMysql() {
  const confirmed = await showCustomConfirm('从云端同步将根据ID进行增量同步，确定要继续吗？');
  if (!confirmed) return;
  
  updateStatus('running', '正在从云端同步数据...');
  
  try {
    const response = await fetch('/api/sync/from-mysql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    if (data.success) {
      showNotification(`从云端同步成功！新增 ${data.stats.workCpAdded} 个作品/CP，${data.stats.gengContentAdded} 个梗内容，${data.stats.articlesAdded} 篇文章；更新 ${data.stats.workCpUpdated} 个作品/CP，${data.stats.gengContentUpdated} 个梗内容，${data.stats.articlesUpdated} 篇文章；删除 ${data.stats.workCpDeleted} 个作品/CP，${data.stats.gengContentDeleted} 个梗内容，${data.stats.articlesDeleted} 篇文章`, 'success');
      loadData();
      await loadMysqlStats();
    } else {
      showNotification('同步失败: ' + data.message, 'error');
    }
  } catch (error) {
    showNotification('同步失败: ' + error.message, 'error');
  } finally {
    updateStatus('ready', '就绪');
  }
}

async function syncToMysql() {
  const confirmed = await showCustomConfirm('同步到云端将根据ID进行增量同步，确定要继续吗？');
  if (!confirmed) return;
  
  updateStatus('running', '正在同步数据到云端...');
  
  try {
    const response = await fetch('/api/sync/to-mysql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    if (data.success) {
      showNotification(`同步到云端成功！新增 ${data.stats.workCpAdded} 个作品/CP，${data.stats.gengContentAdded} 个梗内容，${data.stats.articlesAdded} 篇文章；更新 ${data.stats.workCpUpdated} 个作品/CP，${data.stats.gengContentUpdated} 个梗内容，${data.stats.articlesUpdated} 篇文章；删除 ${data.stats.workCpDeleted} 个作品/CP，${data.stats.gengContentDeleted} 个梗内容，${data.stats.articlesDeleted} 篇文章`, 'success');
      loadData();
      await loadMysqlStats();
    } else {
      showNotification('同步失败: ' + data.message, 'error');
    }
  } catch (error) {
    showNotification('同步失败: ' + error.message, 'error');
  } finally {
    updateStatus('ready', '就绪');
  }
}

async function loadData() {
  const [workCpRes, statusRes, dbTypeRes] = await Promise.all([
    fetch('/api/work-cp'),
    fetch('/api/status'),
    fetch('/api/database/type')
  ]);

  const workCpData = await workCpRes.json();
  const statusData = await statusRes.json();
  const dbTypeData = await dbTypeRes.json();

  renderWorkCpList(workCpData.data || []);
  populateWorkCpDropdown(workCpData.data || []);

  filterGengContent();
  filterArticleContent();

  if (statusData.success) {
    // 显示 SQLite 的统计数据（始终固定显示）
    document.getElementById('workCpCount').textContent = statusData.data.sqlite.workCpCount;
    document.getElementById('gengCount').textContent = statusData.data.sqlite.gengCount;
    document.getElementById('articleCount').textContent = statusData.data.sqlite.articleCount;

    if (statusData.data.isProcessing) {
      updateStatus('running', '正在处理中...');
    }
  }

  if (dbTypeData.success) {
    const btnSqlite = document.getElementById('btnSqlite');
    const btnMysql = document.getElementById('btnMysql');
    
    if (btnSqlite && btnMysql) {
      if (dbTypeData.data === 'sqlite') {
        btnSqlite.classList.remove('bg-blue-50', 'text-blue-600', 'border-2', 'border-blue-500');
        btnSqlite.classList.add('bg-blue-600', 'text-white', 'border-2', 'border-blue-700', 'shadow-lg', 'font-bold');
        btnMysql.classList.remove('bg-orange-600', 'text-white', 'border-2', 'border-orange-700', 'shadow-lg', 'font-bold');
        btnMysql.classList.add('bg-orange-50', 'text-orange-600', 'border-2', 'border-orange-500');
      } else {
        btnMysql.classList.remove('bg-orange-50', 'text-orange-600', 'border-2', 'border-orange-500');
        btnMysql.classList.add('bg-orange-600', 'text-white', 'border-2', 'border-orange-700', 'shadow-lg', 'font-bold');
        btnSqlite.classList.remove('bg-blue-600', 'text-white', 'border-2', 'border-blue-700', 'shadow-lg', 'font-bold');
        btnSqlite.classList.add('bg-blue-50', 'text-blue-600', 'border-2', 'border-blue-500');
      }
    }
  }
}

async function loadMysqlStats() {
  try {
    const response = await fetch('/api/status?includeMysql=true');
    const statusData = await response.json();
    
    if (statusData.success && statusData.data.mysql) {
      document.getElementById('mysqlWorkCpCount').textContent = statusData.data.mysql.workCpCount;
      document.getElementById('mysqlGengCount').textContent = statusData.data.mysql.gengCount;
      document.getElementById('mysqlArticleCount').textContent = statusData.data.mysql.articleCount;
    }
  } catch (error) {
    console.error('加载云端统计数据失败:', error);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadData();
});