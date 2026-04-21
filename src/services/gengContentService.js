const {
  getAllGengContent,
  deleteGengContent,
  clearGengContent,
  getGengCount,
  insertGengContent
} = require('../database/dbManager');

async function getGengContentList() {
  return await getAllGengContent();
}

async function removeGengContent(id) {
  const changes = await deleteGengContent(id);
  if (changes === 0) {
    throw new Error('未找到记录');
  }
  return { message: '删除成功' };
}

async function clearAllGengContent() {
  await clearGengContent();
  return { message: '清空成功' };
}

async function countGengContent() {
  return await getGengCount();
}

async function saveGengContent(workName, cpName, gengText, promptText) {
  return await insertGengContent(workName, cpName, gengText, promptText);
}

module.exports = {
  getGengContentList,
  removeGengContent,
  clearAllGengContent,
  countGengContent,
  saveGengContent
};