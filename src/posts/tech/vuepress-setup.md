---
title: 用 VuePress 2 + theme-hope 搭一个博客
date: 2025-01-20
star: true
category:
  - 技术
tag:
  - VuePress
  - 建站
  - 前端
---

记录一下搭建过程，以及几个容易踩的坑。

## 最大的坑：版本标签

直接 `npm install vuepress` 会装到 **1.9.10**——Vue 2 时代的老版本，因为 npm 的 `latest` 标签还指向它。

现在的 VuePress 2 挂在 `next` 标签上：

```bash
pnpm add -D vuepress@next
```

::: warning 注意
网上大量中文教程是 1.x 时代的，照抄会一路报错。看文档认准 [v2.vuepress.vuejs.org](https://v2.vuepress.vuejs.org/)。
:::

## 开启博客功能

theme-hope 的博客功能**默认是关闭的**，必须显式打开：

```ts
export default hopeTheme({
  plugins: {
    blog: true,
  },
});
```

打开之后才会生成分类页、标签页和时间线。

## 深色模式

主题自带，一行配置即可：

```ts
export default hopeTheme({
  darkmode: "switch", // 亮色 / 暗色 / 跟随系统
});
```

## 遇到的一个环境问题

pnpm 12 会把「store 操作锁」写在全局目录下。如果这个目录不可写，安装会直接失败：

```text
ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK
Failed to open the store operation lock at "...\pnpm-store-operation-locks\all-stores.lock"
```

换用 npm 并把缓存指到项目内即可绕过：

```bash
npm install --cache ./.npm-cache
```

## 小结

| 项目 | 选择 |
| --- | --- |
| 框架 | VuePress 2 (rc.31) |
| 主题 | vuepress-theme-hope (rc.110) |
| 打包 | Vite |
| 部署 | 静态托管 |

整体体验：配置项很多，但**一旦配好就基本不用再管**，可以专心写内容。
