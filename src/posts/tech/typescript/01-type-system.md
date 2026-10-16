---
title: TypeScript 类型系统全景
date: 2025-02-20
order: 1
category:
  - 技术
tag:
  - TypeScript
  - 前端
  - 类型系统
---

第一章不急着讲语法，先把**类型系统的心智模型**建立起来。模型对了，后面那些看起来奇怪的报错都会变得可以解释。

## 类型是什么：一份"取值的集合"

最有用的一个理解方式是：**一个类型就是一组允许的取值**。

```ts
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
```

`Digit` 这个类型对应的集合就是十个数字。`string` 是所有字符串的集合，`boolean` 是 `{ true, false }` 这个两元素集合。

这个视角能直接解释几件事：

| 现象 | 用集合解释 |
| --- | --- |
| `string` 能赋给 `string | number` | 子集可以赋给超集 |
| `never` 能赋给任何类型 | 空集是任何集合的子集 |
| `any` 和谁都能互相赋值 | 它同时是"所有集合"和"不检查" |
| 联合类型只能访问公共成员 | 只有交集部分对所有取值都成立 |

赋值的方向永远是**从窄到宽**：`Digit` 可以给 `number`，反过来不行。

## 结构化类型：形状对就行

TypeScript 用的是**结构化类型**（structural typing），不是名义类型（nominal typing）。判断两个类型兼不兼容，看的是**结构**，不是名字。

```ts
interface Point {
  x: number;
  y: number;
}

function print(p: Point) {
  console.log(p.x, p.y);
}

// 没有 implements Point，一样能用
const v = { x: 1, y: 2, z: 3 };
print(v); // ✅
```

`v` 多了一个 `z`，依然能传给 `print`。这不是 bug，而是结构化类型的核心：**只要具备所需的成员，就满足要求**（多出来的成员在直接传对象字面量时会触发额外检查，见下文"多余属性检查"）。

### 为什么这件事很重要

它带来两个实际影响：

**好的一面**：不用为了类型兼容去搞继承体系，鸭子类型能直接工作。写库的时候，只要参数形状对得上，用户传什么实现都行。

**需要小心的一面**：两个语义完全不同但结构相同的类型会互相兼容。

```ts
interface UserId {
  value: string;
}

interface OrderId {
  value: string;
}

const uid: UserId = { value: "u1" };
const oid: OrderId = uid; // ✅ 不报错，但很可能不是你想要的
```

要区分它们，得引入**名义类型的伪装**——加一个不会被真正使用的私有标记：

```ts
declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

const uid = "u1" as UserId;
const oid: OrderId = uid; // ❌ 类型不兼容
```

这个技巧叫 **branded type**（品牌类型），在处理 ID、金额、单位这类"底层都是 string/number 但语义不同"的场景里非常有用。

## 什么时候该标注类型

新手常见的问题是**标得太多**。TypeScript 的推导能力很强，很多地方写了反而是噪音。

**应该标**：

- **函数参数**——推导不出来，必须标
- **函数返回值**（公共 API、导出的函数）——防止实现改动时悄悄改变对外契约
- **复杂对象的初始值**——推导结果可能不是你想要的
- **导出的常量**——同上

**可以省**：

- **局部变量**——能从初始化值推出来
```ts
const name = "十二";     // string，不用写
const list = [1, 2, 3];  // number[]，不用写
```
- **回调参数**——上下文类型（contextual typing）会帮你推
```ts
[1, 2, 3].map((n) => n * 2); // n 自动是 number
```

::: tip 一个实用判断
如果你发现自己写了类型之后，编译器还要报"不能用"，说明类型写错了而不是代码写错了——先看推导出来的实际类型，再决定要不要标注。
:::

## 多余属性检查

前面说 `v` 能传给 `print`，但下面这段会报错：

```ts
print({ x: 1, y: 2, z: 3 }); // ❌ Object literal may only specify known properties
```

**直接传对象字面量**时，TypeScript 会额外做一次"多余属性检查"。这是一道**防拼写错误**的防线：

```ts
interface Config {
  timeout: number;
  retries: number;
}

// 拼错了 timeout，如果没这个检查就会静默失效
const c: Config = { timeOut: 3000, retries: 3 }; // ❌ 立刻报错
```

想绕过它，标准做法是先赋给变量（此时走结构化类型的常规规则）：

```ts
const raw = { timeout: 3000, retries: 3, extra: true };
const c: Config = raw; // ✅
```

## 类型断言不是转换

`as` 只是**告诉编译器"相信我"**，运行时不会做任何转换：

```ts
const input = document.querySelector("input") as HTMLInputElement;
input.value = "hi";
```

如果那个元素实际是 `div`，这里运行时照样会炸。更好的写法是用类型守卫：

```ts
const el = document.querySelector("input");
if (el instanceof HTMLInputElement) {
  el.value = "hi"; // 这里是安全的
}
```

**能用守卫就别用断言**。断言是"我比你懂"，守卫是"让编译器也懂"——后者在重构时能持续保护你。

## 小结

- 类型 = 取值的集合，赋值永远从窄到宽
- 结构化类型看形状不看名字；需要区分语义时用 branded type
- 参数和返回值该标，局部变量交给推导
- 对象字面量有多余属性检查，这是防拼写错误的好东西
- `as` 不做转换，优先用类型守卫

下一章讲泛型——它是把上面这套模型"参数化"的工具。
