import { createRequire } from "node:module";
import { viteBundler } from "@vuepress/bundler-vite";
import { defineUserConfig } from "vuepress";
import { getDirname, path } from "vuepress/utils";

import theme from "./theme.js";

const __dirname = getDirname(import.meta.url);

/**
 * 让 Vite 用纯 JS 版 sass，而不是 sass-embedded。
 *
 * 背景：Vite 8 内部的预处理器解析器（nodeResolveWithVite → tryNodeResolve）
 * 无法解析 sass / sass-embedded 这两个包的 exports 字段 —— 它们使用了
 * "简写形式"（顶层直接是 types/node/default，而非标准的 "." 键）。
 * Node 自身的 require.resolve 可以解析，Vite 的解析器不行，于是 Vite 报出
 * 误导性的 "Preprocessor dependency sass-embedded not found"。
 *
 * 另外，真正的 sass-embedded 会 spawn dart 二进制并通过 stdio 管道通信，
 * 在受限环境中会挂起，因此这里坚持使用纯 JS 版 sass。
 *
 * 解决方式：在 resolveId 阶段把这两个裸模块名直接指向磁盘上的绝对路径，
 * 完全跳过 Vite 内部的包解析。
 */
const require_ = createRequire(import.meta.url);

function resolveJsSassEntry() {
  // 依次尝试：别名包（已指向纯 JS sass）、纯 JS sass 本身
  for (const candidate of ["sass-embedded", "sass"]) {
    try {
      return require_.resolve(candidate);
    } catch {
      // 继续尝试下一个
    }
  }
  return null;
}

const forceJsSassPlugin = {
  name: "vuepress-plugin:force-js-sass",
  enforce: "pre",

  resolveId(source) {
    if (source === "sass-embedded" || source === "sass") {
      const entry = resolveJsSassEntry();
      if (entry) return entry;
    }
    return null;
  },
};

export default defineUserConfig({
  base: "/",

  dest: "./dist",

  // 额外样式（纯 CSS，不走 sass）：首屏背景图铺满窗口 + 导航栏覆盖其上
  userStyle:path.resolve(__dirname, "styles/home-hero.css"),

  // 客户端配置：首页首屏的滚动状态类
  clientConfigFile: path.resolve(__dirname, "client.ts"),

  head: [
    // 固定站点标题。VuePress 默认会把标题拼成「页面名 | 站点名」，
    // 而 head 里显式声明的 title 优先级更高（dedupeHead 先出现者胜出），
    // 所以这里写一条就能让所有页面统一显示，不用逐页配置。
    ["title", {}, "十二的小站"],
    // 站点图标：ico 兼容旧浏览器，png 在现代浏览器里更清晰
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "any" }],
    ["link", { rel: "icon", type: "image/png", href: "/favicon-32.png", sizes: "32x32" }],
    ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" }],
    // 在首屏水合之前就给首页打上标记：背景图布局从第一帧就位，不会先闪一下
    // （首页专属样式见 .vuepress/styles/home-hero.css）
    [
      "script",
      {},
      "try{if(location.pathname.replace(/index\\.html$/,'')==='/')document.documentElement.classList.add('shier-hero-route')}catch(e){}",
    ],
  ],

  locales: {
    "/": {
      lang: "zh-CN",
      title: "十二的博客",
      description: "记录学习、思考与生活的地方",
    },
  },

  bundler: viteBundler({
    viteOptions: {
      plugins: [forceJsSassPlugin],
    },
  }),

  theme,

  shouldPrefetch: false,
});
