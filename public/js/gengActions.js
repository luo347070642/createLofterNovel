const GengActions = {
  gengContentMap: new Map(),

  setGengContentMap(items) {
    this.gengContentMap.clear();
    items.forEach(item => {
      const id = item.id; // 保持原始ID类型（TEXT）
      this.gengContentMap.set(id, item.geng_text);
    });
  },

  getGengContent(id) {
    return this.gengContentMap.get(id) || '';
  },

  viewGengContent(id) {
    const text = this.getGengContent(id);
    if (!text) {
      if (window.showNotification) {
        window.showNotification('未找到梗内容', 'error');
      }
      return;
    }

    const modal = document.getElementById('gengContentModal');
    const content = document.getElementById('gengContentText');
    if (modal && content) {
      content.textContent = text;
      modal.classList.remove('hidden');
    }
  },

  viewGengContentBtn(btn) {
    const id = btn.dataset.id; // 保持原始ID类型（TEXT）
    this.viewGengContent(id);
  },

  closeGengContentModal() {
    const modal = document.getElementById('gengContentModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  async generateSingleArticle(gengId, reloadCallback) {
    if (this.isProcessing) {
      if (window.showNotification) {
        window.showNotification('正在处理中，请稍后', 'error');
      }
      return;
    }

    this.isProcessing = true;

    try {
      const response = await fetch('/api/generate-single-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gengId }) // 保持原始ID类型
      });
      const data = await response.json();

      if (data.success) {
        if (window.showNotification) {
          window.showNotification('文章生成成功', 'success');
        }
        if (reloadCallback) {
          await reloadCallback();
        }
      } else {
        if (window.showNotification) {
          window.showNotification('生成失败: ' + data.message, 'error');
        }
      }
    } catch (error) {
      if (window.showNotification) {
        window.showNotification('生成失败: ' + error.message, 'error');
      }
    } finally {
      this.isProcessing = false;
    }
  },

  async deleteGeng(id, reloadCallback) {
    showConfirm('确定要删除这条记录吗？', async () => {
      try {
        const response = await fetch(`/api/geng-content/${id}`, {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          if (window.showNotification) {
            window.showNotification('删除成功', 'success');
          }
          if (reloadCallback) {
            await reloadCallback();
          }
        } else {
          if (window.showNotification) {
            window.showNotification('删除失败: ' + data.message, 'error');
          }
        }
      } catch (error) {
        if (window.showNotification) {
          window.showNotification('删除失败: ' + error.message, 'error');
        }
      }
    });
  },

  getStatusBadge(item) {
    if (item.status === 'completed') {
      return '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">已完成</span>';
    } else {
      return '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">待生成</span>';
    }
  },

  getItemButtonsHtml(item, reloadCallback) {
    const id = item.id;
    return `
      <button
        onclick="GengActions.generateSingleArticle('${id}', ${reloadCallback ? '() => loadGengContent()' : 'null'})"
        class="px-2 py-1 bg-green-100 text-green-600 text-xs rounded hover:bg-green-200 transition-colors"
      >
        生成文章
      </button>
      <button
        onclick="GengActions.deleteGeng('${id}', ${reloadCallback ? '() => loadGengContent()' : 'null'})"
        class="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 transition-colors"
      >
        删除
      </button>
    `;
  },

  isProcessing: false
};

window.GengActions = GengActions;