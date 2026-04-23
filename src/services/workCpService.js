const {
  insertWorkCp,
  getAllWorkCp,
  deleteWorkCp,
  getWorkCpCount
} = require('../database/dbManager');
const { generateWorkCpId } = require('../utils/idGenerator');

async function addWorkCp(workName, cpName) {
  if (!workName || !cpName) {
    throw new Error('作品名和CP名不能为空');
  }
  const id = await generateWorkCpId();
  await insertWorkCp(workName, cpName, id);
  return { id, message: '添加成功' };
}

async function getWorkCpList() {
  return await getAllWorkCp();
}

async function removeWorkCp(id) {
  const changes = await deleteWorkCp(id);
  if (changes === 0) {
    throw new Error('未找到记录');
  }
  return { message: '删除成功' };
}

async function countWorkCp() {
  return await getWorkCpCount();
}

module.exports = {
  addWorkCp,
  getWorkCpList,
  removeWorkCp,
  countWorkCp
};