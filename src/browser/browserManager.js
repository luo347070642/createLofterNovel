const { chromium } = require('playwright');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

let browser = null;
let context = null;
let isInitialized = false;
let doubaoPage = null;

async function closeEdgeBrowser() {
  return new Promise((resolve) => {
    exec('taskkill /F /IM msedge.exe', (error) => {
      if (error && !error.message.includes('找不到')) {
        console.log('关闭 Edge 浏览器时出现警告:', error.message);
      }
      resolve();
    });
  });
}

async function initialize() {
  if (isInitialized && browser && context) {
    try {
      const pages = context.pages();
      if (pages.length > 0) {
        await pages[0].close();
      }
    } catch (e) {
      console.log('关闭旧页面时出错:', e.message);
    }
    return { browser, context };
  }

  try {
    console.log('正在关闭已运行的 Edge 浏览器...');
    await closeEdgeBrowser();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const tempUserDataDir = path.join(os.tmpdir(), 'lofter-novel-edge');
    
    console.log('正在启动 Edge 浏览器...');
    context = await chromium.launchPersistentContext(tempUserDataDir, {
      channel: 'msedge',
      headless: false,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-restore-last-session',
        '--disable-site-isolation-trials'
      ],
      viewport: null,
      timeout: 120000
    });

    context.on('dialog', async dialog => {
      console.log(`Dialog出现: ${dialog.type()} - ${dialog.message()}`);
      await dialog.accept();
    });

    browser = context.browser();
    isInitialized = true;
    
    const pages = context.pages();
    console.log(`浏览器启动后有 ${pages.length} 个页面`);
    
    if (pages.length > 1) {
      for (let i = 1; i < pages.length; i++) {
        console.log(`关闭页面: ${await pages[i].title()}`);
        await pages[i].close();
      }
    }
    
    const mainPage = pages[0];
    console.log('导航到 http://localhost:3000...');
    await mainPage.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    console.log('导航成功，页面标题:', await mainPage.title());
    console.log('浏览器初始化完成，已打开 localhost:3000');
    return { browser, context };
  } catch (error) {
    console.error('浏览器初始化失败:', error.message);
    console.error('完整错误:', error);
    
    // 尝试关闭浏览器
    if (context) {
      try {
        await context.close();
      } catch (closeError) {
        console.log('关闭浏览器时出现错误:', closeError.message);
      }
      browser = null;
      context = null;
      isInitialized = false;
    }
    
    throw error;
  }
}

async function newPage() {
  if (!isInitialized || !context) {
    await initialize();
  }
  return context.newPage();
}

function getContext() {
  return context;
}

function getBrowser() {
  return browser;
}

function isReady() {
  return isInitialized && browser !== null && context !== null;
}

async function initializeDoubaoPage() {
  if (!isInitialized || !context) {
    await initialize();
  }

  if (doubaoPage) {
    try {
      // 检查页面是否有效
      await doubaoPage.evaluate(() => true);
      return doubaoPage;
    } catch (error) {
      console.log('豆包页面已关闭，重新创建...');
      doubaoPage = null;
    }
  }

  console.log('正在初始化豆包页面...');
  doubaoPage = await context.newPage();
  
  await doubaoPage.goto('https://www.doubao.com/chat/', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });

  console.log('豆包页面初始化完成');
  return doubaoPage;
}

async function getDoubaoPage() {
  return doubaoPage;
}

async function shutdown() {
  if (doubaoPage) {
    try {
      await doubaoPage.close();
      console.log('豆包页面已关闭');
    } catch (error) {
      console.log('关闭豆包页面时出现错误:', error.message);
    }
    doubaoPage = null;
  }
  
  if (context) {
    try {
      await context.close();
      console.log('浏览器上下文已关闭');
    } catch (error) {
      console.log('关闭浏览器时出现错误:', error.message);
    }
    browser = null;
    context = null;
    isInitialized = false;
  }
}

module.exports = {
  initialize,
  newPage,
  getContext,
  getBrowser,
  isReady,
  shutdown,
  initializeDoubaoPage,
  getDoubaoPage
};