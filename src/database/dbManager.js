const { generateId } = require('../utils/idGenerator');

let currentDb = null;
let dbType = 'sqlite';

const sqliteDb = require('./db');
const mysqlDb = require('./mysqlDb');

function useDatabase(type) {
  if (type !== 'sqlite' && type !== 'mysql') {
    throw new Error('Unsupported database type: ' + type);
  }
  dbType = type;
  currentDb = type === 'sqlite' ? sqliteDb : mysqlDb;
}

function getCurrentDb() {
  if (!currentDb) {
    currentDb = mysqlDb;
  }
  return currentDb;
}

function getDbType() {
  return dbType;
}

async function initDatabase() {
  return await getCurrentDb().initDatabase();
}

async function insertWorkCp(workName, cpName, id = null) {
  return await getCurrentDb().insertWorkCp(workName, cpName, id);
}

async function getAllWorkCp() {
  return await getCurrentDb().getAllWorkCp();
}

async function deleteWorkCp(id) {
  return await getCurrentDb().deleteWorkCp(id);
}

async function getWorkCpCount() {
  return await getCurrentDb().getWorkCpCount();
}

async function insertGengContent(workName, cpName, gengText, promptText, id = null) {
  if (id === null) {
    id = generateId();
  }
  return await getCurrentDb().insertGengContent(workName, cpName, gengText, promptText, id);
}

async function getAllGengContent() {
  return await getCurrentDb().getAllGengContent();
}

async function deleteGengContent(id) {
  return await getCurrentDb().deleteGengContent(id);
}

async function clearGengContent() {
  return await getCurrentDb().clearGengContent();
}

async function getGengCount() {
  return await getCurrentDb().getGengCount();
}

async function updateGengStatus(id, status) {
  return await getCurrentDb().updateGengStatus(id, status);
}

async function insertArticle(workName, cpName, promptText, articleContent, id = null) {
  if (id === null) {
    id = generateId();
  }
  return await getCurrentDb().insertArticle(workName, cpName, promptText, articleContent, id);
}

async function getAllArticles() {
  return await getCurrentDb().getAllArticles();
}

async function deleteArticle(id) {
  return await getCurrentDb().deleteArticle(id);
}

async function updateArticleCopyStatus(id, type) {
  return await getCurrentDb().updateArticleCopyStatus(id, type);
}

async function getArticleCount() {
  return await getCurrentDb().getArticleCount();
}

async function getArticleById(articleId) {
  return await getCurrentDb().getArticleById(articleId);
}

async function getCompletedGeng(workName, cpName) {
  return await getCurrentDb().getCompletedGeng(workName, cpName);
}

async function getGengById(gengId) {
  return await getCurrentDb().getGengById(gengId);
}

async function updateArticleContent(articleId, content) {
  return await getCurrentDb().updateArticleContent(articleId, content);
}

async function getPendingGengContent(limit) {
  const db = getCurrentDb();
  if (typeof db.getPendingGengContent === 'function') {
    return await db.getPendingGengContent(limit);
  }
  const all = await getAllGengContent();
  return all.filter(g => g.status === 'pending').slice(0, limit);
}

async function close() {
  const db = getCurrentDb();
  if (typeof db.close === 'function') {
    await db.close();
  }
}

function getWorkCpKey(workName, cpName) {
  return `${workName}_${cpName}`;
}

// 数据同步功能
async function syncFromMysql() {
  console.log('开始从 MySQL 同步数据到 SQLite...');
  
  try {
    // 保存当前数据库类型
    const currentType = getDbType();
    
    // 确保两个数据库都已初始化
    useDatabase('mysql');
    await initDatabase();
    
    useDatabase('sqlite');
    await initDatabase();
    
    // 同步 work_cp 表
    const mysqlWorkCp = await mysqlDb.getAllWorkCp();
    const sqliteWorkCp = await sqliteDb.getAllWorkCp();
    console.log(`从 MySQL 获取到 ${mysqlWorkCp.length} 个 work_cp 记录`);
    console.log(`从 SQLite 获取到 ${sqliteWorkCp.length} 个 work_cp 记录`);
    
    // 创建映射：使用ID作为键
    const mysqlWorkCpMap = new Map();
    const sqliteWorkCpMap = new Map();
    
    for (const item of mysqlWorkCp) {
      mysqlWorkCpMap.set(item.id, item);
    }
    
    for (const item of sqliteWorkCp) {
      sqliteWorkCpMap.set(item.id, item);
    }
    
    // 同步 work_cp
    let workCpAdded = 0;
    let workCpUpdated = 0;
    let workCpDeleted = 0;
    
    // 新增或更新：使用MySQL的数据为准
    for (const [id, item] of mysqlWorkCpMap) {
      if (!sqliteWorkCpMap.has(id)) {
        try {
          await sqliteDb.insertWorkCp(item.work_name, item.cp_name, item.id);
          workCpAdded++;
        } catch (error) {
          console.log('插入 work_cp 到 SQLite 时出错:', error.message);
        }
      }
    }
    
    // 删除：SQLite中有但MySQL中没有的记录
    for (const [id, item] of sqliteWorkCpMap) {
      if (!mysqlWorkCpMap.has(id)) {
        try {
          await sqliteDb.deleteWorkCp(item.id);
          workCpDeleted++;
        } catch (error) {
          console.log('删除 work_cp 时出错:', error.message);
        }
      }
    }
    
    // 同步 geng_content 表
    const mysqlGengContent = await mysqlDb.getAllGengContent();
    const sqliteGengContent = await sqliteDb.getAllGengContent();
    console.log(`从 MySQL 获取到 ${mysqlGengContent.length} 个 geng_content 记录`);
    console.log(`从 SQLite 获取到 ${sqliteGengContent.length} 个 geng_content 记录`);
    
    // 创建映射
    const mysqlGengContentMap = new Map();
    const sqliteGengContentMap = new Map();
    
    for (const item of mysqlGengContent) {
      mysqlGengContentMap.set(item.id, item);
    }
    
    for (const item of sqliteGengContent) {
      sqliteGengContentMap.set(item.id, item);
    }
    
    // 同步 geng_content
    let gengContentAdded = 0;
    let gengContentUpdated = 0;
    let gengContentDeleted = 0;
    
    // 新增或更新
    for (const [id, item] of mysqlGengContentMap) {
      if (!sqliteGengContentMap.has(id)) {
        try {
          await sqliteDb.insertGengContent(item.work_name, item.cp_name, item.geng_text, item.prompt_text, item.id);
          if (item.status) {
            await sqliteDb.updateGengStatus(item.id, item.status);
          }
          gengContentAdded++;
        } catch (error) {
          console.log('插入 geng_content 到 SQLite 时出错:', error.message);
        }
      } else {
        // 检查是否需要更新
        const existingItem = sqliteGengContentMap.get(id);
        if (existingItem.status !== item.status) {
          try {
            await sqliteDb.updateGengStatus(id, item.status);
            gengContentUpdated++;
          } catch (error) {
            console.log('更新 geng_content 状态时出错:', error.message);
          }
        }
      }
    }
    
    // 删除
    for (const [id, item] of sqliteGengContentMap) {
      if (!mysqlGengContentMap.has(id)) {
        try {
          await sqliteDb.deleteGengContent(id);
          gengContentDeleted++;
        } catch (error) {
          console.log('删除 geng_content 时出错:', error.message);
        }
      }
    }
    
    // 同步 articles 表
    const mysqlArticles = await mysqlDb.getAllArticles();
    const sqliteArticles = await sqliteDb.getAllArticles();
    console.log(`从 MySQL 获取到 ${mysqlArticles.length} 个 articles 记录`);
    console.log(`从 SQLite 获取到 ${sqliteArticles.length} 个 articles 记录`);
    
    // 创建映射
    const mysqlArticlesMap = new Map();
    const sqliteArticlesMap = new Map();
    
    for (const item of mysqlArticles) {
      mysqlArticlesMap.set(item.id, item);
    }
    
    for (const item of sqliteArticles) {
      sqliteArticlesMap.set(item.id, item);
    }
    
    // 同步 articles
    let articlesAdded = 0;
    let articlesUpdated = 0;
    let articlesDeleted = 0;
    
    // 新增或更新
    for (const [id, item] of mysqlArticlesMap) {
      if (!sqliteArticlesMap.has(id)) {
        try {
          await sqliteDb.insertArticle(item.work_name, item.cp_name, item.prompt_text, item.article_content, item.id);
          // 更新复制状态
          if (item.title_copied) {
            await sqliteDb.updateArticleCopyStatus(item.id, 'title');
          }
          if (item.normal_content_copied) {
            await sqliteDb.updateArticleCopyStatus(item.id, 'normalContent');
          }
          if (item.pay_content_copied) {
            await sqliteDb.updateArticleCopyStatus(item.id, 'payContent');
          }
          articlesAdded++;
        } catch (error) {
          console.log('插入 articles 到 SQLite 时出错:', error.message);
        }
      } else {
        // 检查是否需要更新
        const existingItem = sqliteArticlesMap.get(id);
        let updated = false;
        
        if (existingItem.title_copied !== item.title_copied) {
          try {
            await sqliteDb.updateArticleCopyStatus(id, 'title');
            updated = true;
          } catch (error) {
            console.log('更新 articles title 状态时出错:', error.message);
          }
        }
        if (existingItem.normal_content_copied !== item.normal_content_copied) {
          try {
            await sqliteDb.updateArticleCopyStatus(id, 'normalContent');
            updated = true;
          } catch (error) {
            console.log('更新 articles normalContent 状态时出错:', error.message);
          }
        }
        if (existingItem.pay_content_copied !== item.pay_content_copied) {
          try {
            await sqliteDb.updateArticleCopyStatus(id, 'payContent');
            updated = true;
          } catch (error) {
            console.log('更新 articles payContent 状态时出错:', error.message);
          }
        }
        
        if (updated) {
          articlesUpdated++;
        }
      }
    }
    
    // 删除
    for (const [id, item] of sqliteArticlesMap) {
      if (!mysqlArticlesMap.has(id)) {
        try {
          await sqliteDb.deleteArticle(id);
          articlesDeleted++;
        } catch (error) {
          console.log('删除 articles 时出错:', error.message);
        }
      }
    }
    
    // 恢复原来的数据库类型
    useDatabase(currentType);
    
    console.log('从 MySQL 同步数据到 SQLite 完成');
    return { 
      success: true, 
      message: '数据同步成功',
      stats: {
        workCpAdded,
        workCpUpdated,
        workCpDeleted,
        gengContentAdded,
        gengContentUpdated,
        gengContentDeleted,
        articlesAdded,
        articlesUpdated,
        articlesDeleted
      }
    };
  } catch (error) {
    console.error('同步数据时出错:', error.message);
    return { success: false, message: error.message };
  }
}

async function syncToMysql() {
  console.log('开始从 SQLite 同步数据到 MySQL...');
  
  try {
    // 保存当前数据库类型
    const currentType = getDbType();
    
    // 确保两个数据库都已初始化
    useDatabase('sqlite');
    await initDatabase();
    
    useDatabase('mysql');
    await initDatabase();
    
    // 同步 work_cp 表
    const sqliteWorkCp = await sqliteDb.getAllWorkCp();
    const mysqlWorkCp = await mysqlDb.getAllWorkCp();
    console.log(`从 SQLite 获取到 ${sqliteWorkCp.length} 个 work_cp 记录`);
    console.log(`从 MySQL 获取到 ${mysqlWorkCp.length} 个 work_cp 记录`);
    
    // 创建映射：使用ID作为键
    const sqliteWorkCpMap = new Map();
    const mysqlWorkCpMap = new Map();
    
    for (const item of sqliteWorkCp) {
      sqliteWorkCpMap.set(item.id, item);
    }
    
    for (const item of mysqlWorkCp) {
      mysqlWorkCpMap.set(item.id, item);
    }
    
    // 同步 work_cp
    let workCpAdded = 0;
    let workCpUpdated = 0;
    let workCpDeleted = 0;
    
    // 新增：使用SQLite的ID保持一致
    for (const [id, item] of sqliteWorkCpMap) {
      if (!mysqlWorkCpMap.has(id)) {
        try {
          await mysqlDb.insertWorkCp(item.work_name, item.cp_name, item.id);
          workCpAdded++;
        } catch (error) {
          console.log('插入 work_cp 到 MySQL 时出错:', error.message);
        }
      }
    }
    
    // 删除：MySQL中有但SQLite中没有的记录
    for (const [id, item] of mysqlWorkCpMap) {
      if (!sqliteWorkCpMap.has(id)) {
        try {
          await mysqlDb.deleteWorkCp(item.id);
          workCpDeleted++;
        } catch (error) {
          console.log('删除 work_cp 时出错:', error.message);
        }
      }
    }
    
    // 同步 geng_content 表
    const sqliteGengContent = await sqliteDb.getAllGengContent();
    const mysqlGengContent = await mysqlDb.getAllGengContent();
    console.log(`从 SQLite 获取到 ${sqliteGengContent.length} 个 geng_content 记录`);
    console.log(`从 MySQL 获取到 ${mysqlGengContent.length} 个 geng_content 记录`);
    
    // 创建映射
    const sqliteGengContentMap = new Map();
    const mysqlGengContentMap = new Map();
    
    for (const item of sqliteGengContent) {
      sqliteGengContentMap.set(item.id, item);
    }
    
    for (const item of mysqlGengContent) {
      mysqlGengContentMap.set(item.id, item);
    }
    
    // 同步 geng_content
    let gengContentAdded = 0;
    let gengContentUpdated = 0;
    let gengContentDeleted = 0;
    
    // 新增或更新
    for (const [id, item] of sqliteGengContentMap) {
      if (!mysqlGengContentMap.has(id)) {
        try {
          await mysqlDb.insertGengContent(item.work_name, item.cp_name, item.geng_text, item.prompt_text, item.id);
          if (item.status) {
            await mysqlDb.updateGengStatus(item.id, item.status);
          }
          gengContentAdded++;
        } catch (error) {
          console.log('插入 geng_content 到 MySQL 时出错:', error.message);
        }
      } else {
        // 检查是否需要更新
        const existingItem = mysqlGengContentMap.get(id);
        if (existingItem.status !== item.status) {
          try {
            await mysqlDb.updateGengStatus(id, item.status);
            gengContentUpdated++;
          } catch (error) {
            console.log('更新 geng_content 状态时出错:', error.message);
          }
        }
      }
    }
    
    // 删除
    for (const [id, item] of mysqlGengContentMap) {
      if (!sqliteGengContentMap.has(id)) {
        try {
          await mysqlDb.deleteGengContent(id);
          gengContentDeleted++;
        } catch (error) {
          console.log('删除 geng_content 时出错:', error.message);
        }
      }
    }
    
    // 同步 articles 表
    const sqliteArticles = await sqliteDb.getAllArticles();
    const mysqlArticles = await mysqlDb.getAllArticles();
    console.log(`从 SQLite 获取到 ${sqliteArticles.length} 个 articles 记录`);
    console.log(`从 MySQL 获取到 ${mysqlArticles.length} 个 articles 记录`);
    
    // 创建映射
    const sqliteArticlesMap = new Map();
    const mysqlArticlesMap = new Map();
    
    for (const item of sqliteArticles) {
      sqliteArticlesMap.set(item.id, item);
    }
    
    for (const item of mysqlArticles) {
      mysqlArticlesMap.set(item.id, item);
    }
    
    // 同步 articles
    let articlesAdded = 0;
    let articlesUpdated = 0;
    let articlesDeleted = 0;
    
    // 新增或更新
    for (const [id, item] of sqliteArticlesMap) {
      if (!mysqlArticlesMap.has(id)) {
        try {
          await mysqlDb.insertArticle(item.work_name, item.cp_name, item.prompt_text, item.article_content, item.id);
          // 更新复制状态
          if (item.title_copied) {
            await mysqlDb.updateArticleCopyStatus(item.id, 'title');
          }
          if (item.normal_content_copied) {
            await mysqlDb.updateArticleCopyStatus(item.id, 'normalContent');
          }
          if (item.pay_content_copied) {
            await mysqlDb.updateArticleCopyStatus(item.id, 'payContent');
          }
          articlesAdded++;
        } catch (error) {
          console.log('插入 articles 到 MySQL 时出错:', error.message);
        }
      } else {
        // 检查是否需要更新
        const existingItem = mysqlArticlesMap.get(id);
        let updated = false;
        
        if (existingItem.title_copied !== item.title_copied) {
          try {
            await mysqlDb.updateArticleCopyStatus(id, 'title');
            updated = true;
          } catch (error) {
            console.log('更新 articles title 状态时出错:', error.message);
          }
        }
        if (existingItem.normal_content_copied !== item.normal_content_copied) {
          try {
            await mysqlDb.updateArticleCopyStatus(id, 'normalContent');
            updated = true;
          } catch (error) {
            console.log('更新 articles normalContent 状态时出错:', error.message);
          }
        }
        if (existingItem.pay_content_copied !== item.pay_content_copied) {
          try {
            await mysqlDb.updateArticleCopyStatus(id, 'payContent');
            updated = true;
          } catch (error) {
            console.log('更新 articles payContent 状态时出错:', error.message);
          }
        }
        
        if (updated) {
          articlesUpdated++;
        }
      }
    }
    
    // 删除
    for (const [id, item] of mysqlArticlesMap) {
      if (!sqliteArticlesMap.has(id)) {
        try {
          await mysqlDb.deleteArticle(id);
          articlesDeleted++;
        } catch (error) {
          console.log('删除 articles 时出错:', error.message);
        }
      }
    }
    
    // 恢复原来的数据库类型
    useDatabase(currentType);
    
    console.log('从 SQLite 同步数据到 MySQL 完成');
    return { 
      success: true, 
      message: '数据同步成功',
      stats: {
        workCpAdded,
        workCpUpdated,
        workCpDeleted,
        gengContentAdded,
        gengContentUpdated,
        gengContentDeleted,
        articlesAdded,
        articlesUpdated,
        articlesDeleted
      }
    };
  } catch (error) {
    console.error('同步数据时出错:', error.message);
    return { success: false, message: error.message };
  }
}

module.exports = {
  useDatabase,
  getCurrentDb,
  getDbType,
  initDatabase,
  insertWorkCp,
  getAllWorkCp,
  deleteWorkCp,
  getWorkCpCount,
  insertGengContent,
  getAllGengContent,
  deleteGengContent,
  clearGengContent,
  getGengCount,
  updateGengStatus,
  insertArticle,
  getAllArticles,
  deleteArticle,
  updateArticleCopyStatus,
  getArticleCount,
  getArticleById,
  getCompletedGeng,
  getGengById,
  updateArticleContent,
  getPendingGengContent,
  close,
  syncFromMysql,
  syncToMysql
};