const {
  getAllArticles,
  deleteArticle,
  updateArticleCopyStatus,
  getArticleCount,
  insertArticle,
  updateGengStatus,
  getArticleById,
  getCompletedGeng,
  getGengById,
  updateArticleContent
} = require('../database/dbManager');

async function getArticleList() {
  return await getAllArticles();
}

async function removeArticle(id) {
  const changes = await deleteArticle(id);
  if (changes === 0) {
    throw new Error('未找到记录');
  }
  return { message: '删除成功' };
}

async function updateCopyStatus(id, type) {
  if (!type) {
    throw new Error('复制类型不能为空');
  }
  const changes = await updateArticleCopyStatus(id, type);
  if (changes === 0) {
    throw new Error('未找到记录');
  }
  return { message: '更新复制状态成功' };
}

async function countArticles() {
  return await getArticleCount();
}

async function saveArticle(workName, cpName, promptText, articleContent) {
  return await insertArticle(workName, cpName, promptText, articleContent);
}

async function markGengCompleted(gengId) {
  return await updateGengStatus(gengId, 'completed');
}

module.exports = {
  getArticleList,
  removeArticle,
  updateCopyStatus,
  countArticles,
  saveArticle,
  markGengCompleted,
  getArticleById,
  getCompletedGeng,
  getGengById,
  updateArticleContent
};