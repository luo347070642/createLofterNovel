const articleService = require('../services/articleService');
const { generateArticle } = require('../browser/doubao');

let isProcessing = false;

async function getAll(req, res) {
  try {
    const data = await articleService.getArticleList();
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const result = await articleService.removeArticle(id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function updateCopyStatus(req, res) {
  const { id } = req.params;
  const { type } = req.body;
  try {
    const result = await articleService.updateCopyStatus(id, type);
    res.json({ success: true, ...result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

async function regenerate(req, res) {
  if (isProcessing) {
    return res.json({ success: false, message: '系统正在处理中，请稍后再试' });
  }

  const { articleId } = req.body;

  if (!articleId) {
    return res.json({ success: false, message: '缺少文章ID' });
  }

  try {
    isProcessing = true;
    console.log(`开始重新生成文章，ID: ${articleId}`);

    const article = await articleService.getArticleById(articleId);
    const geng = await articleService.getCompletedGeng(article.work_name, article.cp_name);
    const newContent = await generateArticle(geng);
    await articleService.updateArticleContent(articleId, newContent);

    console.log(`文章重新生成成功，ID: ${articleId}`);
    res.json({ success: true, message: '文章重新生成成功' });
  } catch (error) {
    console.error('重新生成文章失败:', error);
    res.json({ success: false, message: error.message });
  } finally {
    isProcessing = false;
  }
}

async function generateSingle(req, res) {
  if (isProcessing) {
    return res.json({ success: false, message: '正在处理中，请稍后' });
  }

  const { gengId } = req.body;

  if (!gengId) {
    return res.json({ success: false, message: '缺少梗ID' });
  }

  try {
    isProcessing = true;
    console.log(`开始生成单篇文章，梗ID: ${gengId}`);

    const geng = await articleService.getGengById(gengId);
    const articleContent = await generateArticle(geng);
    await articleService.saveArticle(geng.work_name, geng.cp_name, geng.prompt_text, articleContent);
    await articleService.markGengCompleted(gengId);

    console.log(`单篇文章生成成功，梗ID: ${gengId}`);
    res.json({ success: true, message: '文章生成成功' });
  } catch (error) {
    console.error('生成单篇文章失败:', error);
    res.json({ success: false, message: error.message });
  } finally {
    isProcessing = false;
  }
}

function getProcessingStatus() {
  return isProcessing;
}

function setProcessingStatus(status) {
  isProcessing = status;
}

module.exports = {
  getAll,
  remove,
  updateCopyStatus,
  regenerate,
  generateSingle,
  getProcessingStatus,
  setProcessingStatus
};