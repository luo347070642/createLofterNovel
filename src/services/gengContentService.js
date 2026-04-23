const {
  getAllGengContent,
  deleteGengContent,
  clearGengContent,
  getGengCount,
  insertGengContent
} = require('../database/dbManager');
const { generateGengContentId } = require('../utils/idGenerator');

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
  const id = await generateGengContentId();
  await insertGengContent(workName, cpName, gengText, promptText, id);
  return id;
}

module.exports = {
  getGengContentList,
  removeGengContent,
  clearAllGengContent,
  countGengContent,
  saveGengContent
};