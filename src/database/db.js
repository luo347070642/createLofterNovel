const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/data.db');

// 确保data目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  console.log('创建data目录...');
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('data目录创建成功');
}

// 确保db文件存在（sqlite3会自动创建）
let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

async function initDatabase() {
  await openDatabase();
  
  return new Promise((resolve, reject) => {
    const createWorkCpTable = `
      CREATE TABLE IF NOT EXISTS work_cp (
        id TEXT PRIMARY KEY,
        work_name TEXT NOT NULL,
        cp_name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(work_name, cp_name)
      )
    `;

    const createGengTable = `
      CREATE TABLE IF NOT EXISTS geng_content (
        id TEXT PRIMARY KEY,
        work_name TEXT NOT NULL,
        cp_name TEXT NOT NULL,
        geng_text TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createArticleTable = `
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        work_name TEXT NOT NULL,
        cp_name TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        article_content TEXT NOT NULL,
        title_copied INTEGER DEFAULT 0,
        normal_content_copied INTEGER DEFAULT 0,
        pay_content_copied INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(createWorkCpTable, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.run(createGengTable, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.run('PRAGMA table_info(geng_content)', (err, rows) => {
          const columns = [];
          db.all('PRAGMA table_info(geng_content)', (err, cols) => {
            if (cols) {
              cols.forEach(col => columns.push(col.name));
            }
            
            if (!columns.includes('status')) {
              db.run('ALTER TABLE geng_content ADD COLUMN status TEXT DEFAULT "pending"', (err) => {
                if (err) {
                  console.log('添加状态字段失败:', err.message);
                }
                createArticleTableWithCheck();
              });
            } else {
              createArticleTableWithCheck();
            }
          });
        });
      });
    });

    function createArticleTableWithCheck() {
      db.run(createArticleTable, (err) => {
        if (err) {
          console.log('创建 articles 表失败:', err.message);
        }
        
        db.run('PRAGMA table_info(articles)', (err, rows) => {
          const columns = [];
          db.all('PRAGMA table_info(articles)', (err, cols) => {
            if (cols) {
              cols.forEach(col => columns.push(col.name));
            }
            
            if (!columns.includes('title_copied')) {
              db.run('ALTER TABLE articles ADD COLUMN title_copied INTEGER DEFAULT 0');
            }
            if (!columns.includes('normal_content_copied')) {
              db.run('ALTER TABLE articles ADD COLUMN normal_content_copied INTEGER DEFAULT 0');
            }
            if (!columns.includes('pay_content_copied')) {
              db.run('ALTER TABLE articles ADD COLUMN pay_content_copied INTEGER DEFAULT 0');
            }
            
            resolve();
          });
        });
      });
    }
  });
}

async function insertWorkCp(workName, cpName, id = null) {
  return new Promise((resolve, reject) => {
    let stmt;
    if (id !== null) {
      stmt = db.prepare(`
        INSERT INTO work_cp (id, work_name, cp_name)
        VALUES (?, ?, ?)
      `);
    } else {
      stmt = db.prepare(`
        INSERT INTO work_cp (work_name, cp_name)
        VALUES (?, ?)
      `);
    }
    
    const params = id !== null ? [id, workName, cpName] : [workName, cpName];
    stmt.run(params, function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(id !== null ? id : this.lastID);
      }
    });
  });
}

async function getAllWorkCp() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM work_cp ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function deleteWorkCp(id) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM work_cp WHERE id = ?');
    stmt.run([id], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function insertGengContent(workName, cpName, gengText, promptText, id = null) {
  return new Promise((resolve, reject) => {
    let stmt;
    if (id !== null) {
      stmt = db.prepare(`
        INSERT INTO geng_content (id, work_name, cp_name, geng_text, prompt_text)
        VALUES (?, ?, ?, ?, ?)
      `);
    } else {
      stmt = db.prepare(`
        INSERT INTO geng_content (work_name, cp_name, geng_text, prompt_text)
        VALUES (?, ?, ?, ?)
      `);
    }
    
    const params = id !== null ? [id, workName, cpName, gengText, promptText] : [workName, cpName, gengText, promptText];
    stmt.run(params, function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(id !== null ? id : this.lastID);
      }
    });
  });
}

async function getAllGengContent() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM geng_content ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getGengContentByWork(workName, cpName) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM geng_content WHERE work_name = ? AND cp_name = ? ORDER BY created_at DESC', [workName, cpName], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function deleteGengContent(id) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM geng_content WHERE id = ?');
    stmt.run([id], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function clearGengContent() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM geng_content', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function clearArticles() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM articles', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function updateGengStatus(id, status) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('UPDATE geng_content SET status = ? WHERE id = ?');
    stmt.run([status, id], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function updateArticleCopyStatus(id, type) {
  return new Promise((resolve, reject) => {
    let columnName = '';
    switch (type) {
      case 'title':
        columnName = 'title_copied';
        break;
      case 'normalContent':
        columnName = 'normal_content_copied';
        break;
      case 'payContent':
        columnName = 'pay_content_copied';
        break;
      default:
        reject(new Error('Invalid copy type'));
        return;
    }
    
    const stmt = db.prepare(`UPDATE articles SET ${columnName} = 1 WHERE id = ?`);
    stmt.run([id], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function insertArticle(workName, cpName, promptText, articleContent, id = null) {
  return new Promise((resolve, reject) => {
    let stmt;
    if (id !== null) {
      stmt = db.prepare(`
        INSERT INTO articles (id, work_name, cp_name, prompt_text, article_content)
        VALUES (?, ?, ?, ?, ?)
      `);
    } else {
      stmt = db.prepare(`
        INSERT INTO articles (work_name, cp_name, prompt_text, article_content)
        VALUES (?, ?, ?, ?)
      `);
    }
    
    const params = id !== null ? [id, workName, cpName, promptText, articleContent] : [workName, cpName, promptText, articleContent];
    stmt.run(params, function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(id !== null ? id : this.lastID);
      }
    });
  });
}

async function getAllArticles() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, work_name, cp_name, prompt_text, article_content, title_copied, normal_content_copied, pay_content_copied, created_at FROM articles ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getArticlesByWork(workName, cpName) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, work_name, cp_name, prompt_text, article_content, title_copied, normal_content_copied, pay_content_copied, created_at FROM articles WHERE work_name = ? AND cp_name = ? ORDER BY created_at DESC', [workName, cpName], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function deleteArticle(id) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM articles WHERE id = ?');
    stmt.run([id], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function getWorkCpCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM work_cp', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.count : 0);
      }
    });
  });
}

async function getGengCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM geng_content', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.count : 0);
      }
    });
  });
}

async function getArticleCount() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM articles', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.count : 0);
      }
    });
  });
}

async function getArticleById(articleId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM articles WHERE id = ?', [articleId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function getCompletedGeng(workName, cpName) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM geng_content WHERE work_name = ? AND cp_name = ? AND status = ? LIMIT 1', [workName, cpName, 'completed'], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function getGengById(gengId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM geng_content WHERE id = ?', [gengId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

async function updateArticleContent(articleId, content) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('UPDATE articles SET article_content = ?, title_copied = 0, normal_content_copied = 0, pay_content_copied = 0 WHERE id = ?');
    stmt.run([content, articleId], function(err) {
      stmt.finalize();
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

async function getPendingGengContent(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM geng_content WHERE status = ? ORDER BY id ASC LIMIT ?', ['pending', limit], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  openDatabase,
  insertWorkCp,
  getAllWorkCp,
  deleteWorkCp,
  getWorkCpCount,
  insertGengContent,
  getAllGengContent,
  getGengContentByWork,
  deleteGengContent,
  clearGengContent,
  clearArticles,
  getGengCount,
  updateGengStatus,
  getCompletedGeng,
  getGengById,
  getPendingGengContent,
  insertArticle,
  getAllArticles,
  getArticlesByWork,
  deleteArticle,
  updateArticleCopyStatus,
  getArticleCount,
  getArticleById,
  updateArticleContent,
  closeDatabase
};
