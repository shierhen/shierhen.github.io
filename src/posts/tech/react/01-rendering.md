---
title: React 渲染模型与状态设计
date: 2025-06-03
order: 1
category:
  - 技术
tag:
  - React
  - 前端
  - 状态管理
---

很多 React 的"奇怪行为"，根源都是没建立起**渲染快照**这个模型。这一章先把模型立起来，再讲状态该怎么放。

## 渲染就是一次函数调用

组件本质是函数：**给定 props 和 state，返回 UI 描述**。

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

关键在于：**每次渲染都是一次独立的函数调用**，它有自己的一份 `count`。这解释了一个经典困惑：

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  };

  return <button onClick={handleClick}>{count}</button>;
}
```

点一下只加 **1**，不是 3。因为三次调用里的 `count` 都是**同一次渲染里的那个值**（假设是 0），三次都在设 `0 + 1`。

想加 3 要用**函数式更新**——它拿到的是"最新待处理状态"：

```tsx
const handleClick = () => {
  setCount((c) => c + 1);
  setCount((c) => c + 1);
  setCount((c) => c + 1);
};
```

::: tip 记住这条规则
**新状态依赖旧状态时，永远用函数式更新。** 这条能消灭一大类竞态 bug。
:::

## 状态更新的批处理

React 18 之前，只有在 React 事件处理函数里的更新会被批处理；`setTimeout`、`Promise` 回调里的不会。React 18 起，**所有更新默认自动批处理**：

```tsx
setTimeout(() => {
  setCount((c) => c + 1);
  setFlag((f) => !f);
  // React 18+：只触发一次重渲染
}, 1000);
```

这几乎总是你想要的。极少数需要"立刻拿到更新后 DOM"的场景才用 `flushSync`：

```tsx
import { flushSync } from "react-dom";

flushSync(() => setCount((c) => c + 1));
// 到这里 DOM 已经更新完了
```

不过用 `flushSync` 通常意味着在做一些命令式的操作，值得先想想有没有更 React 的写法。

## 状态该放在哪里

这是实际项目里最影响代码质量的决定。三个原则：

### 原则一：能推导的不要存

```tsx
// ❌ 冗余状态：两个 state 可能不同步
const [items, setItems] = useState<Item[]>([]);
const [count, setCount] = useState(0);

// ✅ 直接推导
const [items, setItems] = useState<Item[]>([]);
const count = items.length;
```

冗余状态会带来**同步 bug**——忘了更新其中一个，UI 就自相矛盾了。

同样是推导，"每次渲染重算"和"缓存"要分清：

```tsx
// 简单计算：直接算，别包 useMemo
const total = items.reduce((s, i) => s + i.price, 0);

// 昂贵计算：才需要缓存
const sorted = useMemo(() => heavySort(items), [items]);
```

判断标准是**这个计算有没有明显开销**（大数组排序、复杂转换），而不是"它是个计算"。

### 原则二：需要多个组件共享就往上提

两个组件要读同一份数据时，把它提到**最近的共同父节点**：

```tsx
// ❌ 各自持有，改一个另一个不知道
function Panel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Header open={open} onToggle={() => setOpen(!open)} />
      <Body open={open} />
    </>
  );
}

// ✅ 提到父层，两边读同一份
function Header({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button onClick={onToggle}>{open ? "收起" : "展开"}</button>;
}
```

这就是"状态提升"（lifting state up）。代价是 props 要一层层传——层数太多时再考虑 Context 或专门的状态库，**不要一开始就上**。

### 原则三：能不放进 React 的就不放

有些值**不需要触发渲染**，放 `useState` 只会带来无谓的重渲染：

```tsx
// ❌ 每次输入都重渲染整个组件
const [inputValue, setInputValue] = useState("");

// ✅ 用 ref 存，不触发渲染
const inputRef = useRef<HTMLInputElement>(null);
```

典型场景：定时器 ID、DOM 引用、上一次的值、不需要展示的标记位。

## 受控与非受控

表单是这两者的主战场。

**受控组件**——值由 React 管，每次都同步：

```tsx
function Form() {
  const [name, setName] = useState("");
  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
}
```

**非受控组件**——值在 DOM 里，需要时用 ref 读：

```tsx
function Form() {
  const ref = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(ref.current?.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={ref} defaultValue="初始值" />
      <button>提交</button>
    </form>
  );
}
```

::: tip 怎么选
| 需求 | 选择 |
| --- | --- |
| 实时校验、联动、格式化输入 | 受控 |
| 只在提交时取值、表单很大 | 非受控 |
| 文件上传（`<input type="file">`） | 只能非受控 |
:::

非受控组件里初始值用 `defaultValue` 而不是 `value`——写错了会变成只读。

## key 不是普通的 prop

`key` 是 React 用来**识别元素身份**的，不会传进组件：

```tsx
<ListItem key={item.id} item={item} />
// 组件内部读 props.key 是 undefined
```

列表渲染时，**key 必须是稳定且唯一的**。用数组下标做 key 会在增删时出问题：

```tsx
// ❌ 在头部插入时，所有项的 key 都变了
items.map((item, index) => <Row key={index} item={item} />)

// ✅ 用业务 id
items.map((item) => <Row key={item.id} item={item} />)
```

用下标当 key 的后果不只是性能——**组件内部的 state 会错位**。比如每行有个"展开"状态，删掉第一行后，第二行的展开状态会显示在被顶上来的那行。

另一个实用技巧：想**强制重置**一个组件时，改变它的 key：

```tsx
// userId 变化时，Profile 内部状态整体重置
<Profile key={userId} userId={userId} />
```

## 实战：一个可搜索列表

把上面几点串起来——注意哪些是状态、哪些是推导：

```tsx
function SearchableList({ items }: { items: Item[] }) {
  // ✅ 状态：用户输入（真正的源数据）
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");

  // ✅ 推导：过滤结果不需要 state
  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const filtered = kw
      ? items.filter((i) => i.name.toLowerCase().includes(kw))
      : items;
    return [...filtered].sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : b.date - a.date,
    );
  }, [items, keyword, sortBy]);

  return (
    <>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索"
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "date")}>
        <option value="name">按名称</option>
        <option value="date">按时间</option>
      </select>

      <ul>
        {visible.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>

      {visible.length === 0 && <p>没有匹配的结果</p>}
    </>
  );
}
```

这里 `visible` 是**派生值**——它完全由 `items`、`keyword`、`sortBy` 决定，所以不该单独存一份 state。

## 小结

- 每次渲染是独立快照，闭包捕获的是**那一次**的值
- 新状态依赖旧状态时用**函数式更新**
- React 18+ 自动批处理所有更新
- 能推导的别存；需要共享就上提；不需要渲染就用 ref
- 表单按需求选受控/非受控，文件上传只能非受控
- `key` 决定组件身份，别用下标，必要时用它强制重置

下一章深入 Hooks：依赖数组的真正语义、闭包陷阱，以及怎么写出可复用的自定义 Hook。
