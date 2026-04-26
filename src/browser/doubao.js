const { getPendingGengContent, insertArticle, updateGengStatus } = require('../database/dbManager');
const { initializeDoubaoPage, getDoubaoPage } = require('./browserManager');
const { randomDelay, checkCaptcha, handleCaptcha, checkAndHandleCaptcha, getInputElement, waitForInputAndFill, sendMessage, formatWorkCp } = require('../utils');

async function initializeAndValidatePage() {
  let page = await initializeDoubaoPage();

  try {
    await page.evaluate(() => true);
  } catch (error) {
    console.log('页面已关闭，重新创建...');
    const { shutdown, initializeDoubaoPage: initPage } = require('./browserManager');
    await shutdown();
    page = await initPage();
  }

  return page;
}

async function navigateToChatPage(page) {
  console.log('重新加载豆包首页...');
  await page.goto('https://www.doubao.com/chat/', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });

  console.log('等待页面加载稳定（4~5秒）...');
  await randomDelay(4000, 5000);
}

async function waitForIframe(page, maxIframeWaitTime = 20000) {
  const iframeSelector = 'iframe[src*="ccm-docx"]';
  let frame = null;
  let totalWaitTime = 0;
  let iframeWaitTime = 0;
  const checkInterval = 1000;
  const maxTotalWaitTime = 600 * 1000;

  console.log('1. 等待 iframe[src*="ccm-docx"] 出现...');
  console.log(`最多等待${Math.floor(maxIframeWaitTime / 1000)}秒...`);

  while (iframeWaitTime < maxIframeWaitTime && totalWaitTime < maxTotalWaitTime) {
    const iframe = await page.$(iframeSelector);

    if (iframe) {
      console.log('✅ 已找到iframe');

      try {
        frame = await iframe.contentFrame();
        if (frame) {
          console.log('✅ 已成功进入iframe内部');
          console.log('等待 iframe 内部加载（6~8秒）...');
          await randomDelay(6000, 8000);
          return { frame, totalWaitTime };
        }
      } catch (error) {
        console.log('iframe contentFrame 尚未就绪:', error.message);
      }
    }

    await page.waitForTimeout(checkInterval);
    totalWaitTime += checkInterval;
    iframeWaitTime += checkInterval;
  }

  return { frame: null, totalWaitTime, iframeWaitTime };
}

async function monitorContentUntilStable(page, frame, startWaitTime = 0) {
  const maxTotalWaitTime = 600 * 1000;
  const checkInterval = 1000;
  let totalWaitTime = startWaitTime;
  let lastLogTime = 0;

  let lastContent = '';
  let stableCount = 0;
  const stableThreshold = 2;
  let lastStableContent = '';
  let lastStableLength = 0;
  let maxContent = '';
  let maxLength = 0;
  let extractedTitle = '';

  console.log('2. iframe内监听文章内容变化...');

  while (totalWaitTime < maxTotalWaitTime) {
    const result = await frame.evaluate(() => {
      const titleSelectors = [
        '.page-block-header h1',
        '.page-block-header [data-zone-id="1"]',
        '.page-block-header [contenteditable="true"]',
        'h1.page-block-content',
        '.page-block-header'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const stringSpans = element.querySelectorAll('[data-string="true"]');
          if (stringSpans.length > 0) {
            title = Array.from(stringSpans)
              .map(span => span.textContent || '')
              .join('')
              .trim();
          } else {
            title = element.textContent || '';
          }
          if (title) break;
        }
      }

      const contentSelectors = [
        'div.docx-editor',
        'div.document-content',
        '.editor-content',
        '.content-body',
        '.docx-body',
        'div[class*="editor"]',
        'div[class*="document"]',
        'div[class*="page-content"]',
        '.page-body',
        '.content-wrapper',
        'div[class*="content"]',
        'body'
      ];

      let maxText = '';
      let maxLen = 0;

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const contentElement = element.cloneNode(true);
          const titleElements = contentElement.querySelectorAll('.page-block-header');
          titleElements.forEach(el => el.remove());

          const aceLines = contentElement.querySelectorAll('.ace-line');

          if (aceLines.length > 0) {
            const allLines = [];
            aceLines.forEach((line) => {
              const spans = line.querySelectorAll('span[data-string="true"]');
              const lineText = Array.from(spans)
                .map(span => span.textContent || '')
                .join('');
              allLines.push(lineText);
            });
            const combinedText = allLines.join('\n');
            if (combinedText.length > maxLen) {
              maxText = combinedText;
              maxLen = maxText.length;
            }
          } else {
            const text = contentElement.textContent;
            if (text && text.trim().length > maxLen) {
              maxText = text.trim();
              maxLen = maxText.length;
            }
          }
        }
      }

      if (title && maxText.includes(title)) {
        maxText = maxText.replace(title, '').trim();
      }

      return { title: title || '', content: maxText || '' };
    });

    extractedTitle = result.title;
    const currentContent = result.content;
    const contentLength = currentContent.length;

    if (contentLength > maxLength) {
      maxContent = currentContent;
      maxLength = contentLength;
    }

    if (currentContent === lastContent) {
      stableCount++;
      if (stableCount === 1) {
        lastStableContent = currentContent;
        lastStableLength = contentLength;
      }
    } else {
      stableCount = 0;
      lastContent = currentContent;
    }

    if (stableCount >= stableThreshold && contentLength > 100) {
      console.log(`✅ 内容连续${stableThreshold}秒未变化，文章生成完成，总等待时间: ${Math.floor(totalWaitTime / 1000)}秒，内容长度: ${lastStableLength}`);
      return {
        articleContent: lastStableContent,
        finalLength: lastStableLength,
        extractedTitle,
        maxContent,
        maxLength
      };
    }

    await page.waitForTimeout(checkInterval);
    totalWaitTime += checkInterval;

    if (totalWaitTime - lastLogTime >= 5000) {
      console.log(`[等待内容稳定] 内容长度: ${contentLength}，稳定计数: ${stableCount}/${stableThreshold}，已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
      lastLogTime = totalWaitTime;
    }
  }

  return {
    articleContent: lastStableContent,
    finalLength: lastStableLength,
    extractedTitle,
    maxContent,
    maxLength
  };
}

function validateArticleContent(articleContent, finalLength) {
  const markers = ['【付费卡点】\u200b', '【付费卡点】', '付费卡点'];
  
  let foundMarker = false;
  let matchedMarker = '';
  
  for (const marker of markers) {
    if (articleContent.includes(marker)) {
      foundMarker = true;
      matchedMarker = marker;
      break;
    }
  }
  
  if (!foundMarker) {
    const sampleContent = articleContent.substring(0, 200);
    console.log(`[验证失败] 内容开头: "${sampleContent}"`);
    console.log(`[验证失败] 内容长度: ${articleContent.length}`);
    throw new Error('内容异常：未包含【付费卡点】标记');
  }
  
  console.log(`[验证通过] 找到标记: "${matchedMarker}"`);

  if (finalLength < 100) {
    throw new Error(`超时：文章内容过短，长度: ${finalLength}`);
  }

  return true;
}

async function waitForSendButtonVisible(page) {
  console.log('等待文章生成完成（检测 !hidden class 是否存在）...');
  
  const maxWaitTime = 60 * 1000 * 20;
  const checkInterval = 2000;
  let totalWaitTime = 0;
  let lastLogTime = 0;
  
  while (totalWaitTime < maxWaitTime) {
    const isGenerating = await page.evaluate(() => {
      const sendBtn = document.querySelector('.send-btn-wrapper');
      if (!sendBtn) return false;
      
      const className = sendBtn.className || '';
      return className.includes('!hidden');
    });
    
    if (!isGenerating) {
      console.log(`✅ 文章生成完成，总等待时间: ${Math.floor(totalWaitTime / 1000)}秒`);
      return true;
    }
    
    await page.waitForTimeout(checkInterval);
    totalWaitTime += checkInterval;
    
    if (totalWaitTime - lastLogTime >= 10000) {
      console.log(`[等待文章生成] 已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
      lastLogTime = totalWaitTime;
    }
  }
  
  throw new Error(`超时：文章在 ${Math.floor(maxWaitTime / 1000)} 秒内未生成完成`);
}

async function findCopyButtonInFrame(frame, pageDesc) {
  let copyButton = null;

  const selectors = [
    'div.top-control-bar-icon-wrapper',
    'div.container-v6Tm7I',
    'div[class*="top-control-bar-icon-wrapper"]',
    'div[class*="container-"]',
    'div[type="button"]',
    '[role="button"]',
    '.copy-btn',
    'button.copy',
    'div.copy'
  ];

  for (const selector of selectors) {
    try {
      const elements = await frame.$$(selector);
      if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
          const text = await frame.evaluate(el => el.textContent || el.innerText || '', elements[i]);
          if (text.includes('复制')) {
            copyButton = elements[i];
            console.log(`在${pageDesc}找到复制按钮，选择器: ${selector}`);
            return copyButton;
          }
        }
      }
    } catch (error) {
      console.log(`选择器 "${selector}" 执行失败: ${error.message}`);
    }
  }

  console.log(`在${pageDesc}尝试查找包含 "复制" 文字的所有元素...`);
  const allElements = await frame.$$('*');
  
  for (let i = 0; i < allElements.length; i++) {
    try {
      const text = await frame.evaluate(el => el.textContent || el.innerText || '', allElements[i]);
      if (text.includes('复制')) {
        const className = await frame.evaluate(el => el.className || '', allElements[i]);
        if (className.includes('icon') || className.includes('wrapper') || className.includes('container')) {
          copyButton = allElements[i];
          console.log(`在${pageDesc}通过全文搜索找到复制按钮: className="${className}"`);
          return copyButton;
        }
      }
    } catch (error) {
      // 忽略错误
    }
  }

  return null;
}

async function getContentByCopyButton(page) {
  console.log('开始通过复制按钮获取内容...');

  let copyButton = null;

  console.log('1. 首先在主页面查找复制按钮...');
  copyButton = await findCopyButtonInFrame(page, '主页面');

  if (!copyButton) {
    console.log('主页面未找到复制按钮，尝试在 iframe 中查找...');
    const iframeSelector = 'iframe[src*="ccm-docx"], iframe[src*="doc"], iframe';
    const iframe = await page.$(iframeSelector);
    
    if (iframe) {
      try {
        const contentFrame = await iframe.contentFrame();
        if (contentFrame) {
          copyButton = await findCopyButtonInFrame(contentFrame, 'iframe');
        }
      } catch (error) {
        console.log(`获取 iframe contentFrame 失败: ${error.message}`);
      }
    }
  }

  if (!copyButton) {
    throw new Error('未找到复制按钮');
  }

  console.log('点击复制按钮...');
  await copyButton.click();

  console.log('等待复制完成（1.5秒）...');
  await page.waitForTimeout(1500);

  console.log('获取剪贴板内容...');
  const clipboardContent = await page.evaluate(async () => {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (error) {
      console.log('读取剪贴板失败:', error.message);
      return null;
    }
  });

  if (clipboardContent && clipboardContent.length > 0) {
    console.log(`成功获取剪贴板内容，长度: ${clipboardContent.length} 字符`);
    return clipboardContent;
  } else {
    throw new Error('剪贴板为空或无法读取');
  }
}

async function generateArticleCore(geng, options = {}) {
  const {
    skipOnIframeTimeout = false,
    skipOnContentError = false,
    closeDelay = 2000
  } = options;

  try {
    let page = await initializeAndValidatePage();
    await navigateToChatPage(page);
    await waitForInputAndFill(page, geng.prompt_text);
    await checkAndHandleCaptcha(page);
    await sendMessage(page);

    console.log('等待豆包生成文章...');
    await waitForSendButtonVisible(page);

    console.log('等待页面稳定（2~3秒）...');
    await randomDelay(2000, 3000);

    let finalContent = '';
    let extractedTitle = '';

    finalContent = await getContentByCopyButton(page);

    const firstLine = finalContent.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
      extractedTitle = firstLine;
      finalContent = extractedTitle + ' - ' + finalContent;
      console.log(`📝 提取到标题: ${extractedTitle}`);
    }

    try {
      validateArticleContent(finalContent, finalContent.length);
    } catch (error) {
      if (skipOnContentError) {
        console.log(`⚠️ ${error.message}，跳过此条`);
        return { success: false, reason: 'content_error', message: error.message };
      }
      throw error;
    }

    console.log(`获取的文章内容长度: ${finalContent.length} 字符`);

    if (closeDelay > 0) {
      const actualDelay = closeDelay + Math.random() * 1000;
      console.log(`等待 ${Math.round(actualDelay / 1000)} 秒后完成...`);
      await page.waitForTimeout(actualDelay);
    }

    return {
      success: true,
      content: finalContent,
      title: extractedTitle
    };

  } catch (error) {
    console.error('生成文章过程中发生错误:', error.message);
    throw error;
  }
}

async function generateArticle(geng) {
  const result = await generateArticleCore(geng, {
    skipOnIframeTimeout: false,
    skipOnContentError: false,
    closeDelay: 2000
  });

  if (!result.success) {
    throw new Error(result.message || '生成失败');
  }

  return result.content;
}

async function generateArticles(workCpFilter = '', statusFilter = '') {
  try {
    let pendingGengs = await getPendingGengContent(100);

    if (workCpFilter) {
      pendingGengs = pendingGengs.filter(geng => {
        const gengWorkCp = `${geng.work_name} / ${geng.cp_name}`;
        return gengWorkCp === workCpFilter;
      });
    }

    if (statusFilter && statusFilter !== 'pending') {
      pendingGengs = [];
    }

    if (pendingGengs.length === 0) {
      console.log('没有符合条件的待生成梗内容');
      return 0;
    }

    let successCount = 0;

    console.log(`正在初始化豆包页面，准备处理 ${pendingGengs.length} 条待生成的梗...`);
    let page = await initializeAndValidatePage();

    console.log(`开始循环处理，共有 ${pendingGengs.length} 条梗`);
    for (let i = 0; i < pendingGengs.length; i++) {
      console.log(`\n进入循环第 ${i + 1} 次迭代`);
      const geng = pendingGengs[i];

      try {
        console.log(`正在处理第 ${i + 1}/${pendingGengs.length} 条梗...`);

        const result = await generateArticleCore(geng, {
          skipOnIframeTimeout: true,
          skipOnContentError: true,
          closeDelay: 5000
        });

        if (!result.success) {
          if (result.reason === 'iframe_timeout' || result.reason === 'content_error') {
            const delay = 5000 + Math.random() * 5000;
            console.log(`等待 ${Math.round(delay / 1000)} 秒后继续处理下一条...`);
            await page.waitForTimeout(delay);
            continue;
          }
        }

        await insertArticle(geng.work_name, geng.cp_name, geng.prompt_text, result.content);
        await updateGengStatus(geng.id, 'completed');
        console.log(`第 ${i + 1} 条梗状态已更新为已完成`);

        successCount++;
        console.log(`第 ${i + 1} 条梗生成文章成功，已存入数据库`);

        const closeDelay = 5000 + Math.random() * 5000;
        console.log(`等待 ${Math.round(closeDelay / 1000)} 秒后处理下一条...`);
        await page.waitForTimeout(closeDelay);

      } catch (error) {
        console.error(`第 ${i + 1} 条梗处理失败:`, error.message);

        const delay = 5000 + Math.random() * 5000;
        console.log(`等待 ${Math.round(delay / 1000)} 秒后继续处理下一条...`);
        await page.waitForTimeout(delay);
      }
    }

    console.log(`\n文章生成任务完成，成功 ${successCount}/${pendingGengs.length} 条`);
    return successCount;

  } catch (error) {
    console.error('生成文章过程中发生错误:', error.message);
    throw error;
  }
}

module.exports = { generateArticles, generateArticle };