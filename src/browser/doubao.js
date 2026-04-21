const { getPendingGengContent, insertArticle, updateGengStatus } = require('../database/dbManager');
const { initializeDoubaoPage, getDoubaoPage } = require('./browserManager');

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

async function generateArticle(geng) {
  try {
    console.log(`
正在重新生成文章...`);

    const page = await initializeDoubaoPage();

    console.log('重新加载豆包首页...');
    await page.goto('https://www.doubao.com/chat/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('等待页面加载稳定（4~5秒）...');
    await randomDelay(4000, 5000);

    console.log('等待输入框元素...');
    await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 30000 });

    const textarea = await page.$('textarea');
    const contentEditable = await page.$('[contenteditable="true"]');

    let inputElement;
    if (textarea) {
      inputElement = textarea;
    } else if (contentEditable) {
      inputElement = contentEditable;
    }

    if (!inputElement) {
      throw new Error('未找到输入框');
    }

    console.log('点击输入框...');
    await inputElement.click();

    console.log('正在粘贴提示词...');
    await inputElement.fill(geng.prompt_text);

    console.log('检查是否有验证码...');
    const hasCaptcha = await checkCaptcha(page);
    if (hasCaptcha) {
      console.log('⚠️  检测到验证码，需要手动验证');
      console.log('请在浏览器中完成人机验证，完成后按 Enter 继续...');

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

    console.log('等待发送（1~2秒）...');
    await randomDelay(4000, 5000);

    console.log('点击发送按钮...');
    const sendButton = await page.$('button:has-text("发送"), button[type="submit"]');
    if (sendButton) {
      await sendButton.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log('等待豆包生成文章...');

    const maxTotalWaitTime = 600 * 1000;
    let totalWaitTime = 0;
    let lastLogTime = 0;
    const checkInterval = 1000;

    const iframeSelector = 'iframe[src*="ccm-docx"]';
    let frame = null;

    console.log('1. 等待 iframe[src*="ccm-docx"] 出现...');
    while (totalWaitTime < maxTotalWaitTime) {
      const iframe = await page.$(iframeSelector);

      if (iframe) {
        console.log('✅ 已找到iframe');

        try {
          frame = await iframe.contentFrame();
          if (frame) {
            console.log('✅ 已成功进入iframe内部');
            // 等待 iframe 内部完全加载
            console.log('等待 iframe 内部加载（6~8秒）...');
            await randomDelay(6000, 8000);
            break;
          }
        } catch (error) {
          console.log('iframe contentFrame 尚未就绪:', error.message);
        }
      }

      await page.waitForTimeout(checkInterval);
      totalWaitTime += checkInterval;

      if (totalWaitTime - lastLogTime >= 5000) {
        console.log(`[等待 iframe] 已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
        lastLogTime = totalWaitTime;
      }
    }

    if (!frame) {
      throw new Error('超时：未找到 iframe[src*="ccm-docx"] 或无法获取 contentFrame');
    }

    console.log('2. iframe内监听文章内容变化...');

    let lastContent = '';
    let lastStableContent = '';
    let lastStableLength = 0;
    let stableCount = 0;
    const stableThreshold = 2;
    totalWaitTime = 0;
    lastLogTime = 0;

    let maxContent = '';
    let maxLength = 0;
    let extractedTitle = '';

    while (totalWaitTime < maxTotalWaitTime) {
      try {
        // 提取标题
        const titleSelectors = [
          '.page-block-header h1',
          '.page-block-header [data-zone-id="1"]',
          '.page-block-header [contenteditable="true"]',
          'h1.page-block-content',
          '.page-block-header'
        ];

        for (const selector of titleSelectors) {
          const elements = await frame.$$(selector);
          for (const element of elements) {
            try {
              const spans = await element.$$('span[data-string="true"]');
              if (spans.length > 0) {
                let titleText = '';
                for (const span of spans) {
                  const text = await span.textContent();
                  if (text) {
                    titleText += text;
                  }
                }
                if (titleText) {
                  extractedTitle = titleText.trim();
                  break;
                }
              }
              // 如果没有找到 data-string 元素，尝试获取整个元素的文本
              if (!extractedTitle) {
                const text = await element.textContent();
                if (text) {
                  extractedTitle = text.trim();
                }
              }
            } catch (e) {
              console.log('提取标题时出错:', e.message);
            }
          }
          if (extractedTitle) {
            break;
          }
        }

        // 提取内容，排除标题部分
        let currentContent = '';
        const contentSelectors = [
          '.docx-text-block',
          '.text-block',
          '.zone-container.text-editor',
          'div[data-block-type="text"]',
          'body'
        ];

        for (const selector of contentSelectors) {
          const elements = await frame.$$(selector);
          if (elements.length > 0) {
            // 遍历所有 .ace-line 元素
            const aceLines = await frame.$$('.ace-line');
            const paragraphs = [];
            
            for (const aceLine of aceLines) {
              try {
                const spans = await aceLine.$$('span[data-string="true"]');
                let lineText = '';
                for (const span of spans) {
                  const text = await span.textContent();
                  if (text) {
                    lineText += text;
                  }
                }
                if (lineText) {
                  paragraphs.push(lineText);
                }
              } catch (e) {
                console.log('提取段落时出错:', e.message);
              }
            }
            
            if (paragraphs.length > 0) {
              currentContent = paragraphs.join('\n');
            } else {
              // 降级方案：直接获取元素文本
              for (const element of elements) {
                try {
                  const text = await element.textContent();
                  if (text && text.length > currentContent.length) {
                    currentContent = text;
                  }
                } catch (e) {
                  console.log('提取内容时出错:', e.message);
                }
              }
            }
            
            if (currentContent) {
              break;
            }
          }
        }

        // 移除标题重复
        if (extractedTitle && currentContent.includes(extractedTitle)) {
          currentContent = currentContent.replace(extractedTitle, '').trim();
        }

        const contentLength = currentContent.length;

        // 更新最大内容
        if (contentLength > maxLength) {
          maxContent = currentContent;
          maxLength = contentLength;
          console.log(`📈 发现更长内容，长度: ${maxLength}`);
        }

        if (currentContent === lastContent) {
          stableCount++;
        } else {
          stableCount = 0;
          lastStableContent = currentContent;
          lastStableLength = contentLength;
        }

        lastContent = currentContent;

        if (totalWaitTime - lastLogTime >= 5000) {
          console.log(`[等待内容稳定] 内容长度: ${contentLength}，稳定计数: ${stableCount}/${stableThreshold}，已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
          lastLogTime = totalWaitTime;
        }

        if (stableCount >= stableThreshold) {
          console.log(`✅ 内容连续${stableThreshold}秒未变化，文章生成完成，总等待时间: ${Math.floor(totalWaitTime / 1000)}秒，内容长度: ${contentLength}`);
          break;
        }

      } catch (error) {
        console.log('监听内容变化时出错:', error.message);
      }

      await page.waitForTimeout(checkInterval);
      totalWaitTime += checkInterval;
    }

    let articleContent = lastStableContent;
    let finalLength = lastStableLength;

    if (maxLength > lastStableLength) {
      articleContent = maxContent;
      finalLength = maxLength;
      console.log(`🔄 使用历史最长内容，长度: ${finalLength}`);
    }

    if (extractedTitle) {
      articleContent = extractedTitle + ' - ' + articleContent;
      console.log(`📝 提取到标题: ${extractedTitle}`);
    }

    // 检查内容是否包含【付费卡点】
    if (!articleContent.includes('【付费卡点】\u200b')) {
      throw new Error('内容异常：未包含【付费卡点】标记');
    }

    if (finalLength < 100) {
      console.log(`⏰ 已达到最大等待时间 ${Math.floor(maxTotalWaitTime / 1000)}秒，强制结束等待`);
      throw new Error(`超时：文章内容过短，长度: ${finalLength}`);
    }

    console.log(`直接使用监听获取的完整内容，长度: ${articleContent.length} 字符`);

    const closeDelay = 2000 + Math.random() * 2000;
    console.log(`等待 ${Math.round(closeDelay / 1000)} 秒后完成...`);
    await page.waitForTimeout(closeDelay);

    return articleContent;

  } catch (error) {
    console.error('生成文章过程中发生错误:', error.message);
    throw error;
  }
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
    const page = await initializeDoubaoPage();

    console.log(`开始循环处理，共有 ${pendingGengs.length} 条梗`);
    for (let i = 0; i < pendingGengs.length; i++) {
      console.log(`\n进入循环第 ${i + 1} 次迭代`);
      const geng = pendingGengs[i];

      try {
        console.log(`正在处理第 ${i + 1}/${pendingGengs.length} 条梗...`);

        console.log('重新加载豆包首页...');
        await page.goto('https://www.doubao.com/chat/', {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        });

        console.log('等待页面加载稳定（4~5秒）...');
        await randomDelay(4000, 5000);

        console.log('等待输入框元素...');
        await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 30000 });

        const textarea = await page.$('textarea');
        const contentEditable = await page.$('[contenteditable="true"]');

        let inputElement;
        if (textarea) {
          inputElement = textarea;
        } else if (contentEditable) {
          inputElement = contentEditable;
        }

        if (!inputElement) {
          throw new Error('未找到输入框');
        }

        console.log('点击输入框...');
        await inputElement.click();

        console.log('正在粘贴提示词...');
        await inputElement.fill(geng.prompt_text);

        console.log('检查是否有验证码...');
        const hasCaptcha = await checkCaptcha(page);
        if (hasCaptcha) {
          console.log('⚠️  检测到验证码，需要手动验证');
          console.log('请在浏览器中完成人机验证，完成后按 Enter 继续...');

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

        console.log('等待发送（1~2秒）...');
        await randomDelay(4000, 5000);

        console.log('点击发送按钮...');
        const sendButton = await page.$('button:has-text("发送"), button[type="submit"]');
        if (sendButton) {
          await sendButton.click();
        } else {
          await page.keyboard.press('Enter');
        }

        console.log('等待豆包生成文章...');

        const maxTotalWaitTime = 600 * 1000;
        const maxIframeWaitTime = 20 * 1000; // 最多等待20秒
        let totalWaitTime = 0;
        let iframeWaitTime = 0;
        let lastLogTime = 0;
        const checkInterval = 1000;

        const iframeSelector = 'iframe[src*="ccm-docx"]';
        let frame = null;

        console.log('1. 等待 iframe[src*="ccm-docx"] 出现...');
        console.log('最多等待20秒...');
        iframeWaitTime = 0;
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
                break;
              }
            } catch (error) {
              console.log('iframe contentFrame 尚未就绪:', error.message);
            }
          }

          await page.waitForTimeout(checkInterval);
          totalWaitTime += checkInterval;
          iframeWaitTime += checkInterval;

          if (iframeWaitTime - lastLogTime >= 5000) {
            console.log(`[等待 iframe] 已等待: ${Math.floor(iframeWaitTime / 1000)}秒`);
            lastLogTime = iframeWaitTime;
          }
        }

        if (!frame) {
          console.log('⚠️ 超时：20秒内未找到 iframe[src*="ccm-docx"] 或无法获取 contentFrame，跳过此条');
          const delay = 5000 + Math.random() * 5000;
          console.log(`等待 ${Math.round(delay / 1000)} 秒后继续处理下一条...`);
          await page.waitForTimeout(delay);
          continue;
        }

        console.log('2. iframe内监听文章内容变化...');
        let lastContent = '';
        let stableCount = 0;
        const stableThreshold = 2;
        let contentLength = 0;
        let lastStableContent = '';
        let lastStableLength = 0;
        let maxContent = '';
        let maxLength = 0;
        let extractedTitle = '';

        while (totalWaitTime < maxTotalWaitTime) {
          const result = await frame.evaluate(() => {
            // 提取标题
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

            // 获取所有文本内容，保留段落换行
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
                // 排除标题部分
                const contentElement = element.cloneNode(true);
                const titleElements = contentElement.querySelectorAll('.page-block-header');
                titleElements.forEach(el => el.remove());
                
                // 获取所有 ace-line（段落）并添加换行符
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

            // 移除内容中的标题重复
            if (title && maxText.includes(title)) {
              maxText = maxText.replace(title, '').trim();
            }

            return { title: title || '', content: maxText || '' };
          });

          extractedTitle = result.title;
          const currentContent = result.content;
          contentLength = currentContent.length;

          if (contentLength > maxLength) {
            maxContent = currentContent;
            maxLength = contentLength;
            // console.log(`📈 发现更长内容，长度: ${maxLength}`);
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
            break;
          }

          await page.waitForTimeout(checkInterval);
          totalWaitTime += checkInterval;

          if (totalWaitTime - lastLogTime >= 5000) {
            console.log(`[等待内容稳定] 内容长度: ${contentLength}，稳定计数: ${stableCount}/${stableThreshold}，已等待: ${Math.floor(totalWaitTime / 1000)}秒`);
            lastLogTime = totalWaitTime;
          }
        }

        let articleContent = lastStableContent;
        let finalLength = lastStableLength;

        if (maxLength > lastStableLength) {
          articleContent = maxContent;
          finalLength = maxLength;
          console.log(`🔄 使用历史最长内容，长度: ${finalLength}`);
        }

        if (extractedTitle) {
          articleContent = extractedTitle + ' - ' + articleContent;
          console.log(`📝 提取到标题: ${extractedTitle}`);
        }

        // 检查内容是否包含【付费卡点】
        if (!articleContent.includes('【付费卡点】\u200b')) {
          console.log('⚠️ 内容异常：未包含【付费卡点】标记，跳过此条');
          const delay = 5000 + Math.random() * 5000;
          console.log(`等待 ${Math.round(delay / 1000)} 秒后继续处理下一条...`);
          await page.waitForTimeout(delay);
          continue;
        }

        if (finalLength < 100) {
          console.log(`⏰ 已达到最大等待时间 ${Math.floor(maxTotalWaitTime / 1000)}秒，强制结束等待，内容过短跳过此条`);
          const delay = 5000 + Math.random() * 5000;
          console.log(`等待 ${Math.round(delay / 1000)} 秒后继续处理下一条...`);
          await page.waitForTimeout(delay);
          continue;
        }

        console.log(`直接使用监听获取的完整内容，长度: ${articleContent.length} 字符`);

        await insertArticle(geng.work_name, geng.cp_name, geng.prompt_text, articleContent);

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
