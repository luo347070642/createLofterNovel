const fs = require('fs');
const path = require('path');
const { insertGengContent } = require('../database/dbManager');
const { newPage } = require('./browserManager');
const { randomDelay, waitForInputAndFill, sendMessage } = require('../utils');

async function readTemplate(fileName) {
  const filePath = path.join(__dirname, '../../Tips', fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

function splitGengContent(content) {
  const groups = [];
  const regex = /【第(\d+)组】[\s\S]*?(?=【第(\d+)组】|$)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    let groupContent = match[0].trim();
    groupContent = groupContent.replace(/^【第\d+组】\s*/, '');
    if (groupContent) {
      groups.push(groupContent);
    }
  }

  return groups;
}

async function searchGeng(workName, cpName) {
  let page = null;
  
  try {
    const template = await readTemplate('搜梗提示词.txt');
    const prompt = template
      .replace(/{作品名称}/g, workName)
      .replace(/{CP名称}/g, cpName);

    console.log('正在新建标签页...');
    page = await newPage();

    console.log('正在加载页面...');
    await page.goto('https://www.kimi.com/zh/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('等待页面加载稳定（4~6秒）...');
    await randomDelay(4000, 6000);

    await waitForInputAndFill(page, prompt);
    await sendMessage(page, { sendDelay: [4000, 5000] });

    console.log('等待 Kimi 生成内容...');

    const checkInterval = 2000;
    const maxTotalWaitTime = 10 * 60 * 1000; // 10分钟
    const stableThreshold = 5;
    let totalWaitTime = 0;
    let lastLogTime = 0;
    let previousContent = '';
    let stableCount = 0;
    let hasSeenStopButton = false;
    let hasSeenStopIcon = false;

    while (totalWaitTime < maxTotalWaitTime) {
      await page.waitForTimeout(checkInterval);
      totalWaitTime += checkInterval;

      const sendButtonContainer = await page.$('div.send-button-container');
      let containerClass = '';
      if (sendButtonContainer) {
        containerClass = await sendButtonContainer.getAttribute('class') || '';
      }

      const stopIcon = await page.$('svg[name="stop"], svg.iconify.send-icon');
      const hasStopIconNow = stopIcon !== null;

      const contentSelectors = [
        'div[class*="markdown"]',
        'div[class*="content"]',
        'article',
        '[data-testid="message-content"]',
        '.message-content',
        '.chat-content',
        '[role="main"]',
        '.answer-content',
        '.response-content'
      ];

      let currentContent = '';
      for (const selector of contentSelectors) {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim().length > 0) {
            currentContent = text;
            break;
          }
        }
      }

      if (totalWaitTime - lastLogTime >= 5000) {
        console.log(`[等待中] 内容长度: ${currentContent.length}，容器class: "${containerClass}"，停止图标: ${hasStopIconNow}，已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
        lastLogTime = totalWaitTime;
      }

      if (containerClass.includes('stop')) {
        hasSeenStopButton = true;
        console.log('检测到停止按钮状态（通过class）');
      }

      if (hasStopIconNow) {
        hasSeenStopIcon = true;
        console.log('检测到停止图标');
      }

      if (currentContent === previousContent && currentContent.length > 50) {
        stableCount++;
        console.log(`内容稳定计数: ${stableCount}/${stableThreshold}`);
      } else {
        stableCount = 0;
        previousContent = currentContent;
      }

      const stopButtonGone = hasSeenStopButton && !containerClass.includes('stop');
      const stopIconGone = hasSeenStopIcon && !hasStopIconNow;
      const contentStable = stableCount >= stableThreshold && currentContent.length > 100;

      if (stopButtonGone || stopIconGone) {
        console.log(`✅ 停止按钮/图标已消失，判定为输出完成，内容长度: ${currentContent.length}，等待时间: ${Math.floor(totalWaitTime / 1000)}秒`);
        await page.waitForTimeout(2000);
        break;
      }

      if (contentStable) {
        console.log(`✅ 连续${stableThreshold}次内容未变化，判定为输出完成，内容长度: ${currentContent.length}，等待时间: ${Math.floor(totalWaitTime / 1000)}秒`);
        break;
      }
    }

    if (totalWaitTime >= maxTotalWaitTime) {
      console.log(`⏰ 已达到最大等待时间 ${Math.floor(maxTotalWaitTime / 1000)}秒，强制结束等待`);
    }

    console.log(`Kimi 内容生成完成，总等待时间: ${Math.floor(totalWaitTime / 1000)}秒`);

    const contentSelectors = [
      'div[class*="markdown"]',
      'div[class*="content"]',
      'article',
      '[data-testid="message-content"]',
      '.message-content',
      '.chat-content',
      '[role="main"]',
      '.answer-content',
      '.response-content',
      '[class*="assistant"]',
      '[class*="bot"]',
      '[class*="answer"]',
      '[class*="reply"]',
      'div.chat-message',
      '.message-body',
      '[data-testid="assistant-message"]',
      '.assistant-message',
      '.bot-message'
    ];

    let fullContent = '';
    let maxLength = 0;
    
    for (const selector of contentSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > maxLength) {
          fullContent = text;
          maxLength = fullContent.length;
          console.log(`找到内容，选择器: ${selector}，长度: ${maxLength}`);
        }
      }
    }

    if (!fullContent || fullContent.trim().length < 100) {
      console.log('尝试获取页面所有文本...');
      const bodyText = await page.textContent('body');
      if (bodyText && bodyText.length > 500) {
        fullContent = bodyText;
        console.log(`使用页面body文本，长度: ${fullContent.length}`);
      } else {
        throw new Error(`获取的内容过短或为空，长度: ${fullContent.length}`);
      }
    }

    console.log(`获取到内容，长度: ${fullContent.length} 字符`);

    const gengGroups = splitGengContent(fullContent);

    console.log(`成功分割出 ${gengGroups.length} 条梗`);

    const shengwenTemplate = await readTemplate('生文提示词.txt');

    for (const geng of gengGroups) {
      const fullPrompt = shengwenTemplate
        .replace(/{梗内容}/g, geng)
        .replace(/{作品名称}/g, workName)
        .replace(/{CP名称}/g, cpName);

      await insertGengContent(workName, cpName, geng, fullPrompt);
    }

    console.log(`已将 ${gengGroups.length} 条梗存入数据库`);

    return gengGroups.length;
    
  } catch (error) {
    console.error('搜梗过程中发生错误:', error.message);
    throw error;
  }
}

module.exports = { searchGeng };