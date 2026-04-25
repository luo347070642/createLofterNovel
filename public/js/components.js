// 通用组件库

/**
 * 显示基于Promise的确认对话框
 * @param {string} message - 确认消息
 * @returns {Promise<boolean>} - 用户是否确认
 */
function showCustomConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">确认</h3>
          <p class="text-gray-700 mb-6">${message}</p>
          <div class="flex justify-end gap-3">
            <button data-action="cancel" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              取消
            </button>
            <button data-action="confirm" class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors">
              确定
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');

    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });

    confirmBtn.addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });
  });
}

/**
 * 显示回调式确认对话框
 * @param {string} message - 确认消息
 * @param {function} onConfirm - 确认回调
 * @param {function} onCancel - 取消回调
 */
function showConfirm(message, onConfirm, onCancel) {
  // 创建确认对话框
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  confirmDialog.innerHTML = `
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
      <div class="text-lg font-medium text-gray-900 mb-4">确认操作</div>
      <div class="text-gray-600 mb-6">${message}</div>
      <div class="flex justify-end gap-3">
        <button id="confirmCancel" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors">取消</button>
        <button id="confirmOk" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">确认</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmDialog);
  
  // 绑定事件
  const cancelBtn = confirmDialog.querySelector('#confirmCancel');
  const okBtn = confirmDialog.querySelector('#confirmOk');
  
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(confirmDialog);
    if (onCancel) onCancel();
  });
  
  okBtn.addEventListener('click', () => {
    document.body.removeChild(confirmDialog);
    if (onConfirm) onConfirm();
  });
  
  // 点击背景关闭
  confirmDialog.addEventListener('click', (e) => {
    if (e.target === confirmDialog) {
      document.body.removeChild(confirmDialog);
      if (onCancel) onCancel();
    }
  });
}

/**
 * 显示通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型：success, error, info
 */
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-y-0 opacity-100 ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    type === 'info' ? 'bg-blue-500 text-white' :
    'bg-gray-500 text-white'
  }`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('translate-y-[-20px]', 'opacity-0');
  }, 3000);

  setTimeout(() => {
    if (notification.parentNode) {
      document.body.removeChild(notification);
    }
  }, 3500);
}

/**
 * 关闭模态框
 * @param {string} modalId - 模态框ID
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 导出组件
if (typeof window !== 'undefined') {
  window.showCustomConfirm = showCustomConfirm;
  window.showConfirm = showConfirm;
  window.showNotification = showNotification;
  window.closeModal = closeModal;
}

// 模块化导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showCustomConfirm,
    showConfirm,
    showNotification,
    closeModal
  };
}
