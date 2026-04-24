const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
  host: 'sh-cynosdbmysql-grp-ivlm6haw.sql.tencentcdb.com',
  port: 29635,
  user: 'root',
  password: '!Q2w3e4r....',
  database: 'lofter',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;

async function initPool() {
  if (!pool) {
    pool = mysql.createPool(MYSQL_CONFIG);
  }
  return pool;
}

async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}

async function execute(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return result;
  } finally {
    connection.release();
  }
}

async function initDatabase() {
  await initPool();
  
  await execute(`
    CREATE TABLE IF NOT EXISTS work_cp (
      id VARCHAR(32) PRIMARY KEY,
      work_name VARCHAR(255) NOT NULL,
      cp_name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_work_cp (work_name, cp_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS geng_content (
      id VARCHAR(32) PRIMARY KEY,
      work_name VARCHAR(255) NOT NULL,
      cp_name VARCHAR(255) NOT NULL,
      geng_text LONGTEXT NOT NULL,
      prompt_text LONGTEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_geng_work_cp (work_name, cp_name),
      INDEX idx_geng_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS articles (
      id VARCHAR(32) PRIMARY KEY,
      work_name VARCHAR(255) NOT NULL,
      cp_name VARCHAR(255) NOT NULL,
      prompt_text LONGTEXT NOT NULL,
      article_content LONGTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      title_copied TINYINT(1) DEFAULT 0,
      normal_content_copied TINYINT(1) DEFAULT 0,
      pay_content_copied TINYINT(1) DEFAULT 0,
      INDEX idx_articles_work_cp (work_name, cp_name),
      INDEX idx_articles_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function insertWorkCp(workName, cpName, id = null) {
  let result;
  if (id !== null) {
    result = await execute(
      'INSERT INTO work_cp (id, work_name, cp_name) VALUES (?, ?, ?)',
      [id, workName, cpName]
    );
  } else {
    result = await execute(
      'INSERT INTO work_cp (work_name, cp_name) VALUES (?, ?)',
      [workName, cpName]
    );
  }
  return result.insertId;
}

async function getAllWorkCp() {
  return await query('SELECT * FROM work_cp ORDER BY created_at DESC');
}

async function deleteWorkCp(id) {
  const result = await execute('DELETE FROM work_cp WHERE id = ?', [id]);
  return result.affectedRows;
}

async function getWorkCpCount() {
  const rows = await query('SELECT COUNT(*) as count FROM work_cp');
  return rows[0]?.count || 0;
}

async function insertGengContent(workName, cpName, gengText, promptText, id = null) {
  let result;
  if (id !== null) {
    result = await execute(
      'INSERT INTO geng_content (id, work_name, cp_name, geng_text, prompt_text) VALUES (?, ?, ?, ?, ?)',
      [id, workName, cpName, gengText, promptText]
    );
  } else {
    result = await execute(
      'INSERT INTO geng_content (work_name, cp_name, geng_text, prompt_text) VALUES (?, ?, ?, ?)',
      [workName, cpName, gengText, promptText]
    );
  }
  return id !== null ? id : result.insertId;
}

async function getAllGengContent() {
  return await query('SELECT * FROM geng_content ORDER BY created_at DESC');
}

async function getGengContentByWork(workName, cpName) {
  return await query('SELECT * FROM geng_content WHERE work_name = ? AND cp_name = ? ORDER BY created_at DESC', [workName, cpName]);
}

async function deleteGengContent(id) {
  const result = await execute('DELETE FROM geng_content WHERE id = ?', [id]);
  return result.affectedRows;
}

async function clearGengContent() {
  await execute('DELETE FROM geng_content');
}

async function getGengCount() {
  const rows = await query('SELECT COUNT(*) as count FROM geng_content');
  return rows[0]?.count || 0;
}

async function updateGengStatus(id, status) {
  const result = await execute(
    'UPDATE geng_content SET status = ? WHERE id = ?',
    [status, id]
  );
  return result.affectedRows;
}

async function insertArticle(workName, cpName, promptText, articleContent, id = null) {
  let result;
  if (id !== null) {
    result = await execute(
      'INSERT INTO articles (id, work_name, cp_name, prompt_text, article_content) VALUES (?, ?, ?, ?, ?)',
      [id, workName, cpName, promptText, articleContent]
    );
  } else {
    result = await execute(
      'INSERT INTO articles (work_name, cp_name, prompt_text, article_content) VALUES (?, ?, ?, ?)',
      [workName, cpName, promptText, articleContent]
    );
  }
  return id !== null ? id : result.insertId;
}

async function getAllArticles() {
  return await query('SELECT * FROM articles ORDER BY created_at DESC');
}

async function getArticlesByWork(workName, cpName) {
  return await query('SELECT * FROM articles WHERE work_name = ? AND cp_name = ? ORDER BY created_at DESC', [workName, cpName]);
}

async function deleteArticle(id) {
  const result = await execute('DELETE FROM articles WHERE id = ?', [id]);
  return result.affectedRows;
}

async function updateArticleCopyStatus(id, type) {
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
      throw new Error('Invalid copy type');
  }
  
  const result = await execute(
    `UPDATE articles SET ${columnName} = 1 WHERE id = ?`,
    [id]
  );
  return result.affectedRows;
}

async function getArticleCount() {
  const rows = await query('SELECT COUNT(*) as count FROM articles');
  return rows[0]?.count || 0;
}

async function getArticleById(articleId) {
  const rows = await query('SELECT * FROM articles WHERE id = ?', [articleId]);
  return rows[0];
}

async function getCompletedGeng(workName, cpName) {
  const rows = await query(
    'SELECT * FROM geng_content WHERE work_name = ? AND cp_name = ? AND status = ? LIMIT 1',
    [workName, cpName, 'completed']
  );
  return rows[0];
}

async function getGengById(gengId) {
  const rows = await query('SELECT * FROM geng_content WHERE id = ?', [gengId]);
  return rows[0];
}

async function updateArticleContent(articleId, content) {
  const result = await execute(
    'UPDATE articles SET article_content = ?, title_copied = 0, normal_content_copied = 0, pay_content_copied = 0 WHERE id = ?',
    [content, articleId]
  );
  return result.affectedRows;
}

async function getPendingGengContent(limit = 10) {
  return await query(
    'SELECT * FROM geng_content WHERE status = ? ORDER BY id ASC LIMIT ?',
    ['pending', limit]
  );
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initDatabase,
  insertWorkCp,
  getAllWorkCp,
  deleteWorkCp,
  getWorkCpCount,
  insertGengContent,
  getAllGengContent,
  getGengContentByWork,
  deleteGengContent,
  clearGengContent,
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
  close
};