---
title: TypeScript 工程实践
date: 2025-02-25
order: 4
category:
  - 技术
tag:
  - TypeScript
  - 前端
  - 工程化
---

最后一章回到地面：配置怎么调、严格模式到底开了什么、第三方库没类型怎么办、老项目怎么迁。

## tsconfig 里真正重要的几个选项

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}
```

逐个说明为什么：

### target 与 lib

`target` 决定**编译输出**的语法版本（比如可选链要不要降级），`lib` 决定**能用哪些全局 API 的类型**（比如 `Promise`、`Array.prototype.at`）。两者可以不一致：

```json
{
  "target": "ES2022",
  "lib": ["ES2023", "DOM", "DOM.Iterable"]
}
```

### moduleResolution: "bundler"

前端项目用打包器时选这个。它支持 `package.json` 的 `exports` 字段、允许省略扩展名，行为和 Vite / webpack 一致。老项目里的 `"node"` 已经过时了。

### skipLibCheck: true

跳过 `node_modules` 里 `.d.ts` 的类型检查。**建议开启**——第三方库之间的类型冲突不该由你买单，开了能显著加快编译。它不影响你自己代码的检查。

### isolatedModules: true

要求每个文件都能**独立编译**。这是打包器（esbuild / SWC / Vite）的工作前提，因为它们逐文件转译、看不到全局类型信息。

开了之后要注意：`export type` 必须显式写 `type`，否则打包器不知道那是类型还是值。

## strict 到底包含哪些检查

`strict: true` 不是"一个开关"，而是**一组开关的合集**。知道每个是干什么的，才知道报错在提醒什么：

| 选项 | 拦截的问题 |
| --- | --- |
| `noImplicitAny` | 参数没标类型且推不出来时隐式变成 `any` |
| `strictNullChecks` | `null` / `undefined` 不能赋给其他类型 |
| `strictFunctionTypes` | 函数参数**逆变**检查（更严格） |
| `strictBindCallApply` | `bind` / `call` / `apply` 的参数类型检查 |
| `strictPropertyInitialization` | 类属性必须在构造函数里初始化 |
| `noImplicitThis` | `this` 类型不明确时报错 |
| `alwaysStrict` | 输出里始终带 `"use strict"` |

::: warning 严格模式之外还有几个值得单开
`strict` **不包含**下面这些，但它们在真实项目里很有价值：

- `noUncheckedIndexedAccess`——`arr[0]` 的类型变成 `T | undefined`，逼你处理越界
- `exactOptionalPropertyTypes`——区分"属性不存在"和"属性值是 undefined"
- `noImplicitOverride`——重写父类方法必须写 `override`
- `noFallthroughCasesInSwitch`——`switch` 漏写 `break`
:::

`noUncheckedIndexedAccess` 特别值得开。它会带来一批报错，但每一个报错都对应一个**真实存在的崩溃可能**：

```ts
const arr: string[] = [];
const first = arr[0];
// 开了之后：string | undefined

// 逼你写清楚
if (first !== undefined) {
  console.log(first.toUpperCase());
}

// 或者用 at() + 明确断言
const first2 = arr.at(0)!;
```

## 类型声明：第三方库没类型怎么办

### 优先级顺序

1. **库自带类型**（`package.json` 的 `types` 字段，或同目录 `index.d.ts`）——直接用
2. **`@types/xxx`**——到 [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) 找
3. **自己写声明**——前两条都没有时

装 `@types` 包要注意它和库的**大版本要对应**：`@types/foo@2` 配 `foo@2`。

### 自己写模块声明

```ts
// src/types/legacy-lib.d.ts
declare module "legacy-lib" {
  export interface Options {
    timeout?: number;
  }

  export function init(options?: Options): void;
  export function send(data: unknown): Promise<void>;

  const _default: { init: typeof init; send: typeof send };
  export default _default;
}
```

### 给全局变量声明类型

比如某些脚本通过 `<script>` 注入了全局对象：

```ts
// src/types/global.d.ts
declare global {
  interface Window {
    __APP_CONFIG__: {
      apiBase: string;
      version: string;
    };
  }
}

export {}; // 有 import/export 时，必须加这行才能让 declare global 生效
```

::: warning 不要滥用 declare
`declare` 是**纯类型层面的承诺**，编译器会完全相信你，运行时没有任何保证。声明写错了，问题会推迟到线上才爆。写的时候务必对着真实实现核对。
:::

## 从 JavaScript 渐进迁移

**不要一次性全改**。可行的路线：

### 第一步：allowJs + checkJs 打开检查

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false
  }
}
```

`allowJs` 让 JS 文件能被引用，`checkJs: false` 表示先不检查它们。这样可以在 TS 文件里逐步引用老 JS 模块。

### 第二步：从"叶子"开始改造

依赖图里**最底层、被引用最多**的模块优先改——工具函数、常量、类型定义。它们稳了，上层才有可靠的基础。

### 第三步：按文件打开 checkJs

可以用注释让单个文件先接受检查：

```js
// @ts-check

/** @type {import("./types").User} */
const user = getUser();
```

JSDoc 注释在 JS 文件里同样能提供类型，适合"暂时不想改成 .ts"的场景。

### 第四步：用 unknown 代替 any 过渡

迁移中最常见的妥协是 `any`。更好的中间态是 `unknown`——**它会逼你收窄类型**，而 `any` 会一路污染下去：

```ts
// ❌ any 会传染
function handle(data: any) {
  return data.foo.bar; // 一路绿灯，运行时炸
}

// ✅ unknown 强制收窄
function handle(data: unknown) {
  if (typeof data === "object" && data !== null && "foo" in data) {
    // 这里才开始能访问
  }
}
```

## 写在最后

回头看这套笔记，最有价值的其实不是某个具体语法，而是**"类型是取值的集合"**这个模型。条件类型、映射类型、泛型约束，全都是在这个模型上做推演。

用 TypeScript 几年下来，我的体会是：

- **类型是写给自己和未来的**。三个月后回来改代码时，类型就是最好的文档
- **不要和编译器较劲**。它报错的时候，八成确实有没想到的情况
- **但也别被它绑住**。偶尔一个 `as` 或 `@ts-expect-error` 是合理的——关键是留下注释说明为什么

::: tip 全系列回顾
1. [类型系统全景](/posts/tech/typescript/01-type-system.html)——类型即集合、结构化类型
2. [泛型与类型推导](/posts/tech/typescript/02-generics.html)——约束、推导规则、常见误用
3. [类型体操与工具类型](/posts/tech/typescript/03-type-operations.html)——条件/映射/模板字面量
4. **工程实践**（本篇）——配置、声明、迁移
:::
