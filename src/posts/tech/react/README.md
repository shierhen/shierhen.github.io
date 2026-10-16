---
title: React 进阶笔记
date: 2025-06-01
category:
  - 技术
tag:
  - React
  - 前端
  - 组件化
dir:
  text: React 进阶笔记
  icon: react
  order: 2
---

React 上手很容易——会写 JSX、会 `useState` 就能做出东西。但**"能跑"和"跑得对"之间有一大段距离**：状态该放哪、什么时候会重复渲染、闭包为什么拿到旧值、`useEffect` 的依赖数组到底该写什么。

这套笔记讲的是后面这一段。

## 这套笔记怎么读

| 章节 | 内容 | 难度 |
| --- | --- | --- |
| [渲染模型与状态设计](/posts/tech/react/01-rendering.html) | 渲染快照、状态提升、派生状态、受控与非受控 | 入门 |
| [Hooks 深入](/posts/tech/react/02-hooks.html) | 依赖数组、闭包陷阱、清理函数、自定义 Hook | 进阶 |
| [性能优化](/posts/tech/react/03-performance.html) | 重渲染分析、memo、useMemo、列表与虚拟化 | 进阶 |
| [并发特性与实战](/posts/tech/react/04-concurrent.html) | transition、Suspense、错误边界、常见反模式 | 实战 |

## 先说三个最常见的误解

- **"`setState` 之后 state 立刻变了"**——不会。你在当次渲染里拿到的永远是**那一次的快照**
- **"`useEffect` 依赖数组留着空 `[]` 就是只跑一次"**——语义上是"没有依赖"，不是"只跑一次"，闭包问题就出在这
- **"`useMemo` 能提升性能"**——它本身有开销；用错地方反而更慢

## 前置知识

需要熟悉 ES6+ 语法、组件和 props 的基本用法、`useState` / `useEffect` 会用但说不清细节。笔记基于 **React 18/19**，用函数组件 + Hooks 写法，不涉及类组件。

---

::: tip 关于示例
示例都用函数组件写，省略了 import。涉及到 React 19 新特性（如 `use`、Actions）的地方会明确标注版本。
:::
