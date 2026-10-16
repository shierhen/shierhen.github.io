---
title: Hooks 深入
date: 2025-06-26
order: 2
category:
  - 技术
tag:
  - React
  - 前端
  - Hooks
---

Hooks 的坑大多集中在两处：**依赖数组的语义**和**闭包捕获**。把这两件事想清楚，`useEffect` 就不再玄学。

## Hooks 的规则从哪来

两条规则：**只能在顶层调用**、**只能在 React 函数里调用**。

原因在于实现方式：React 靠**调用顺序**把 Hooks 和内部状态对应起来。

```tsx
function C() {
  const [a] = useState(0); // 第 1 个 Hook → 状态槽 1
  const [b] = useState(0); // 第 2 个 Hook → 状态槽 2
}
```

如果放进条件里，顺序就可能错位，第二个 Hook 就会读到第一个的状态：

```tsx
// ❌ 条件分支会让顺序不稳定
if (cond) {
  useEffect(() => {}, []);
}
```

这不是"约定"，而是**调用顺序即身份**这一机制的必然结果。

## 依赖数组的真正语义

`useEffect(fn, deps)` 的准确含义是：

> 每次渲染后，比较 `deps` 和上次的值；**有变化**就执行 `fn`（并先执行上一次的清理函数）。

所以：

| 写法 | 含义 |
| --- | --- |
| 不写第二个参数 | 每次渲染后都执行 |
| `[]` | **没有依赖**——只在挂载后执行一次（清理在卸载时） |
| `[a, b]` | `a` 或 `b` 变化时执行 |

`[]` 读作"无依赖"而不是"只跑一次"，这个区别在闭包问题上很关键。

### 依赖是浅比较

对象和函数每次渲染都是新引用，放进依赖会导致**每次都执行**：

```tsx
// ❌ options 每次渲染都是新对象
function Search({ query }: { query: string }) {
  const options = { q: query, limit: 10 };

  useEffect(() => {
    fetchSearch(options);
  }, [options]); // 永远在跑
}
```

三种解法：

```tsx
// 1. 把依赖拆到基本类型
useEffect(() => {
  fetchSearch({ q: query, limit: 10 });
}, [query]);

// 2. 移到组件外（不依赖 props 的部分）
const BASE_OPTIONS = { limit: 10 };

// 3. 确实需要稳定引用时用 useMemo
const options = useMemo(() => ({ q: query, limit: 10 }), [query]);
```

优先用第 1 种——**依赖越少越简单**。

::: tip 不要对 linter 撒谎
`react-hooks/exhaustive-deps` 警告时，正确做法是**改代码结构**，而不是把依赖删掉。删依赖换来的是"看起来不跑了"，实际埋下读到旧值的雷。
:::

## 闭包陷阱

这是 Hooks 里最经典的 bug：

```tsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // 永远打印 0
    }, 1000);
    return () => clearInterval(id);
  }, []); // 没有依赖 → 闭包锁在首次渲染

  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

因为 `[]` 意味着这个 effect 不会重建，回调里捕获的 `count` 永远是首次渲染那个。

### 解法一：函数式更新（不需要读旧值）

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1); // 不读外部 count
  }, 1000);
  return () => clearInterval(id);
}, []);
```

### 解法二：把值放进依赖

```tsx
useEffect(() => {
  const id = setInterval(() => {
    console.log(count);
  }, 1000);
  return () => clearInterval(id);
}, [count]); // count 变化就重建
```

代价是定时器被反复重建。如果重建成本高，用下面的解法三。

### 解法三：用 ref 保存最新值

```tsx
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value; // 每次渲染都更新
  return ref;
}

function Timer() {
  const [count, setCount] = useState(0);
  const countRef = useLatest(count);

  useEffect(() => {
    const id = setInterval(() => {
      console.log(countRef.current); // 永远是最新值
    }, 1000);
    return () => clearInterval(id);
  }, []); // 依赖为空，定时器只建一次
}
```

这个 `useLatest` 模式非常实用。注意 `ref.current = value` 写在渲染期间——对 ref 来说这是**安全的**，因为它不参与 UI 输出。

## 清理函数

`useEffect` 返回的函数在**两种时机**执行：依赖变化时（执行上一次的）、组件卸载时。

漏写清理是内存泄漏和竞态的主要来源：

```tsx
// ❌ 组件卸载后 setState，且请求可能乱序返回
useEffect(() => {
  fetch(`/api/user/${userId}`).then((r) => r.json()).then(setUser);
}, [userId]);

// ✅ 用标志位防止过期请求覆盖
useEffect(() => {
  let cancelled = false;

  fetch(`/api/user/${userId}`)
    .then((r) => r.json())
    .then((data) => {
      if (!cancelled) setUser(data);
    });

  return () => {
    cancelled = true;
  };
}, [userId]);
```

**快速切换 userId 时**，先发的请求可能后返回。没有这个标志位，页面就会显示错的人——这类 bug 很难复现，但原理很简单。

更现代的写法是用 `AbortController`：

```tsx
useEffect(() => {
  const ac = new AbortController();

  fetch(`/api/user/${userId}`, { signal: ac.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => {
      if (e.name !== "AbortError") throw e;
    });

  return () => ac.abort();
}, [userId]);
```

## 什么时候不该用 useEffect

`useEffect` 经常被用在不该用的地方。几个典型：

### 反例一：用 effect 同步派生状态

```tsx
// ❌ 多余的一次渲染，还可能闪烁
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// ✅ 直接算
const fullName = `${first} ${last}`;
```

### 反例二：用 effect 响应事件

```tsx
// ❌ 用状态变化"触发"一个动作
useEffect(() => {
  if (submitted) postForm();
}, [submitted]);

// ✅ 直接在事件处理函数里做
const handleSubmit = () => postForm();
```

判断标准：**这个逻辑是因为"用户做了什么"而跑，还是因为"组件显示出来了"而跑？** 前者属于事件处理函数。

### 反例三：初始化只跑一次的数据

如果初始化是**纯计算**，直接写在渲染里或用 `useState` 的惰性初始值：

```tsx
// ❌ 多一次渲染
const [data, setData] = useState(null);
useEffect(() => setData(expensiveInit()), []);

// ✅ 惰性初始值，只在首次渲染时算
const [data, setData] = useState(() => expensiveInit());
```

## 自定义 Hook

自定义 Hook 就是**以 `use` 开头、内部调用了其他 Hook 的函数**。它是复用**逻辑**（不是复用 UI）的手段。

### 例子：useDebounce

```tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

// 用法：输入停止 300ms 后才触发搜索
function Search() {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);

  useEffect(() => {
    if (debouncedKeyword) search(debouncedKeyword);
  }, [debouncedKeyword]);

  return <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />;
}
```

### 例子：useLocalStorage

```tsx
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 隐私模式下可能抛错，忽略
    }
  }, [key, value]);

  return [value, setValue] as const;
}
```

::: warning 自定义 Hook 的返回值
返回数组时用 `as const`（或显式标注元组类型），否则会被推导成联合类型的数组，解构出来类型就丢了。
:::

### 自定义 Hook 的命名与边界

- **必须以 `use` 开头**——linter 靠这个判断是否需要检查 Hooks 规则
- 一个 Hook 只做一件事。名字里出现"and"通常意味着该拆
- Hook 之间可以互相调用，这是组合的基础

## 小结

- Hooks 靠调用顺序识别状态，所以必须在顶层
- 依赖数组是**浅比较**；`[]` 表示"无依赖"
- 闭包陷阱的三种解法：函数式更新、放依赖、ref 保存最新值
- 有副作用的都要清理；异步请求要处理竞态
- 能用事件处理函数或直接计算解决的，别用 `useEffect`$
- 自定义 Hook 复用逻辑，命名必须以 `use` 开头

下一章讲性能——先学会**测量**，再决定优化什么。
