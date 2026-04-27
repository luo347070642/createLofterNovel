const browserController = require('./browserController');
const articleController = require('./articleController');
const { isReady } = require('../browser/browserManager');
const mysqlDb = require('../database/mysqlDb');
const sqliteDb = require('../database/db');
const { getDbType, useDatabase } = require('../database/dbManager');

async function getStatus(req, res) {
  try {
    const currentType = getDbType();
    const includeMysql = req.query.includeMysql === 'true';
    
    useDatabase('sqlite');
    await sqliteDb.initDatabase();
    const sqliteStats = {
      workCpCount: await sqliteDb.getWorkCpCount(),
      gengCount: await sqliteDb.getGengCount(),
      articleCount: await sqliteDb.getArticleCount()
    };
    
    let mysqlStats = null;
    if (includeMysql) {
      useDatabase('mysql');
      await mysqlDb.initDatabase();
      mysqlStats = {
        workCpCount: await mysqlDb.getWorkCpCount(),
        gengCount: await mysqlDb.getGengCount(),
        articleCount: await mysqlDb.getArticleCount()
      };
    }
    
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