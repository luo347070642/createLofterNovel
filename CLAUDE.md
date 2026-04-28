# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

自动化搜梗+生文工具 — 一个桌面端 Node.js 应用，通过 Playwright 自动化操作 Kimi（搜梗）和豆包/Doubao（生文），将结果持久化到本地 SQLite 数据库（主库）和远程 MySQL（同步备库）。前端是纯静态 HTML + Tailwind CSS，没有使用框架。

## 常用命令

```bash
# 启动（需在中文 Windows 环境下，chcp 65001 设置 UTF-8）
npm start

# 构建 Tailwind CSS（开发时，修改 style.css 后）
npm run build:css

# 构建并 watch CSS
npm run watch:css

# 安装 Edge 浏览器驱动（Playwright）
npm run install:browser
```

`npm start` 等价于 `chcp 65001 && node index.js`，其中 `index.js` 仅设置 stdout/stderr 编码后 `require('./src/server')`。服务器监听 **port 3000**，启动时自动初始化 SQLite 数据库，并启动 Playwright 管理的 Edge 浏览器窗口导航到 `http://localhost:3000`。

没有测试命令，没有 linter，没有 TypeScript。

## 架构分层

```
public/              # 静态前端（4 个 HTML 页面 + 对应的 JS）
src/
  server.js          # Express 启动、路由注册、启动流程
  controllers/       # HTTP 层：解析 req，调用 service，返回 res
  services/          # 业务逻辑层：校验 + 调用 dbManager
  database/
    dbManager.js     # 门面层：根据当前 dbType 路由到 sqlite 或 mysql 实现
    db.js            # SQLite 实现（sqlite3 原生回调式 API）
    mysqlDb.js       # MySQL 实现（mysql2/promise）
  browser/
    browserManager.js # Playwright 浏览器生命周期（启动/关闭/建页）
    kimi.js          # 搜梗：打开 Kimi，发送提示词，等待输出，分割存入数据库
    doubao.js        # 生文：打开豆包，发送提示词，等待文章生成，验证+提取
  utils/
    index.js         # 浏览器操作共用工具（输入框操作、发送、验证码检测）
    idGenerator.js   # ID 生成（日期前缀 + UUID 前 16 位）
```

**数据流**: `Browser Action → Controller → Service → dbManager → db.js或mysqlDb.js`

## 数据库设计

三张表，SQLite 和 MySQL 结构一致：

- **work_cp**: `id`, `work_name`, `cp_name`, `created_at` — UNIQUE(work_name, cp_name)
- **geng_content**: `id`, `work_name`, `cp_name`, `geng_text`, `prompt_text`, `status` (pending/completed), `created_at`
- **articles**: `id`, `work_name`, `cp_name`, `prompt_text`, `article_content`, `title_copied`, `normal_content_copied`, `pay_content_copied`, `created_at`

`dbManager.js` 是核心抽象层，导出一组函数（`insertWorkCp`, `getAllWorkCp`, 等），内部根据 `useDatabase('sqlite'|'mysql')` 切换到对应实现。所有上层代码通过 `dbManager` 访问数据，不直接引用 `db.js` 或 `mysqlDb.js`（唯一例外是 `statusController.js` 和 `server.js` 中的同步/切换路由）。

## 核心业务流程

1. **添加作品/CP**: 用户在首页输入作品名和 CP 名 → `POST /api/work-cp` → 存入 `work_cp` 表
2. **搜梗**: `POST /api/search-geng` → `browserController.search` → `kimi.js` → 打开 kimi.com，用 `Tips/搜梗提示词.txt` 模板替换 `{作品名称}` 和 `{CP名称}` 后填入 → 等待 Kimi 回复 → 按 `【第N组】` 分割内容为多条梗 → 每条梗用 `Tips/生文提示词.txt` 模板生成完整 prompt → 存入 `geng_content` 表（status=pending）
3. **生文**: `POST /api/generate-articles` → `browserController.generate` → `doubao.js` → 读取 pending 状态的梗 → 循环处理每条：打开豆包 chat，填入 prompt_text，等待文章生成 → 通过复制按钮获取内容 → 验证包含【付费卡点】标记 → 存入 `articles` 表，标记对应 geng 为 completed
4. **管理**: 四个页面（首页/梗列表/文章列表/作品CP列表），支持查看、删除、标记复制状态、重新生成、单条生成

## 浏览器自动化关键点

- Playwright 使用 **persistent context**（`launchPersistentContext`）而不是普通 browser launch，以保持登录态
- 浏览器 channel 固定为 `msedge`（Microsoft Edge）
- `browserManager.js` 管理全局单例 browser/context，启动时杀已有 Edge 进程再重启
- 豆包页面使用独立的持久化 page（`doubaoPage`），整个生文循环复用同一个 page
- Kimi 搜梗每次创建新 page（`newPage()`）
- 验证码检测通过 `checkAndHandleCaptcha` → 检测到验证码时阻塞等待用户在浏览器中手动完成并按 Enter
- `src/utils/index.js` 中的 `waitForInputAndFill` 和 `sendMessage` 是 Kimi 和豆包共用的输入/发送工具

## 前端页面

| 文件 | 路由 | 用途 |
|------|------|------|
| `public/index.html` | `/` | 首页：添加作品CP + 搜梗/生文/一键操作 |
| `public/geng-list.html` | 无路由（由 index 打开子窗口） | 梗内容列表 |
| `public/article-list.html` | 无路由（由 index 打开子窗口） | 文章列表 |
| `public/work-cp-list.html` | 无路由（由 index 打开子窗口） | 作品/CP 列表 |

CSS 使用 Tailwind v3，源文件 `public/css/style.css` → 编译输出 `public/css/output.css`。

## 安全隐患

`src/database/mysqlDb.js` 包含硬编码的腾讯云 MySQL 数据库凭据（host/password）。不应将其提交到公开仓库，.gitignore 中已有 `.env` 规则但这并非通过环境变量管理。

## 环境兼容性

- 仅支持 Windows（`start.bat` 使用盘符切换，`chcp 65001` 设置终端编码，`taskkill` 杀 Edge 进程）
- `browserManager.js` 使用 `os.tmpdir()` 存放 Edge 用户数据目录，路径使用 `path.join`
- `node_modules` 中的 native addon（sqlite3）需匹配 Windows 平台
