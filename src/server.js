const express = require('express');
const cors = require('cors');
const path = require('path');

const workCpController = require('./controllers/workCpController');
const gengContentController = require('./controllers/gengContentController');
const articleController = require('./controllers/articleController');
const browserController = require('./controllers/browserController');
const statusController = require('./controllers/statusController');

const { initDatabase, useDatabase, getDbType, close, syncFromMysql, syncToMysql } = require('./database/dbManager');
const { initialize, shutdown } = require('./browser/browserManager');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 作品/CP 路由
app.get('/api/work-cp', workCpController.getAll);
app.post('/api/work-cp', workCpController.create);
app.delete('/api/work-cp/:id', workCpController.remove);

// 梗内容路由
app.get('/api/geng-content', gengContentController.getAll);
app.delete('/api/geng-content/:id', gengContentController.remove);
app.delete('/api/geng-content', gengContentController.clear);

// 文章路由
app.get('/api/articles', articleController.getAll);
app.delete('/api/articles/:id', articleController.remove);
app.post('/api/articles/:id/copy-status', articleController.updateCopyStatus);
app.post('/api/regenerate-article', articleController.regenerate);
app.post('/api/generate-single-article', articleController.generateSingle);

// 浏览器操作路由
app.post('/api/search-geng', browserController.search);
app.post('/api/generate-articles', browserController.generate);

// 状态路由
app.get('/api/status', statusController.getStatus);

// 数据库切换路由
app.post('/api/database/switch', async (req, res) => {
  const { type } = req.body;
  
  if (!type || (type !== 'sqlite' && type !== 'mysql')) {
    return res.json({ success: false, message: '无效的数据库类型，仅支持 sqlite 或 mysql' });
  }

  try {
    useDatabase(type);
    await initDatabase();
    res.json({ success: true, message: `已切换到 ${type} 数据库`, currentType: getDbType() });
  } catch (error) {
    res.json({ success: false, message: `切换数据库失败: ${error.message}` });
  }
});

// 获取当前数据库类型
app.get('/api/database/type', (req, res) => {
  res.json({ success: true, data: getDbType() });
});

// 数据同步路由
app.post('/api/sync/from-mysql', async (req, res) => {
  try {
    const result = await syncFromMysql();
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post('/api/sync/to-mysql', async (req, res) => {
  try {
    const result = await syncToMysql();
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// MySQL 状态路由
app.get('/api/mysql/status', async (req, res) => {
  try {
    const currentType = getDbType();
    useDatabase('mysql');
    await initDatabase();
    
    const workCpCount = await mysqlDb.getWorkCpCount();
    const gengCount = await mysqlDb.getGengCount();
    const articleCount = await mysqlDb.getArticleCount();
    
    useDatabase(currentType);
    
    res.json({ 
      success: true, 
      data: {
        workCpCount,
        gengCount,
        articleCount
      }
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

async function startServer() {
  // 默认使用 SQLite 作为主力数据库
  useDatabase('sqlite');
  await initDatabase();
  console.log(`数据库初始化完成，当前使用: ${getDbType()}`);

  return new Promise((resolve, reject) => {
    app.listen(PORT, async () => {
      console.log(`服务器已启动，访问 http://localhost:${PORT}`);
      try {
        if (!process.env.TAURI) {
          await initialize();
        }
        resolve();
      } catch (error) {
        console.error('浏览器初始化失败:', error.message);
        resolve();
      }
    });
  });
}

process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await close();
  await shutdown();
  process.exit(0);
});

startServer().catch(async (error) => {
  console.error('启动服务器失败:', error);
  await close();
  await shutdown();
  process.exit(1);
});