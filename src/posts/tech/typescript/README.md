---
title: TypeScript 系统笔记
date: 2025-02-18
category:
  - 技术
tag:
  - TypeScript
  - 前端
  - 类型系统
dir:
  text: TypeScript 系统笔记
  icon: file-code
  order: 1
---

把一个项目从 JavaScript 迁到 TypeScript，最容易走的弯路是**把它当成"带类型的 JS"**——只在函数参数上标几个类型，然后继续按原来的方式写代码。

真正用起来之后会发现，TypeScript 的价值不在"标类型"，而在于**让类型替你推演**：能在写代码的时候就告诉你有哪几种情况没处理、哪个分支永远进不去。这套笔记是我自己重新梳理时留下的记录，按顺序读下来应该能建立起完整的模型。

## 这套笔记怎么读

| 章节 | 内容 | 难度 |
| --- | --- | --- |
| [类型系统全景](/posts/tech/typescript/01-type-system.html) | 结构化类型、类型即集合、什么时候该标注 | 入门 |
| [泛型与类型推导](/posts/tech/typescript/02-generics.html) | 泛型的本质、约束、推导规则、常见误用 | 进阶 |
| [类型体操与工具类型](/posts/tech/typescript/03-type-operations.html) | 条件类型、映射类型、模板字面量、手写工具类型 | 进阶 |
| [工程实践](/posts/tech/typescript/04-engineering.html) | tsconfig 关键选项、严格模式、类型声明、迁移策略 | 实战 |

## 我踩过的几个坑

先放在这里，正文里会展开：

- **以为 `interface` 和 `type` 只是写法不同**——实际上在声明合并、索引签名上的行为并不一样
- **到处写 `any` 来"解决"报错**——结果是类型检查形同虚设，还不如不写
- **过度迷信类型体操**——把类型写得没人看得懂，维护成本远超收益
- **忘了 `strict` 是一组开关**——只开 `strict: true` 并不等于所有检查都开了

## 前置知识

需要能熟练写 ES6+ 的 JavaScript，知道解构、展开、`Promise`、模块这些概念。完全没接触过 TypeScript 也能读，但第一遍可能需要回头查语法。

---

::: tip 关于版本
笔记基于 **TypeScript 5.x**。类型系统本身很稳定，个别语法（比如 `const` 类型参数、装饰器）在 5.x 才有，正文里会标注。
:::
