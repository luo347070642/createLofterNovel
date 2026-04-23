function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function checkCaptcha(page) {
  const captchaSelectors = [
    'div[class*="captcha"]',
    'div[class*="verify"]',
    'iframe[src*="captcha"]',
    'div[role="dialog"]',
    '.ant-modal',
    '.semi-modal'
  ];

  for (const selector of captchaSelectors) {
    const element = await page.$(selector);
    if (element) {
      const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden';
      }, element);
      if (isVisible) {
        return true;
      }
    }
  }
  return false;
}

async function handleCaptcha() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise(resolve => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

async function checkAndHandleCaptcha(page) {
  const hasCaptcha = await checkCaptcha(page);
  if (hasCaptcha) {
    console.log('⚠️  检测到验证码，需要手动验证');
    console.log('请在浏览器中完成人机验证，完成后按 Enter 继续...');
    await handleCaptcha();
    return true;
  }
  return false;
}

async function getInputElement(page) {
  const textarea = await page.$('textarea');
  const contentEditable = await page.$('[contenteditable="true"]');

  if (textarea) {
    return textarea;
  } else if (contentEditable) {
    return contentEditable;
  }
  return null;
}

async function waitForInputAndFill(page, promptText, options = {}) {
  const {
    inputTimeout = 30000,
    clickDelay = [500, 1000],
    fillDelay = [100, 300]
  } = options;

  await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: inputTimeout });

  const inputElement = await getInputElement(page);
  if (!inputElement) {
    throw new Error('未找到输入框');
  }

  console.log('点击输入框...');
  await inputElement.click();
  await randomDelay(clickDelay[0], clickDelay[1]);

  console.log('正在粘贴提示词...');
  await inputElement.fill(promptText);
  await randomDelay(fillDelay[0], fillDelay[1]);

  return inputElement;
}

async function sendMessage(page, options = {}) {
  const {
    sendDelay = [4000, 5000],
    buttonSelectors = 'button:has-text("发送"), button[type="submit"]'
  } = options;

  console.log('等待发送...');
  await randomDelay(sendDelay[0], sendDelay[1]);

  console.log('点击发送按钮...');
  const sendButton = await page.$(buttonSelectors);
  if (sendButton) {
    await sendButton.click();
  } else {
    await page.keyboard.press('Enter');
  }
}

function formatWorkCp(workName, cpName) {
  return `${workName} / ${cpName}`;
}

function parseWorkCpFilter(workCpFilter) {
  if (!workCpFilter) return null;
  const parts = workCpFilter.split('/').map(s => s.trim());
  if (parts.length >= 2) {
    return {
      workName: parts[0],
      cpName: parts.slice(1).join('/')
    };
  }
  return null;
}

module.exports = {
  randomDelay,
  checkCaptcha,
  handleCaptcha,
  checkAndHandleCaptcha,
  getInputElement,
  waitForInputAndFill,
  sendMessage,
  formatWorkCp,
  parseWorkCpFilter
};