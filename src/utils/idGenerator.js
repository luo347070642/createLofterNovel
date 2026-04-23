const sqliteDb = require('../database/db');
const mysqlDb = require('../database/mysqlDb');

const TABLE_PREFIX = {
  WORK_CP: '01',
  GENG_CONTENT: '02',
  ARTICLES: '03'
};

async function getNextSequence(prefix) {
  let maxSeq = 0;
  
  try {
    let maxWorkCpSeq = await getMaxSequenceFromDb(sqliteDb, 'work_cp', prefix);
    let maxGengSeq = await getMaxSequenceFromDb(sqliteDb, 'geng_content', prefix);
    let maxArticleSeq = await getMaxSequenceFromDb(sqliteDb, 'articles', prefix);
    
    let maxMysqlWorkCpSeq = await getMaxSequenceFromDb(mysqlDb, 'work_cp', prefix);
    let maxMysqlGengSeq = await getMaxSequenceFromDb(mysqlDb, 'geng_content', prefix);
    let maxMysqlArticleSeq = await getMaxSequenceFromDb(mysqlDb, 'articles', prefix);
    
    if (prefix === TABLE_PREFIX.WORK_CP) {
      maxSeq = Math.max(maxWorkCpSeq, maxMysqlWorkCpSeq);
    } else if (prefix === TABLE_PREFIX.GENG_CONTENT) {
      maxSeq = Math.max(maxGengSeq, maxMysqlGengSeq);
    } else if (prefix === TABLE_PREFIX.ARTICLES) {
      maxSeq = Math.max(maxArticleSeq, maxMysqlArticleSeq);
    }
    
    return maxSeq + 1;
  } catch (error) {
    console.log('获取序列失败:', error.message);
    return 1;
  }
}

async function getMaxSequenceFromDb(db, tableName, prefix) {
  try {
    let list = [];
    if (tableName === 'work_cp') {
      list = await db.getAllWorkCp();
    } else if (tableName === 'geng_content') {
      list = await db.getAllGengContent();
    } else if (tableName === 'articles') {
      list = await db.getAllArticles();
    }
    
    if (!list || list.length === 0) {
      return 0;
    }
    
    let maxSeq = 0;
    const today = getTodayString();
    
    for (const item of list) {
      const idStr = String(item.id).trim().replace(/\D/g, '');
      
      if (idStr.length === 15 && idStr.startsWith(today) && idStr.substring(8, 10) === prefix) {
        const seq = parseInt(idStr.substring(10));
        if (seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    return maxSeq;
  } catch (error) {
    return 0;
  }
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function generateWorkCpId() {
  const dateStr = getTodayString();
  const seq = await getNextSequence(TABLE_PREFIX.WORK_CP);
  const seqStr = String(seq).padStart(5, '0');
  const idStr = `${dateStr}${TABLE_PREFIX.WORK_CP}${seqStr}`;
  return idStr;
}

async function generateGengContentId() {
  const dateStr = getTodayString();
  const seq = await getNextSequence(TABLE_PREFIX.GENG_CONTENT);
  const seqStr = String(seq).padStart(5, '0');
  const idStr = `${dateStr}${TABLE_PREFIX.GENG_CONTENT}${seqStr}`;
  return idStr;
}

async function generateArticleId() {
  const dateStr = getTodayString();
  const seq = await getNextSequence(TABLE_PREFIX.ARTICLES);
  const seqStr = String(seq).padStart(5, '0');
  const idStr = `${dateStr}${TABLE_PREFIX.ARTICLES}${seqStr}`;
  return idStr;
}

module.exports = {
  generateWorkCpId,
  generateGengContentId,
  generateArticleId
};
