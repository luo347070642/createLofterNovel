const { v4: uuidv4 } = require('uuid');

function getShortDateString() {
  const now = new Date();
  const year = String(now.getFullYear()).substring(2); // 取年份后两位
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function generateId(prefix = '') {
  const dateStr = getShortDateString();
  const uuid = uuidv4().replace(/-/g, '').substring(0, 16); // 取uuid前16位
  return `${dateStr}${prefix}${uuid}`;
}

module.exports = {
  generateId
};
