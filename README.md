# Lofter 小说生成工具

一个用于生成 Lofter 小说内容的工具，支持梗内容搜索、文章生成和数据同步功能。

## 功能特性

- **作品/CP 管理**：管理作品和 CP 配对信息
- **梗内容搜索**：自动搜索指定作品/CP 的梗内容
- **文章生成**：基于梗内容自动生成小说文章
- **数据同步**：支持本地 SQLite 和云端 MySQL 数据库同步
- **文章管理**：查看、复制和管理生成的文章

## 技术栈

- **前端**：HTML5 + Tailwind CSS + JavaScript
- **后端**：Node.js + Express
- **数据库**：SQLite（本地）+ MySQL（云端）
- **浏览器自动化**：Playwright

## 安装与运行

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env` 文件：

```env
# MySQL 数据库配置（可选）
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=lofter
```

### 启动服务

```bash
npm start
```

访问 http://localhost:3000 查看应用。

## 使用说明

### 1. 添加作品/CP

在首页表单中输入作品名和 CP 名，点击添加按钮。

### 2. 搜索梗内容

点击作品/CP 列表中的「搜索梗」按钮，自动搜索相关梗内容。

### 3. 生成文章

- **单篇生成**：在梗内容列表中点击「生成文章」按钮
- **批量生成**：点击首页的「生成文章」按钮，批量处理所有待生成的梗

### 4. 数据同步

- **从云端同步**：将云端 MySQL 数据同步到本地 SQLite
- **同步到云端**：将本地 SQLite 数据同步到云端 MySQL

## 项目结构

```
├── public/              # 前端静态资源
│   ├── index.html       # 首页
│   ├── geng-list.html   # 梗内容列表页
│   ├── article-list.html # 文章列表页
│   └── js/              # JavaScript 文件
├── src/                 # 后端代码
│   ├── server.js        # 服务器入口
│   ├── controllers/     # 控制器
│   ├── services/        # 服务层
│   ├── database/        # 数据库操作
│   ├── browser/         # 浏览器自动化
│   └── utils/           # 工具函数
├── data/                # SQLite 数据库文件
├── .env                 # 环境变量配置
└── package.json         # 项目配置
```

## 注意事项

1. 首次运行会自动初始化 SQLite 数据库
2. 云端 MySQL 配置为可选，不配置则仅使用本地数据库
3. 文章生成需要网络连接和浏览器自动化支持
4. 建议定期备份数据库文件

## 许可证

MIT License