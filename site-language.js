(function () {
  'use strict';

  var storageKey = 'preferred-language';
  var originals = new WeakMap();
  var originalAttributes = new WeakMap();
  var button = document.getElementById('language-toggle');
  var rules = [
    ['.skip-link', '跳转到正文'],
    ['#primary-nav a[href="#profile"]', '简介'],
    ['#primary-nav a[href="#research"]', '研究'],
    ['#primary-nav a[href="#vibe-projects"]', '项目'],
    ['#primary-nav a[href="#publications"]', '论文'],
    ['#primary-nav a[href="#patents"]', '专利'],
    ['#primary-nav a[href="#honors"]', '荣誉'],

    ['#profile .profile-intro', '我目前在北京航空航天大学计算机学院攻读计算机科学与技术博士学位，导师是<a href="http://miaowang.me">汪淼教授</a>。此前，我在北京理工大学获得软件工程硕士学位，导师是<a href="https://guangyu-ryan.github.io/">高广宇教授</a>。'],
    ['#profile .console-grid span:nth-child(1)', '视频生成'],
    ['#profile .console-grid span:nth-child(2)', '长视频生成'],
    ['#profile .console-grid span:nth-child(3)', '视频世界模型'],
    ['#profile .console-grid span:nth-child(4)', '模型蒸馏'],
    ['#profile .console-grid span:nth-child(5)', '记忆机制'],
    ['#profile .profile-links > a:nth-of-type(1) > span:last-child', '邮箱'],
    ['#profile .profile-links > a:nth-of-type(2) > span:last-child', '小红书'],
    ['#profile .wechat-link > span:last-child', '微信'],
    ['#profile .portrait-caption', '在读博士 · 计算机科学 · 北京航空航天大学'],
    ['#profile .portrait-resource-links a:nth-of-type(1)', '每日论文'],
    ['#profile .portrait-resource-links a:nth-of-type(2)', '笔记'],
    ['#profile .academic-service', '<span class="service-label">学术服务</span>担任 ACM MM 及多媒体、计算机视觉和人工智能相关会议的审稿人。'],
    ['#profile .collab-kicker', '开放合作'],
    ['#profile .collab-copy > p', '期待与从事视频生成、长视频生成、视频世界模型、模型蒸馏和记忆增强生成系统研究的同行交流合作。'],
    ['#profile .collab-tags span:nth-child(1)', '合作研究'],
    ['#profile .collab-tags span:nth-child(2)', '论文想法'],
    ['#profile .collab-tags span:nth-child(3)', '开放项目'],

    ['#research h2', '研究方向'],
    ['#research .section-block > p', '我的研究兴趣集中在生成式视频智能，包括视频生成、长视频生成、视频世界模型、模型蒸馏与记忆机制。'],
    ['#research .research-focus:nth-of-type(1) h3', '视频生成'],
    ['#research .research-focus:nth-of-type(1) p', '研究高质量视觉合成、可控生成，以及动态视频内容的时间一致性。'],
    ['#research .research-focus:nth-of-type(2) h3', '长视频生成'],
    ['#research .research-focus:nth-of-type(2) p', '研究长时序生成中的运动连贯性、场景连续性与可扩展的时间建模。'],
    ['#research .research-focus:nth-of-type(3) h3', '视频世界模型'],
    ['#research .research-focus:nth-of-type(3) p', '学习物理动态的预测性视频表征，探索动作条件模拟与世界感知生成。'],
    ['#research .research-focus:nth-of-type(4) h3', '模型蒸馏'],
    ['#research .research-focus:nth-of-type(4) p', '压缩和迁移生成能力，构建高效且易于部署的视频模型。'],
    ['#research .research-focus:nth-of-type(5) h3', '记忆机制'],
    ['#research .research-focus:nth-of-type(5) p', '研究长上下文视频生成、身份一致性与检索增强视觉建模中的记忆机制。'],
    ['#research .keyword-strip span:nth-child(1)', '视频生成'],
    ['#research .keyword-strip span:nth-child(2)', '长视频生成'],
    ['#research .keyword-strip span:nth-child(3)', '视频世界模型'],
    ['#research .keyword-strip span:nth-child(4)', '模型蒸馏'],
    ['#research .keyword-strip span:nth-child(5)', '记忆机制'],

    ['#publications h2', '论文发表'],
    ['#publications .spaced-rows tr:nth-child(1) .thumbnail-actions a:nth-child(1)', '观看视频'],
    ['#publications .spaced-rows tr:nth-child(1) .thumbnail-actions a:nth-child(2)', '方法图'],
    ['#publications .spaced-rows tr:nth-child(2) .thumbnail-actions a:nth-child(1)', '查看原图'],
    ['#publications .spaced-rows tr:nth-child(2) .thumbnail-actions a:nth-child(2)', '注意力图'],
    ['#publications .spaced-rows tr:nth-child(1) .publication-links a', '项目'],
    ['#publications .spaced-rows tr:nth-child(2) .publication-links a:nth-of-type(1)', '论文'],
    ['#publications .spaced-rows tr:nth-child(1) .publication-summary', 'PanoTask 提出面向任务的两阶段方法：根据用户意图预测具备场景感知能力的相机轨迹，并生成几何一致的全景视频；研究同时构建了 PanoTask-10k 数据集。'],
    ['#publications .spaced-rows tr:nth-child(2) .publication-summary', 'MKSNet 通过多核选择机制与双重注意力模块，应对遥感图像中的小目标检测难题，并在 DOTA-v1.0 和 HRSC2016 基准上取得先进性能。'],

    ['#patents h2', '专利'],
    ['#patents .thumbnail-actions a:nth-child(1)', { en: 'View original image', zh: '查看原图' }],
    ['#patents .thumbnail-actions a:nth-child(2)', { en: 'View detail image', zh: '查看细节图' }],
    ['#patents .papertitle', { en: 'Image Pulse Encoding Method Based on Multi-Scale Census Transform', zh: '一种基于多尺度Census变换的图像脉冲编码方法' }],
    ['#patents .publication-authors', { en: '<a href="https://guangyu-ryan.github.io/">Guangyu Gao</a><span class="muted-note"> (Advisor)</span>, <span class="author-self">Jiahao Zhang</span>, Xiao Zhao, Shuai Zhang', zh: '<a href="https://guangyu-ryan.github.io/">高广宇</a><span class="muted-note">（导师）</span>, <span class="author-self">张家豪</span>, 赵晓, 张帅' }],
    ['#patents .publication-venue:nth-of-type(3)', { en: 'Beijing Institute of Technology; Shanghai Institute of Satellite Engineering', zh: '北京理工大学；上海卫星工程研究所' }],
    ['#patents .publication-venue:nth-of-type(4)', { en: '<em>CN 120088344 A</em>, China National Intellectual Property Administration (CNIPA)', zh: '<em>CN 120088344 A</em>, 中国国家知识产权局 (CNIPA)' }],
    ['#patents .publication-summary', { en: 'This invention combines multi-scale feature extraction with Census transforms for image pulse encoding. Multi-scale encoding and weighted fusion produce robust pulse sequences that improve the accuracy and efficiency of spiking neural networks in image processing.', zh: '本发明提出了一种结合多尺度特征提取与Census变换的图像脉冲编码方法。通过多尺度Census编码与加权融合机制，将图像转换为高鲁棒性的脉冲序列，有效提升了脉冲神经网络在图像处理任务中的精度与效率。' }],

    ['#honors h2', '主要荣誉与奖励'],
    ['#honors .honor-card:nth-child(1) h3', '博士阶段'],
    ['#honors .honor-card:nth-child(1) li:nth-child(1)', '<span>2025</span> 博士研究生新生奖学金'],
    ['#honors .honor-card:nth-child(2) h3', '硕士阶段'],
    ['#honors .honor-card:nth-child(2) li:nth-child(1)', '<span>2025</span> 北京理工大学优秀硕士学位论文'],
    ['#honors .honor-card:nth-child(2) li:nth-child(2)', '<span>2025</span> 北京市优秀毕业生'],
    ['#honors .honor-card:nth-child(2) li:nth-child(3)', '<span>2025</span> 北京理工大学优秀毕业生'],
    ['#honors .honor-card:nth-child(2) li:nth-child(4)', '<span>2025</span> 北京理工大学研究生科研竞赛奖学金'],
    ['#honors .honor-card:nth-child(2) li:nth-child(5)', '<span>2023</span> 北京理工大学一等学业奖学金'],
    ['#honors .honor-card:nth-child(3) h3', '本科阶段'],
    ['#honors .honor-card:nth-child(3) li:nth-child(1)', '<span>2021</span> 国家励志奖学金'],
    ['#honors .honor-card:nth-child(3) li:nth-child(2)', '<span>2020</span> “互联网+”大学生创新创业大赛河南赛区一等奖'],
    ['#honors .honor-card:nth-child(3) li:nth-child(3)', '<span>2019/2021</span> 蓝桥杯省级奖项'],
    ['#honors .honor-card:nth-child(3) li:nth-child(4)', '<span>2018-2022</span> 学业优秀与科技创新奖学金'],

    ['#vibe-projects h2', '编程项目'],
    ['#vibe-projects .vibe-projects-section > p', '我开发的论文发现、阅读与整理工具。'],
    ['#vibe-projects .vibe-project:nth-child(1) .vibe-project-heading > span', '浏览器扩展'],
    ['#vibe-projects .vibe-project:nth-child(1) .vibe-project-body > p', '一款本地优先的浏览器扩展，支持阅读 arXiv、ACM、IEEE 网页及 PDF 论文，使用自己的大语言模型进行摘要与讨论，保存笔记并导出到 Zotero。'],
    ['#vibe-projects .vibe-project:nth-child(1) .vibe-project-links a:nth-of-type(1)', '代码'],
    ['#vibe-projects .vibe-project:nth-child(1) .vibe-project-links a:nth-of-type(2)', '版本'],
    ['#vibe-projects .vibe-project:nth-child(2) .vibe-project-heading > span', '科研工具'],
    ['#vibe-projects .vibe-project:nth-child(2) .vibe-project-body > p', '一个每日 arXiv 论文发现与阅读系统，提供主题订阅、结构化大模型分析、阅读管理、RSS 和邮件摘要。'],
    ['#vibe-projects .vibe-project:nth-child(2) .vibe-project-links a:nth-of-type(1)', '代码'],
    ['#vibe-projects .vibe-project:nth-child(2) .vibe-project-links a:nth-of-type(2)', '在线体验'],

    ['#interests h2', '个人爱好'],
    ['#interests .interests-copy:nth-of-type(1)', '科研之外，我喜欢长跑、喝咖啡和爬山。'],
    ['#interests .interests-copy:nth-of-type(2)', '虽然目前的科研成果还不多，但我始终相信脚踏实地做研究，并坚守基本的学术诚信。'],

    ['.visitor-origins__title', '访客来源'],
    ['.visitor-origins__summary-label', ' 个国家或地区'],
    ['.visitor-origins__scan', '正在查询访客来源…'],
    ['.visitor-origins__privacy', '仅保存国家或地区的汇总访问次数，不保留 IP 地址、城市、Cookie 或个人访问记录。'],
    ['.visitor-origins__unit', ' 次访问'],
    ['.footer-info > .muted-note', '设计与源代码参考 <a class="muted-note" href="https://jonbarron.info" target="_blank">Jon Barron 的网站</a>'],
    ['#shiba-pet .shiba-pet__bubble', '你好！']
  ];

  var attributeRules = [
    ['#nav-toggle', 'aria-label', '切换导航菜单'],
    ['#primary-nav', 'aria-label', '主导航'],
    ['.nav-cv-button', 'aria-label', '打开英文简历（更新于 2026 年 9 月 22 日）'],
    ['#profile .profile-links', 'aria-label', '联系方式与社交账号'],
    ['#profile .portrait-resource-links', 'aria-label', '科研资源'],
    ['#profile .profile-photo', 'alt', '张家豪的照片'],
    ['.wechat-popup img', 'alt', '微信二维码'],
    ['#shiba-pet .shiba-pet__button', 'aria-label', '与柴犬互动'],
    ['#visitor-origins-toggle', 'aria-label', { en: 'Show visitor origins', zh: '查看访客来源' }]
  ];

  function applyRules(chinese) {
    rules.forEach(function (rule) {
      document.querySelectorAll(rule[0]).forEach(function (element) {
        if (!originals.has(element)) originals.set(element, element.innerHTML);
        var value = rule[1];
        element.innerHTML = typeof value === 'string'
          ? (chinese ? value : originals.get(element))
          : value[chinese ? 'zh' : 'en'];
      });
    });

    attributeRules.forEach(function (rule) {
      document.querySelectorAll(rule[0]).forEach(function (element) {
        var saved = originalAttributes.get(element) || {};
        if (!(rule[1] in saved)) saved[rule[1]] = element.getAttribute(rule[1]);
        originalAttributes.set(element, saved);
        var translation = rule[2];
        var value = typeof translation === 'string'
          ? (chinese ? translation : saved[rule[1]])
          : translation[chinese ? 'zh' : 'en'];
        if (value === null) element.removeAttribute(rule[1]);
        else element.setAttribute(rule[1], value);
      });
    });
  }

  function applyLanguage(language) {
    var chinese = language === 'zh';
    document.documentElement.lang = chinese ? 'zh-CN' : 'en';
    document.title = chinese ? '张家豪 | Jiahao Zhang' : 'Jiahao Zhang';
    applyRules(chinese);
    if (button) {
      button.textContent = chinese ? 'EN' : '中';
      button.lang = chinese ? 'en' : 'zh-CN';
      button.setAttribute('aria-pressed', String(chinese));
      button.setAttribute('aria-label', chinese ? 'Switch to English' : '切换到中文');
      button.title = chinese ? 'Switch to English' : '切换到中文';
    }
    document.dispatchEvent(new Event('site:languagechange'));
  }

  var savedLanguage = null;
  try { savedLanguage = localStorage.getItem(storageKey); } catch (_) { /* storage may be unavailable */ }
  var language = savedLanguage === 'zh' ? 'zh' : 'en';
  applyLanguage(language);
  if (window.siteIncludesReady) {
    window.siteIncludesReady.then(function () { applyLanguage(language); });
  }
  if (button) {
    button.addEventListener('click', function () {
      language = language === 'zh' ? 'en' : 'zh';
      applyLanguage(language);
      try { localStorage.setItem(storageKey, language); } catch (_) { /* storage may be unavailable */ }
    });
  }
})();
