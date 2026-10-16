import { defineClientConfig } from "vuepress/client";
import type { RouterScrollBehavior } from "vue-router";

/**
 * 首页首屏效果：背景图铺满整个窗口（含导航栏所在的那一条），
 * 向下滚动后，导航栏恢复为吸附在顶端的实体样式。
 *
 * 状态类（维护在 <html> 上，配合 src/.vuepress/styles/home-hero.css 使用）：
 *   shier-hero-route     当前路由是首页（config.ts 的 head 内联脚本会提前加上，
 *                        避免水合前首屏布局闪一下）
 *   shier-hero-overlay   还停留在首屏，导航栏透明覆盖在背景图上
 */

/** 滚过多少像素后，导航栏从透明恢复为实体吸附样式 */
const OVERLAY_SCROLL_LIMIT = 60;

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  /**
   * 关掉浏览器的「原生滚动恢复」。
   *
   * 它是刷新后自动跳回上次位置的元凶：浏览器默认（auto）在重新加载时
   * 直接恢复 scrollY，而这一步发生在 SPA 内容渲染之前，页面又高又空，
   * 结果就落在一个奇怪的位置上。
   *
   * 改成 manual 后，滚动位置的记忆完全交给 vue-router 处理：
   * 站内前进/后退依然能回到原位（vue-router 自己记），刷新则回到顶部。
   */
  window.history.scrollRestoration = "manual";
}

export default defineClientConfig({
  enhance({ router }) {
    /**
     * 本次加载是否还没发生过正常的路由跳转。
     *
     * 即使是首次进入（刷新/直接打开），vue-router 也会把
     * history.state.scroll（上次离开时存的位置）当作 savedPosition 传进来，
     * 而 VuePress 默认的 scrollBehavior 是「有就用」——于是刷新会跳回上次的位置。
     * 这个标记用来把「首次进入」和「真正的前进/后退」区分开。
     */
    let isInitialNavigation = true;

    const scrollBehavior: RouterScrollBehavior = (to, _from, savedPosition) => {
      // 首次进入（刷新 / 直接打开）：回到顶部；带锚点则定位到锚点
      if (isInitialNavigation) {
        isInitialNavigation = false;
        return to.hash ? { el: to.hash } : { top: 0 };
      }

      // 站内前进 / 后退：沿用 vue-router 记住的位置
      if (savedPosition) return savedPosition;

      // 站内点击链接进入新页面：回到顶部
      if (to.hash) return { el: to.hash };
      return { top: 0 };
    };

    router.options.scrollBehavior = scrollBehavior;

    // enhance 只在浏览器端执行（SSR 不运行），可以放心使用 DOM API
    if (typeof document === "undefined" || !document.body) return;

    const root = document.documentElement;
    const body = document.body;

    const isHome = () => {
      const path = router.currentRoute.value.path;
      return path === "/" || path === "/index.html";
    };

    const sync = () => {
      const home = isHome();
      root.classList.toggle("shier-hero-route", home);
      root.classList.toggle(
        "shier-hero-overlay",
        home &&
          window.scrollY <= OVERLAY_SCROLL_LIMIT &&
          document.querySelector(".vp-blog-mask") !== null,
      );
    };

    // 路由切换后 DOM 更新完毕，再同步一次状态
    router.afterEach(() => requestAnimationFrame(sync));

    // 监听滚动/尺寸变化；MutationObserver 兜底开发模式（页面在挂载后才出现）
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    new MutationObserver(() => requestAnimationFrame(sync)).observe(body, {
      childList: true,
      subtree: true,
    });

    sync();
  },
});
