// 加载环境变量
require('dotenv').config();

// 设置输出编码为 UTF-8
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

require('./src/server');