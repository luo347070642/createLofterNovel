const workCpService = require('../services/workCpService');
const gengContentService = require('../services/gengContentService');
const articleService = require('../services/articleService');
const browserController = require('./browserController');
const articleController = require('./articleController');
const { isReady } = require('../browser/browserManager');
const mysqlDb = require('../database/mysqlDb');
const sqliteDb = require('../database/db');
const { getDbType, useDatabase } = require('../database/dbManager');

async function getStatus(req, res) {
  try {
    const currentType = getDbType();
    
    const [sqliteStats, mysqlStats] = await Promise.all([
      (async () => {
        useDatabase('sqlite');
        await sqliteDb.initDatabase();
        return {
          workCpCount: await sqliteDb.getWorkCpCount(),
          gengCount: await sqliteDb.getGengCount(),
          articleCount: await sqliteDb.getArticleCount()
        };
      })(),
      (async () => {
        useDatabase('mysql');
        await mysqlDb.initDatabase();
        return {
          workCpCount: await mysqlDb.getWorkCpCount(),
          gengCount: await mysqlDb.getGengCount(),
          articleCount: await mysqlDb.getArticleCount()
        };
      })()
    ]);
    
    useDatabase(currentType);
    
    const browserProcessing = browserController.getProcessingStatus();
    const articleProcessing = articleController.getProcessingStatus();
    
    res.json({
      success: true,
      data: {
        sqlite: sqliteStats,
        mysql: mysqlStats,
        isProcessing: browserProcessing || articleProcessing,
        browserReady: isReady()
      }
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

module.exports = {
  getStatus
};