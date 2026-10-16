import { navbar as defineNavbar } from "vuepress-theme-hope";

export const navbar = defineNavbar([
  "/",
  {
    text: "文章",
    icon: "pen-to-square",
    prefix: "/posts/",
    children: [
      {
        text: "技术",
        icon: "code",
        prefix: "tech/",
        children: [
          // 两个多篇系列：link 指向各自的 README（系列目录页）
          { text: "TypeScript 系统笔记", icon: "file-code", link: "typescript/" },
          { text: "React 进阶笔记", icon: "react", link: "react/" },
          { text: "用 VuePress 搭博客", icon: "blog", link: "vuepress-setup" },
          { text: "Astro 还是 VuePress", icon: "code-compare", link: "astro-vs-vuepress" },
        ],
      },
      {
        text: "随笔",
        icon: "feather",
        prefix: "life/",
        children: ["hello-world"],
      },
    ],
  },
  {
    text: "项目",
    icon: "code",
    link: "/projects/",
  },
  {
    text: "归档",
    icon: "folder",
    children: [
      { text: "分类", icon: "folder", link: "/category/" },
      { text: "标签", icon: "tags", link: "/tag/" },
      { text: "时间线", icon: "timeline", link: "/timeline/" },
    ],
  },
  {
    text: "关于",
    icon: "circle-info",
    children: [{ text: "关于我", icon: "user", link: "/intro.html" }],
  },
]);