import { hopeTheme } from "vuepress-theme-hope";

import { navbar } from "./navbar.js";

export default hopeTheme(
  {
    hostname: "https://shierhen.github.io",

    author: {
      name: "十二",
      url: "https://github.com/shierhen",
    },
    
    navbarTitle: "十二的小站",

    logo: "/avatar.jpg",

    docsDir: "src",

    // 热重载：博客的分类、标签、置顶等元数据改动后无需重启 dev server
    hotReload: true,
    // 文章下面 作者 创建时间 阅读时间 标签等
    pageInfo: ["Author", "Original", "Date", "PageView", "Category", "Tag"],
    // 深色模式：switch 表示在「亮色 / 暗色 / 跟随系统」三者间切换
    darkmode: "toggle",

    // 全屏按钮
    fullscreen: true,

    // 打印按钮
    print: false,

    // 外部链接图标
    externalLinkIcon: true,

    navbar,

    // 侧边栏：默认关闭；仅两个多章节系列目录开启「结构侧栏」，
    // 让系列文章有章节导航（左栏只显示该目录内页面，不影响其他页面）。
    sidebar: {
      "/posts/tech/typescript/": "structure",
      "/posts/tech/react/": "structure",
    },

    // 页脚
    // footer: "用 VuePress 与 vuepress-theme-hope 构建",
    // 版权行：主题默认取运行时年份（会跟着系统时间变），这里写死 2025，
    // 让站点呈现一致的时间线
    copyright: "Copyright © 2025 十二",
    displayFooter: true,
    metaLocales:{
      toc:"本文目录"
    },
    // 博客信息
    blog: {
      name: "十二",
      avatar: "/avatar.jpg",
      description: "记录学习、思考与生活",
      intro: "/intro.html",
      medias: {
        GitHub: "https://github.com/shierhen",
        // 必须带 mailto: 前缀。只写邮箱地址会被浏览器当成相对路径，
        // 在 /article/ 这类页面点击就会跳到 /article/xxx@qq.com 而 404。
        Email: "mailto:1958392643@qq.com",
        Rss: "/rss.xml",
      },
      articleInfo: ["Author", "Original", "Date", "PageView", "Category", "Tag"],
    },

    // Markdown 增强
    markdown: {
      align: true,
      attrs: true,
      codeTabs: true,
      figure: true,
      gfm: true,
      imgLazyload: true,
      imgSize: true,
      mark: true,
      spoiler: true,
      sub: true,
      sup: true,
      tabs: true,
      tasklist: true,
      // 代码高亮：亮色/暗色双主题
      highlighter: {
        type: "shiki",
        themes: {
          light: "one-light",
          dark: "one-dark-pro",
        },
      },
    },

    plugins: {
      // 博客功能：文章列表、分类、标签、时间线
      blog: true,

      // 目录页（/posts/、/posts/tech/ 这类自动生成的列表页）
      // 它们本身是有用的入口，但出现在面包屑里会把层级撑得很长，
      // 所以给中文标题 + breadcrumbExclude，让面包屑直接跳到文章本身。
      catalog: {
        frontmatter: (path) => {
          const titles: Record<string, string> = {
            "/posts/": "文章",
            "/posts/tech/": "技术",
            "/posts/life/": "随笔",
          };

          return {
            // 保持原有行为：目录页不进文章列表、不进 RSS 与站点地图
            article: false,
            feed: false,
            sitemap: false,
            ...(titles[path] ? { title: titles[path] } : {}),
            // 不在面包屑里显示这一层
            breadcrumbExclude: true,
          };
        },
      },

      // 评论：先用占位配置，部署好 Twikoo 后把 envId 换成真实地址
      // 若暂时不想显示评论区，把下面整段删掉即可
      // comment: {
      //   provider: "Twikoo",
      //   envId: "https://twikoo.example.com",
      // },
      // 组件
      components: {
        // VPBanner 用来做项目页顶部的横幅（标题 + 简介 + 按钮）
        components: ["Badge", "VPCard", "VPBanner"],
      },

      // 站内搜索：纯前端全文搜索，无需后端
      search: {
        indexContent: true,
      },

      // RSS / Atom / JSON Feed
      feed: {
        rss: true,
        atom: true,
        json: true,
        // 让 dev server 也提供 /rss.xml 等订阅地址。
        // 默认 false 时，这些文件只在 build 阶段写进 dist，
        // 开发环境下点击订阅链接会 404（部署后正常，容易误判）。
        // 代价：不热更新，改了内容需重启 dev server 才同步。
        devServer: true,
      },

      // 图标前缀
      icon: {
        prefix: "fa6-solid:",
      },
    },
  },
  {
    // 主题行为选项
    custom: false,
  },
);