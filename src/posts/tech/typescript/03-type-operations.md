---
title: 类型体操与工具类型
date: 2025-02-25
order: 3
category:
  - 技术
tag:
  - TypeScript
  - 前端
  - 类型体操
---

你每天用的 `Partial`、`Pick`、`ReturnType`，全是用这一章的几个原语拼出来的。理解之后，遇到"库的类型不对但我没法改"的情况就有办法了。

## 条件类型：类型层面的 if

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<"hi">;  // true
type B = IsString<42>;    // false
```

语法是 `T extends U ? X : Y`，读作"**如果 T 是 U 的子类型，取 X，否则取 Y**"。注意这里又是 `extends`，依然是"子集"的含义。

### 分布式条件类型

这是最容易踩坑的地方。当条件类型作用在**裸类型参数**上、而传入的是联合类型时，它会**自动分发**到每个成员：

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type R = ToArray<string | number>;
// 结果：string[] | number[]  而不是 (string | number)[]
```

想阻止分发，用方括号把两侧包起来：

```ts
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;

type R2 = ToArrayNonDist<string | number>;
// 结果：(string | number)[]
```

::: tip 分发特性很有用
`Exclude` 和 `Extract` 正是靠它实现的——分发到每个成员逐个判断，天然完成了"过滤"。
:::

### infer：在类型里"取出一部分"

`infer` 用来声明一个待推断的类型变量，是提取类型的关键：

```ts
// 取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>; // string

// 取函数返回值
type MyReturnType<T> = T extends (...args: never[]) => infer R ? R : never;
type R3 = MyReturnType<() => number>; // number

// 取 Promise 内部类型
type Awaited<T> = T extends Promise<infer U> ? U : T;
type R4 = Awaited<Promise<string>>; // string
```

`infer` 的位置决定了"从哪里取"。同一个类型可以放多个 `infer`：

```ts
type First<T> = T extends [infer F, ...unknown[]] ? F : never;
type F1 = First<[1, 2, 3]>; // 1
```

## 映射类型：批量改造属性

映射类型遍历一个类型的所有键，生成新类型：

```ts
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};
```

语法是 `[K in keyof T]`——**把 T 的每个键 K 拿出来，逐个生成**。

### 修饰符：+ 和 -

`readonly` 和 `?` 可以用 `+` / `-` 显式增删：

```ts
// 去掉 readonly
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

// 去掉可选
type Required<T> = {
  [K in keyof T]-?: T[K];
};
```

### key 重映射：as 子句

TypeScript 4.1 之后，可以在映射时改键名：

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

`as ... never` 则可以直接**过滤掉**某些键：

```ts
// 只保留字符串类型的属性
type StringKeys<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

type OnlyStrings = StringKeys<{ a: string; b: number; c: string }>;
// { a: string; c: string }
```

## 模板字面量类型

用反引号在类型层面拼字符串：

```ts
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"
```

配合 `infer` 能做字符串解析：

```ts
type ParseRoute<T> = T extends `/${infer Segment}/${infer Rest}`
  ? Segment | ParseRoute<`/${Rest}`>
  : T extends `/${infer Last}`
    ? Last
    : never;

type Segments = ParseRoute<"/posts/tech/typescript">;
// "posts" | "tech" | "typescript"
```

::: warning 递归深度有上限
类型层面的递归大约到 50 层就会报 " excessively deep "。处理长字符串或深嵌套时要留神。
:::

## 动手实现几个内置工具类型

理解了原语，内置工具类型就不神秘了：

```ts
// 挑选部分键
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// 排除部分键
type MyOmit<T, K extends keyof T> = MyPick<T, Exclude<keyof T, K>>;

// 从联合中排除
type MyExclude<T, U> = T extends U ? never : T;

// 从联合中提取
type MyExtract<T, U> = T extends U ? T : never;

// 非空
type MyNonNullable<T> = T extends null | undefined ? never : T;
```

验证一下 `MyOmit`：

```ts
interface User {
  id: string;
  name: string;
  password: string;
}

type SafeUser = MyOmit<User, "password">;
// { id: string; name: string }
```

## 实战：从 schema 推导类型

一个真实场景——把常量对象的键变成联合类型，避免手写两遍：

```ts
const ROLES = {
  admin: "管理员",
  editor: "编辑",
  viewer: "访客",
} as const;

type Role = keyof typeof ROLES;
// "admin" | "editor" | "viewer"

type RoleLabel = (typeof ROLES)[Role];
// "管理员" | "编辑" | "访客"

function labelOf(role: Role): RoleLabel {
  return ROLES[role];
}
```

`as const` 是关键——它把属性变成只读字面量，否则 `keyof typeof ROLES` 只会得到 `string`。

再进一步，做一个**类型安全的路由参数提取**：

```ts
type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : Record<never, never>;

type Params = ExtractParams<"/user/:id/post/:postId">;
// { id: string; postId: string }
```

## 什么时候该停下来

类型体操是有成本的。我的判断标准：

| 信号 | 建议 |
| --- | --- |
| 一个类型要读 30 秒才懂 | 加注释，或拆成多个中间类型 |
| 报错信息变成天书 | 加一层具名类型"挡"一下 |
| 为了省一次手写而写了 20 行类型 | 直接手写可能更划算 |
| 团队里只有你看得懂 | 重构，或者写文档 |

::: tip 给复杂类型加"减震层"
把复杂的条件类型的结果赋给一个具名 `type`，报错时就会显示这个名字，而不是展开成一坨：

```ts
// ❌ 报错会展开一大串
function f(x: A extends B ? C extends D ? E : F : G) {}

// ✅ 报错只显示 ComplexType
type ComplexType = A extends B ? C extends D ? E : F : G;
function f(x: ComplexType) {}
```
:::

## 小结

- 条件类型是类型层面的 if，**裸类型参数 + 联合会分发**
- `infer` 用来提取内部类型，位置决定取什么
- 映射类型 `[K in keyof T]` 批量改造，`as` 子句可改键名或过滤
- 模板字面量类型让类型层面能拼、能拆字符串
- 内置工具类型都是这几个原语的组合，自己实现一遍就懂了
- **可读性优先**，类型体操是为了省事，不是为了炫技

下一章回到地面：tsconfig 怎么配、严格模式到底开了哪些检查、老项目怎么渐进迁移。
