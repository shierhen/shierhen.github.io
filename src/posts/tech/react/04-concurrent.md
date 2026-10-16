---
title: 并发特性与实战反模式
date: 2025-06-28
order: 4
category:
  - 技术
tag:
  - React
  - 前端
  - 并发
---

最后一章讲两件事：怎么用并发特性让**交互不被卡住**，以及几个我实际踩过、值得改掉的反模式。

## 并发渲染解决什么问题

先看一个真实场景——搜索框 + 大列表：

```tsx
function App() {
  const [keyword, setKeyword] = useState("");
  const results = searchAll(keyword); // 假设很慢

  return (
    <>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <Results items={results} />
    </>
  );
}
```

输入每个字符都会触发一次全量搜索和渲染。慢的时候，**输入框会明显卡顿**——因为渲染是同步的，浏览器没有机会处理输入事件。

并发渲染的核心思路是：**把更新分成优先级**。输入是"紧急"的，列表更新是"可以等一下"的。

## useTransition：标记非紧急更新

```tsx
function App() {
  const [keyword, setKeyword] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 紧急：让输入框立刻响应
    setKeyword(e.target.value);

    // 非紧急：可以被打断
    startTransition(() => {
      setQuery(e.target.value);
    });
  };

  return (
    <>
      <input value={keyword} onChange={handleChange} />
      {isPending && <span>加载中…</span>}
      <Results query={query} />
    </>
  );
}
```

要点：

- `startTransition` 里的更新**可以被更高优先级的更新打断**
- `isPending` 用来给用户反馈，不要用它替代 loading 状态
- transition **不能**用于受控输入框的 value 更新——那必须是紧急的

### useDeferredValue：延迟某个值

如果只是想"让某个值慢一拍"，用这个更简单：

```tsx
function App() {
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);

  return (
    <>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      {/* 输入框用最新值，列表用延迟值 */}
      <SlowList keyword={deferredKeyword} />
    </>
  );
}
```

和 `useTransition` 的区别：

| | useTransition | useDeferredValue |
| --- | --- | --- |
| 控制方式 | 包住 setState | 包住值 |
| 适用 | 能拿到 setState 的地方 | 值来自 props 或别处 |
| 反馈 | 有 `isPending` | 需要自己比较新旧值 |

::: tip 别忘了 memo
`useDeferredValue` 要生效，接收它的组件最好用 `memo` 包一下，否则父组件重渲染还是会带上它。
:::

## Suspense：声明式的加载状态

```tsx
<Suspense fallback={<Skeleton />}>
  <UserProfile />
</Suspense>
```

配合 `lazy` 做代码分割是最常见的用法，但它也能配合支持 Suspense 的数据方案（React Query、Relay、Next.js 等）统一加载态。

### 嵌套 Suspense 控制粒度

```tsx
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Suspense fallback={<ListSkeleton />}>
    <Comments />   {/* 只有这块等 */}
  </Suspense>
  <Footer />
</Suspense>
```

外层先显示骨架，内层独立加载——用户能更早看到部分内容。

### React 19 的 use

React 19 引入了 `use`，可以在组件里直接读取 Promise：

```tsx
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise); // 会挂起到最近的 Suspense
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}
```

注意 `use` 和普通 Hook 不同，**可以放在条件里**——因为它不依赖调用顺序。

::: warning promise 要提前创建
在组件**内部**创建 Promise 会导致每次渲染都新建一个，从而无限挂起。Promise 必须在组件外部或通过 props 传入。
:::

## 错误边界

`Suspense` 管加载，**错误边界管报错**。它目前还只能用类组件写：

```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("组件崩溃:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

用法：

```tsx
<ErrorBoundary fallback={<p>这块出错了</p>}>
  <RiskyWidget />
</ErrorBoundary>
```

::: warning 错误边界抓不到的情况
- **事件处理函数**里的错误（用 try/catch）
- **异步代码**里的错误（`setTimeout`、`Promise`）
- **服务端渲染**的错误
- 错误边界**自己**抛出的错误
:::

一个建议：**边界要小而多**。整个 App 包一个大边界，一处出错全白屏；每个独立模块包一个，故障就能被隔离。

## 常见反模式

### 反模式一：滥用 Context 传高频变化的值

```tsx
// ❌ 鼠标位置变化会让所有消费者重渲染
const MouseContext = createContext({ x: 0, y: 0 });

function App() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <MouseContext.Provider value={pos}>
      <Everything />
    </MouseContext.Provider>
  );
}
```

Context 的 value 一变，**所有消费者都重渲染**，而且没法用 memo 拦住。

三种解法：

```tsx
// 1. 拆分 Context：把稳定的和不稳定的分开
const ThemeContext = createContext("light");      // 很少变
const MouseContext = createContext({ x: 0, y: 0 }); // 高频

// 2. 状态提升到真正需要的子树

// 3. 高频值别进 React：用 ref + 订阅
```

### 反模式二：props  drilling 五层

```tsx
// ❌ user 一层层传下去，中间组件根本不用
<A user={user}>
  <B user={user}>
    <C user={user}>
      <D user={user} />
    </C>
  </B>
</A>
```

中间组件被迫接收与己无关的 props，重构时非常痛苦。用 **children 组合**解决：

```tsx
// ✅ 直接在最需要的地方渲染
function Page({ user }: { user: User }) {
  return (
    <Layout>
      <Sidebar>
        <UserCard user={user} />
      </Sidebar>
    </Layout>
  );
}
```

### 反模式三：把服务端状态当客户端状态

```tsx
// ❌ 手写 loading / error / 缓存 / 重试
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
useEffect(() => {
  setLoading(true);
  fetch("/api/user")
    .then((r) => r.json())
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

这段代码缺了缓存、去重、重试、聚焦重验证、竞态处理……**手写几乎必然出错**。用 React Query / SWR 这类库：

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["user"],
  queryFn: fetchUser,
});
```

**把"服务端状态"和"UI 状态"分开**是架构上很重要的一步。

### 反模式四：index 当 key（前面提过，但值得重复）

它导致的 bug 通常表现为"删了一行，另一行的输入框内容跳过来了"——而这类问题在代码 review 时几乎看不出来。

### 反模式五：useEffect 里做数据瀑布

```tsx
// ❌ 串行请求，慢且难维护
useEffect(() => { fetchUser().then(setUser); }, []);
useEffect(() => { if (user) fetchPosts(user.id).then(setPosts); }, [user]);
useEffect(() => { if (posts) fetchComments(posts[0].id).then(setComments); }, [posts]);
```

要么并行发起（`Promise.all`），要么在服务端聚合，要么用支持并行加载的数据库。**瀑布式请求是首屏慢的头号原因。**

## 写在最后

回头看这套笔记，React 的难点从来不是 API——API 就那么几个。难的是**顺着它的模型思考**：

- 渲染是快照，不是持续变化的对象
- 状态是数据的唯一来源，能推导的就别存
- 先测量再优化，凭感觉的优化都是猜
- 加载、错误、服务端状态都有对应的抽象，别手写

::: tip 全系列回顾
1. [渲染模型与状态设计](/posts/tech/react/01-rendering.html)——快照、状态提升、受控组件
2. [Hooks 深入](/posts/tech/react/02-hooks.html)——依赖语义、闭包陷阱、自定义 Hook
3. [性能优化](/posts/tech/react/03-performance.html)——测量、memo、虚拟化
4. **并发特性与实战反模式**（本篇）——transition、Suspense、错误边界
:::

写完这两套笔记最大的收获是：**把"会用"和"讲清楚"之间的距离量化了**。很多我以为懂了的地方，一动笔才发现只是记住了写法。
