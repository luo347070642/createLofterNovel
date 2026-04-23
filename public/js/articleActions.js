const ArticleActions = {
  actualIndexMap: new Map(),

  extractArticleContent(content) {
    let title = '';
    let normalContent = '';
    let payContent = '';

    const match = content.match(/【[^】]+】[^-]+-\s*(.+)/s);
    if (match) {
      const titlePart = match[0].substring(0, match[0].indexOf('-')).trim();
      title = titlePart;
      const mainContent = match[1].trim();

      const payContentMatch = mainContent.match(/【付费卡点】[\s\n]*(.+)/s);
      if (payContentMatch) {
        normalContent = mainContent.substring(0, payContentMatch.index).trim();
        payContent = payContentMatch[1].trim();
      } else {
        normalContent = mainContent;
      }
    } else {
      title = content.substring(0, 100).trim();
      normalContent = content;
    }

    return {
      title: title,
      normalContent: normalContent,
      payContent: payContent
    };
  },

  copyContentByIndex(index, type, articleId, updateCallback) {
    const articleContents = window.articleContents || [];
    const content = articleContents[index]?.[type];

    if (!content || content.trim() === '') {
      console.log('内容为空或格式不正确:', { type, content });
      if (window.showNotification) {
        window.showNotification('内容为空或格式不正确', 'error');
      }
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        if (window.showNotification) {
          window.showNotification('复制成功！', 'success');
        }
        if (updateCallback) {
          updateCallback(type, articleId);
        }
      } else {
        if (window.showNotification) {
          window.showNotification('复制失败，请手动复制', 'error');
        }
      }
    } catch (err) {
      console.error('复制失败:', err);
      if (window.showNotification) {
        window.showNotification('复制失败，请手动复制', 'error');
      }
    } finally {
      document.body.removeChild(textarea);
    }
  },

  updateArticleStatus(articleId, type, statusElement) {
    if (!statusElement) return;

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
  },

  viewArticleContent(index) {
    const articleContents = window.articleContents || [];

    if (index < 0 || index >= articleContents.length) {
      console.log('索引越界:', index, '总长度:', articleContents.length);
      if (window.showNotification) {
        window.showNotification('内容索引错误', 'error');
      }
      return;
    }

    const content = articleContents[index];

    if (!content) {
      console.log('内容为空:', content);
      if (window.showNotification) {
        window.showNotification('内容为空', 'error');
      }
      return;
    }

    const modal = document.getElementById('articleContentModal');
    const modalContent = document.getElementById('articleContentText');

    let fullText = '';
    if (content.title) {
      fullText += '【标题】\n' + content.title + '\n\n';
    }
    if (content.normalContent) {
      fullText += '【普通内容】\n' + content.normalContent + '\n\n';
    }
    if (content.payContent) {
      fullText += '【付费内容】\n' + content.payContent;
    }

    modalContent.textContent = fullText;
    modal.classList.remove('hidden');
  },

  closeArticleContentModal() {
    const modal = document.getElementById('articleContentModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  updateCopyStatusAPI(articleId, type) {
    if (articleId) {
      fetch(`/api/articles/${articleId}/copy-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('更新复制状态成功');
        }
      })
      .catch(err => {
        console.error('更新复制状态失败:', err);
      });
    }
  },

  getUpdateCallback(index, articleId) {
    return function(type, articleId) {
      const articleElement = document.querySelector(`[onclick="ArticleActions.copyContentByIndex(${index}, '${type}', ${articleId})"]`)?.closest('.p-4');
      if (articleElement) {
        const statusElement = articleElement.querySelector('.text-xs.rounded-full, .px-2.py-0.5.text-xs.rounded-full');
        ArticleActions.updateArticleStatus(articleId, type, statusElement);
      }
      ArticleActions.updateCopyStatusAPI(articleId, type);
    };
  },

  getArticleButtonsHtml(item, actualIndex) {
    const articleId = item.id;
    return `
      <button
        onclick="ArticleActions.copyContentByIndex(${actualIndex}, 'title', ${articleId}, ArticleActions.getUpdateCallback(${actualIndex}, ${articleId}))"
        class="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded hover:bg-blue-200 transition-colors"
      >
        标题
      </button>
      <button
        onclick="ArticleActions.copyContentByIndex(${actualIndex}, 'normalContent', ${articleId}, ArticleActions.getUpdateCallback(${actualIndex}, ${articleId}))"
        class="px-2 py-1 bg-green-100 text-green-600 text-xs rounded hover:bg-green-200 transition-colors"
      >
        普通内容
      </button>
      <button
        onclick="ArticleActions.copyContentByIndex(${actualIndex}, 'payContent', ${articleId}, ArticleActions.getUpdateCallback(${actualIndex}, ${articleId}))"
        class="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded hover:bg-purple-200 transition-colors"
      >
        付费内容
      </button>
      <button
        onclick="ArticleActions.viewArticleContent(${actualIndex})"
        class="px-2 py-1 bg-indigo-100 text-indigo-600 text-xs rounded hover:bg-indigo-200 transition-colors"
      >
        查看
      </button>
    `;
  },

  getStatusBadge(item) {
    const titleCopied = item.title_copied === 1;
    const normalContentCopied = item.normal_content_copied === 1;
    const payContentCopied = item.pay_content_copied === 1;
    const allCopied = titleCopied && normalContentCopied && payContentCopied;
    const hasPayPoint = item.article_content?.includes('【付费卡点】') || item.article_content?.includes('【付费卡点】\u200b');

    let statusText = '';
    if (!hasPayPoint) {
      statusText = '内容异常';
    } else if (allCopied) {
      statusText = '已发布';
    } else {
      statusText = '未发布';
    }

    const badgeClass = !hasPayPoint ? 'bg-red-100 text-red-700' : (allCopied ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700');
    return `<span class="px-2 py-0.5 ${badgeClass} text-xs rounded-full">${statusText}</span>`;
  }
};

window.ArticleActions = ArticleActions;