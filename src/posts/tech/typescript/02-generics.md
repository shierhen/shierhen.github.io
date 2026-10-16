---
title: 泛型与类型推导
date: 2025-02-23
order: 2
category:
  - 技术
tag:
  - TypeScript
  - 前端
  - 泛型
---

泛型不是"高级语法糖"，它是把上一章那套"类型即集合"的模型**参数化**的工具。理解它之后，很多库的类型签名会突然变得可读。

## 泛型的本质：类型的函数

普通函数是"值 → 值"，泛型是"类型 → 类型"。

```ts
function identity<T>(value: T): T {
  return value;
}
```

把它读成：**给定一个类型 T，返回一个签名为 `(value: T) => T` 的函数**。调用时 T 由实参推导：

```ts
identity("hi");   // T = string
identity(42);     // T = number
identity([1, 2]); // T = number[]
```

关键在于 `T` 是**占位符**，它在每次调用时被替换成具体类型，而且**同一个 T 出现多次时会保持一致**——这才是泛型真正提供的信息量：输入和输出的关系。

## 不写泛型会怎样

对比一下三种写法，感受差别：

```ts
// 1. 写死：只能处理 string
function firstString(arr: string[]): string | undefined {
  return arr[0];
}

// 2. 用 any：能跑，但信息全丢了
function firstAny(arr: any[]): any {
  return arr[0];
}

// 3. 泛型：保留了"输入元素类型 = 输出类型"的关系
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]); // number | undefined
const s = first(["a"]);     // string | undefined
```

`any` 的问题是**信息单向丢失**：传进去之后，类型系统就再也帮不上忙了。泛型则把关系一路传递下去。

## 约束：用 extends 限定范围

裸的 `T` 什么都接受，用不了任何属性。想访问成员就得加约束：

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest("abc", "de");      // ✅ string 有 length
longest([1, 2], [3]);      // ✅ 数组有 length
longest(1, 2);             // ❌ number 没有 length
```

这里的 `extends` 读作"**T 必须是……的子类型**"，正好对应集合论里的子集关系。注意它和类继承的 `extends` 是两回事，只是复用了关键字。

### 用 keyof 约束到"必须是某个对象的键"

这是最常见的实战模式：

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "十二", age: 20 };

get(user, "name");  // string
get(user, "age");   // number
get(user, "email"); // ❌ 编译期就拦住了
```

`K extends keyof T` 保证了 key 一定是真实存在的键，返回值 `T[K]` 则是**精确的**那个属性类型——不是 `string | number` 的联合，而是调用时传入哪个就得到哪个。这个模式叫**索引访问类型**，是写工具类型的基础。

## 推导规则：从哪里来，到哪里去

TypeScript 推导泛型参数时，只看**实参**，不看函数体。几个容易困惑的场景：

### 场景一：T 出现在多处时取"最宽"的公共类型

```ts
function pair<T>(a: T, b: T): [T, T] {
  return [a, b];
}

pair(1, "a"); // T 推导为 string | number
```

反直觉的地方在于：编译器不会报错，而是**取联合**。如果你希望它报错（要求两个类型一致），得用两个参数把它们绑起来：

```ts
function strictPair<T>(a: T, b: T): [T, T] {
  return [a, b];
}
// 或者干脆禁止混合
function samePair<T, U extends T>(a: T, b: U): [T, U] {
  return [a, b];
}
```

### 场景二：返回值的上下文也会参与推导

```ts
const result: string[] = []; // 这里不是泛型推导，但同样的机制
```

更典型的是这种：

```ts
function createArray<T>(length: number, value: T): T[] {
  return Array.from({ length }, () => value);
}

const arr = createArray(3, "x"); // string[]
```

### 场景三：推导不出来就得显式指定

```ts
function empty<T>(): T[] {
  return [];
}

const a = empty();        // unknown[]
const b = empty<string>(); // string[]
```

没有实参可供推导时，T 会退化成 `unknown`。这时候必须显式传类型参数。

## 默认类型参数

像函数默认值一样，泛型也能给默认值：

```ts
interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

type Plain = ApiResponse;            // data: unknown
type UserResp = ApiResponse<User>;   // data: User
```

这条特性在写组件 Props、请求封装时特别省事——**默认安全，需要时再具体化**。

## 常见误用

### 误用一：把泛型当"万能 any"

```ts
// ❌ 这个泛型没有任何约束作用
function log<T>(value: T): void {
  console.log(value);
}
```

`T` 只出现一次、且不参与任何约束时，它和 `unknown` 等价，不如直接写 `unknown` 更诚实。

**判断标准**：泛型至少要出现两次，或者用于建立输入与输出之间的关系。

### 误用二：该用联合类型却用了泛型

```ts
// ❌ 过度设计
function format<T extends string | number>(v: T): string {
  return String(v);
}

// ✅ 直接写联合类型
function format(v: string | number): string {
  return String(v);
}
```

### 误用三：在箭头函数里用泛型忘了加逗号

```ts
// ❌ 被解析成 JSX 标签
const f = <T>(x: T) => x;

// ✅ 加个逗号消歧义（.tsx 文件里必须这么写）
const g = <T,>(x: T) => x;
```

在 `.ts` 文件里通常没问题，但在 `.tsx` 里必须加逗号。

## 实战：一个类型安全的请求封装

把上面的东西串起来：

```ts
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<ApiResponse<T>>;
}

interface User {
  id: string;
  name: string;
}

// 调用处直接拿到类型
const resp = await request<User>("/api/user/1");
console.log(resp.data.name); // string
```

::: warning 注意这里的 as
`res.json()` 返回 `Promise<any>`，所以这里用 `as` 把类型"接"回来。严格来说运行时没有任何校验——**类型声明不等于运行时数据合法**。要真正安全，得配 schema 校验库（zod、valibot 之类）做一次运行时验证。
:::

## 小结

- 泛型是"类型 → 类型"的函数，核心价值是表达**输入与输出的关系**
- `extends` 做约束，`keyof` 约束到键，`T[K]` 取出精确类型
- 推导只看实参；推不出来时退化成 `unknown`，需显式指定
- 默认类型参数让 API "默认安全、按需具体"
- 泛型至少出现两次才有意义，否则不如用联合类型或 `unknown`

下一章进入类型体操：条件类型、映射类型，以及怎么手写那些你天天在用的工具类型。
