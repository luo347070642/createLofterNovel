const { searchGeng } = require('../browser/kimi');
const { generateArticles } = require('../browser/doubao');

let isProcessing = false;

async function search(req, res) {
  const { workName, cpName } = req.body;

  if (!workName || !cpName) {
    return res.json({ success: false, message: '作品名和CP名不能为空' });
  }

  if (isProcessing) {
    return res.json({ success: false, message: '正在处理中，请稍后' });
  }

  isProcessing = true;

  try {
    const count = await searchGeng(workName, cpName);
    res.json({ success: true, count, message: `成功获取 ${count} 条梗` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  } finally {
    isProcessing = false;
  }
}

async function generate(req, res) {
  if (isProcessing) {
    return res.json({ success: false, message: '正在处理中，请稍后' });
  }

  const { workCpFilter, statusFilter } = req.body;

  isProcessing = true;

  try {
    const count = await generateArticles(workCpFilter, statusFilter);
    res.json({ success: true, count, message: `成功生成 ${count} 篇文章` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  } finally {
    isProcessing = false;
  }
}

function getProcessingStatus() {
  return isProcessing;
}

module.exports = {
  search,
  generate,
  getProcessingStatus
};