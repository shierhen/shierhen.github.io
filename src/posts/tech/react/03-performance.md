---
title: React 性能优化
date: 2025-06-26
order: 3
category:
  - 技术
tag:
  - React
  - 前端
  - 性能优化
---

性能优化最容易犯的错是**凭感觉优化**。这一章的主线是：先测量，再定位，最后才动手——而且要知道每个手段的代价。

## 渲染不等于慢

第一件要分清的事：**组件重渲染本身不是问题**。

React 渲染分两个阶段：

| 阶段 | 做什么 | 代价 |
| --- | --- | --- |
| Render | 调用组件函数，算出新的元素树 | 通常很便宜 |
| Commit | 把差异写进真实 DOM | 相对昂贵 |

如果 render 阶段只是算几个变量、返回 JSX，几百次也不会有感知。真正的问题来自：

- **渲染时做了昂贵计算**（大数组排序、复杂转换）
- **渲染导致大量 DOM 变更**
- **渲染频率过高**（每帧都在更新，比如监听 `mousemove` 直接 setState）

所以优化前先问：**慢在 render 还是 commit？**

## 先测量

### React DevTools Profiler

最直接的工具。录制一段操作，看：

- **哪些组件重渲染了**——可能超出你预期
- **为什么重渲染**——DevTools 会标出是 props 变了、state 变了还是父组件渲染
- **每次渲染耗时**——定位真正的大头

一个常见发现是：**大部分组件的渲染时间都在 1ms 以下**，真正拖后腿的往往只有一两个。

### 用 console 粗略统计

临时加一行就能看出渲染次数：

```tsx
function Expensive() {
  console.log("Expensive render");
  // ...
}
```

配合 React DevTools 的 "Highlight updates when components render" 选项，能直观看到哪些区域在闪。

::: tip 开发环境的 StrictMode
`<StrictMode>` 在开发环境会**故意双调用**渲染和 effect，用来暴露副作用问题。所以你看到的次数是生产环境的 2 倍——**别把它当成性能问题的证据**。
:::

## memo：跳过重渲染

`React.memo` 对 props 做**浅比较**，相同就跳过重渲染：

```tsx
const Row = React.memo(function Row({ item }: { item: Item }) {
  return <li>{item.name}</li>;
});
```

它只在下面这种情况有用：**父组件频繁重渲染，而这个组件的 props 大多没变**。

### 为什么经常没效果

因为 props 里只要有**每次渲染都新建的引用**，浅比较就永远失败：

```tsx
// ❌ memo 白写了：style 和 onClick 每次都是新对象
<Row
  item={item}
  style={{ color: "red" }}
  onClick={() => select(item.id)}
/>

// 需要配合 useMemo / useCallback
const style = useMemo(() => ({ color: "red" }), []);
const handleClick = useCallback(() => select(item.id), [item.id]);
<Row item={item} style={style} onClick={handleClick} />
```

**这就是 memo 的隐性成本**：为了让一个 memo 生效，往往要在父组件里加一堆 `useMemo` / `useCallback`。如果对比本身比渲染还贵，就亏了。

### 更省事的做法：把不变的部分传成 children

这是我最推荐的技巧——**避免 memo，直接让 props 稳定**：

```tsx
// ❌ 每次渲染都新建 Expensive 的元素
function Layout() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>{count}</button>
      <Expensive />   {/* 父组件渲染就跟着重渲染 */}
    </div>
  );
}

// ✅ 用 children 传进去，count 变化不影响它
function Layout() {
  const [count, setCount] = useState(0);
  return (
    <Wrapper>
      <Expensive />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>{count}</button>
      {children}   {/* 元素是父组件创建的，这里的重渲染不会重建它 */}
    </div>
  );
}
```

原理是：`children` 作为 props 传进来时，**元素对象引用不变**，React 会直接复用。

## useMemo / useCallback 的正确用法

这两个 Hook 只做一件事：**在依赖不变时复用上一次的结果**。

### useMemo

```tsx
// 值得缓存：开销明显
const sorted = useMemo(
  () => [...items].sort((a, b) => b.score - a.score),
  [items],
);

// 不值得：字符串拼接比 memo 本身还快
const title = useMemo(() => `${first} ${last}`, [first, last]); // ❌
const title2 = `${first} ${last}`; // ✅
```

判断标准：

| 情况 | 用 useMemo |
| --- | --- |
| 大数组过滤/排序/分组 | ✅ |
| 复杂对象转换、递归计算 | ✅ |
| 结果要作为其他 Hook 的依赖 | ✅ |
| 简单算术、字符串拼接 | ❌ |
| 创建 JSX 元素 | ❌（React 元素很便宜） |

### useCallback

```tsx
// 只有当这个函数要传给 memo 组件，或作为 effect 依赖时才需要
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);

// 传给普通 DOM 元素不需要
<button onClick={() => setOpen(true)}>打开</button>  // ✅ 不用 useCallback
```

::: warning useCallback 不保证稳定
React 官方明确说过：**不能依赖 useCallback 来保证引用永远不变**（未来可能为了释放内存而丢弃缓存）。它只是性能提示，不是语义保证。需要语义稳定就用 `useRef`。
:::

## 列表性能

长列表是性能问题的重灾区。两个层面：

### 层面一：key 要稳定

前面提过，这里补充性能角度——**key 变化会导致组件卸载重建**，而不是更新：

```tsx
// ❌ 排序后 key 全变，所有行重建
items.map((item, i) => <Row key={i} item={item} />)

// ✅ 排序后只有位置变，组件复用
items.map((item) => <Row key={item.id} item={item} />)
```

### 层面二：虚拟化

列表上千行时，**只渲染视口内可见的**：

```tsx
import { FixedSizeList } from "react-window";

function BigList({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={48}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  );
}
```

什么时候该上虚拟化？我的经验阈值：

| 行数 | 建议 |
| --- | --- |
| < 100 | 直接渲染，别折腾 |
| 100 ~ 1000 | 先看有没有卡顿，配合分页更好 |
| > 1000 | 虚拟化，或改成分页/无限滚动 |

虚拟化不是免费的——它会带来**滚动条高度、可访问性、SSR 兼容**等一堆细节问题。能用分页解决就别上虚拟化。

## 状态设计带来的性能差异

有时最好的优化是**换个地方放状态**：

```tsx
// ❌ 输入框的值放在顶层，每次输入都重渲染整棵树
function App() {
  const [keyword, setKeyword] = useState("");
  return (
    <div>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <HeavyList />   {/* 无辜被牵连 */}
    </div>
  );
}

// ✅ 把状态下沉到真正需要它的组件
function App() {
  return (
    <div>
      <SearchBox />   {/* 状态在这里，只影响自己 */}
      <HeavyList />
    </div>
  );
}
```

**状态下沉**（colocating state）往往比任何 memo 都有效——因为它从根上减少了重渲染的范围。

## 其他实用手段

### 减少 effect 频率

```tsx
// ❌ 每次滚动都 setState
useEffect(() => {
  const onScroll = () => setY(window.scrollY);
  window.addEventListener("scroll", onScroll);
  return () => window.removeEventListener("scroll", onScroll);
}, []);

// ✅ 用 rAF 节流
useEffect(() => {
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      setY(window.scrollY);
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, []);
```

### 长列表用 content-visibility

现代浏览器支持让浏览器跳过屏幕外元素的渲染，**比虚拟化简单得多**：

```css
.row {
  content-visibility: auto;
  contain-intrinsic-size: 0 48px; /* 提供占位高度，避免滚动条跳动 */
}
```

### 代码分割

用 `lazy` + `Suspense` 把大组件拆出去：

```tsx
const Editor = React.lazy(() => import("./Editor"));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Editor />
    </Suspense>
  );
}
```

这对**首屏时间**的改善远大于任何渲染优化。

## 优化清单

按投入产出比排序：

1. **先测量**——DevTools Profiler 找到真正的瓶颈
2. **状态下沉**——缩小重渲染范围，零成本
3. **用 children 传递不变内容**——避免 memo 的连锁成本
4. **让长列表虚拟化**或用 `content-visibility`
5. **代码分割**——改善首屏
6. **最后才考虑 memo / useMemo / useCallback**，且只针对测量出的大头

::: tip 一句话原则
**没测量过的优化，都是在猜。** 而猜错的时候，你不仅没提速，还让代码更难读了。
:::

## 小结

- 重渲染不等于慢，先分清 render 还是 commit 的问题
- 用 Profiler 定位，别凭感觉
- `memo` 只在 props 稳定时有效，常需配套 `useMemo`/`useCallback`
- 传 `children` 往往比 memo 更划算
- `useMemo`/`useCallback` 有开销，只用在计算昂贵或需要稳定引用处
- 状态下沉是性价比最高的优化
- 长列表优先分页，其次虚拟化

下一章讲并发特性：怎么让"重"的更新不阻塞输入，以及几个值得改掉的反模式。
