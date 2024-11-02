## 思考

React 更新的流程？
React 如何实现可打断更新的？又是怎么恢复执行的？React 的并发更新 Concurrent Mode？
React Fiber 架构？

## Build your own React

我们将从头开始重写 React。一步一步。遵循真实 React 代码的架构，但没有所有优化和非必要的功能。

<!-- 如果你读过我之前的任何一篇 [“构建你自己的 React”](https://engineering.hexacta.com/didact-learning-how-react-works-by-building-it-from-scratch-51007984e5c5) 的文章，不同的是这篇文章是基于 React 16.8 的，所以我们现在可以使用 hooks 并删除所有与 class 相关的代码。

你可以在 [Didact](https://github.com/pomber/didact) 存储库上找到包含旧博客文章和代码的历史记录。还有一个讲座涵盖了相同的内容。但这是一个独立的帖子。 -->

从头开始，这些是我们将逐一添加到 React 版本中的所有内容：

- 步骤一：`createElement` 函数
- 步骤二：`render` 函数
- 步骤三：Concurrent Mode 并发模式
- 步骤四：Fiber
- 步骤五：Render & Commit
- 步骤六：Reconciliation
- 步骤七：Function Components
- 步骤八：Hooks

## 步骤 0 ：回顾

但首先让我们回顾一些基本概念。如果你已经对 React、JSX 和 DOM 元素的工作原理有很好的了解，则可以跳过此步骤。

```js
const element = <h1 title="foo">Hello</h1>
const container = document.getElementById('root')
ReactDOM.render(element, container)
```

我们将使用这个 React 应用程序，只需三行代码。第一个定义了一个 React 元素。下一个从 DOM 获取一个节点。最后一个将 React 元素渲染到容器中。

让我们删除所有特定于 React 的代码，并将其替换为普通的 JavaScript。

在第一行，我们有元素，用 JSX 定义。它甚至不是有效的 JavaScript，所以为了用普通 JS 替换它，首先我们需要用有效的 JS 替换它。

JSX 通过 Babel 等构建工具转换为 JS。转换通常很简单：将标签内的代码替换为对 `createElement` 的调用，将标签名称、props 和 children 作为参数传递。

```js
const element = React.createElement('h1', { title: 'foo' }, 'Hello')
​
const container = document.getElementById("root")
ReactDOM.render(element, container)
```

`React.createElement` 从其参数创建一个对象。除了一些验证之外，这就是它所做的全部。因此，我们可以安全地将函数调用替换为其输出。

```js
const element = React.createElement('h1', { title: 'foo' }, 'Hello')

// 省略之前到代码
```

这就是 element ，一个具有两个属性的对象：`type` 和 `props`（嗯，它有更多，但我们只关心这两个）。

```js
const element = {
  type: "h1",
  props: {
    title: "foo",
    children: "Hello",
  },
}
​
// 省略之前到代码
```

`type` 是一个字符串，它指定了我们想要创建的 DOM 节点的类型，它是你在创建 HTML 元素时传递给 `document.createElement` 的 `tagName`。它也可以是一个函数，但我们将它留给步骤七。

`props` 是另一个对象，它包含来自 JSX 属性的所有键和值。它还有一个特殊属性：`children`。

在这种情况下，`children` 是一个字符串，但它通常是具有更多元素的数组。这就是为什么元素也是树的原因。

我们需要替换的另一段 React 代码是对 `ReactDOM.render` 的调用。

`render` 是 React 更改 DOM 的地方，所以让我们自己进行更新。

```js
// 省略之前到代码

ReactDOM.render(element, container)
```

首先，我们使用元素类型创建一个 node\*，在本例中为 `h1`。

然后我们将所有元素 `props` 分配给该节点。这里只是标题。

\* 为避免混淆，我将使用“element”来指代 React 元素，使用“node”来指代 DOM 元素。

```js
const element = {
  type: "h1",
  props: {
    title: "foo",
    children: "Hello",
  },
}
​
const container = document.getElementById("root")
​
const node = document.createElement(element.type)// 新增
node["title"] = element.props.title// 新增
```

然后我们为子节点创建节点。我们只有一个字符串作为子节点，因此我们创建了一个 text 节点。

```js
const element = {
  type: "h1",
  props: {
    title: "foo",
    children: "Hello",
  },
}
​
const container = document.getElementById("root")
​
const node = document.createElement(element.type)
node["title"] = element.props.title


const text = document.createTextNode("")// 新增
text["nodeValue"] = element.props.children// 新增
```

使用 `textNode` 而不是设置 `innerText` 将允许我们稍后以相同的方式处理所有元素。还要注意我们如何像对 `h1` 标题所做的那样设置 `nodeValue`，这几乎就像字符串有 `props：{nodeValue： “你好”}`。

最后，我们将 `textNode` 附加到 `h1` 上，将 `h1` 附加到`容器`中。

```js
const element = {
  type: "h1",
  props: {
    title: "foo",
    children: "Hello",
  },
}
​
const container = document.getElementById("root")
​
const node = document.createElement(element.type)
node["title"] = element.props.title
​
const text = document.createTextNode("")
text["nodeValue"] = element.props.children
​
node.appendChild(text)// 新增
container.appendChild(node)// 新增
```

现在我们拥有与以前相同的应用程序，但没有使用 React。

## 步骤 1：`createElement` 函数

让我们从另一个应用程序开始（另一个结构的 JSX）。这一次，我们将用我们自己的 React 版本替换 React 代码。

```js
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
)
const container = document.getElementById('root')
ReactDOM.render(element, container)
```

我们将从编写自己的 `createElement` 开始。

让我们将 JSX 转换为 JS，以便我们可以看到 `createElement` 调用。

正如我们在上一步中看到的，元素是具有 `type` 和 `props` 的对象。我们的函数唯一需要做的就是创建该对象。

```js
const element = React.createElement(
  'div',
  { id: 'foo' },
  React.createElement('a', null, 'bar'),
  React.createElement('b')
)

// 省略之前到代码
```

我们对 `props` 使用 展开运算符，对 `children` 使用 rest 参数语法，这样 `children` prop 将始终是一个数组。

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children
    }
  }
}
```

例如，`createElement（"div"）` 返回：

```js
{
  "type": "div",
  "props": { "children": [] }
}
```

`createElement("div", null, a)` 返回:

```js
{
  "type": "div",
  "props": { "children": [a] }
}
```

`createElement("div", null, a, b)` 返回:

```js
{
  "type": "div",
  "props": { "children": [a, b] }
}
```

`children` 数组还可以包含原始值，如字符串或数字。因此，我们将所有不是对象的东西包装在它自己的元素中，并为它们创建一个特殊类型：TEXT_ELEMENT。

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child => // 新增判断
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}
​
function createTextElement(text) {// 新增函数
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}
​
// 省略之前的代码
```

React 不会在没有`子项`时包装原始值或创建空数组，但我们这样做是因为它会简化我们的代码，对于我们的库，我们更喜欢简单的代码而不是高性能代码。

我们仍在使用 React 的 `createElement`。

```js
// 省略之前的代码

const element = React.createElement(
  'div',
  { id: 'foo' },
  React.createElement('a', null, 'bar'),
  React.createElement('b')
)
```

为了替换它，让我们为我们的库命名。我们需要一个听起来像 React 但又暗示其教学目的的名字。

我们将其称为 Didact。

```js
// 省略之前的代码

const Didact = {
  createElement,
}
​
const element = Didact.createElement(
  "div",
  { id: "foo" },
  Didact.createElement("a", null, "bar"),
  Didact.createElement("b")
)

// 省略之前的代码
```

但我们仍然希望在这里使用 JSX。我们如何告诉 babel 使用 Didact 的 createElement 而不是 React 的？

如果我们有这样的注释，当 babel 转译 JSX 时，它将使用我们定义的函数。

```js
// 省略之前的代码

/** @jsx Didact.createElement */
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
)

// 省略之前的代码
```

步骤 1 完整代码

```js
const Didact = {
  createElement,
}
​
const element = Didact.createElement(
  "div",
  { id: "foo" },
  Didact.createElement("a", null, "bar"),
  Didact.createElement("b")
)

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child => // 新增判断
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}
​
function createTextElement(text) {// 新增函数
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}
​
const container = document.getElementById('root')

console.log(element)

// 省略render
```

## 步骤 2：`render` 函数

接下来，我们需要编写我们版本的 `ReactDOM.render` 函数。

```js
// 省略之前的代码

ReactDOM.render(element, container)
```

目前，我们只关心向 DOM 添加内容。我们稍后会处理更新和删除。

```js
// 省略之前的代码

function render(element, container) {
  // TODO create dom nodes
}
​
const Didact = {
  createElement,
  render,
}

// 省略之前的代码

Didact.render(element, container)
```

我们首先使用 element 类型创建 DOM 节点，然后将新节点附加到容器中。

```js
// 省略之前的代码

function render(element, container) {
  const dom = document.createElement(element.type)
​
  container.appendChild(dom)
}

// 省略之前的代码
```

我们递归地为每个孩子做同样的事情。

```js
// 省略之前的代码

function render(element, container) {
  const dom = document.createElement(element.type)
​
  element.props.children.forEach(child =>
    render(child, dom)
  )
​
  container.appendChild(dom)
}

// 省略之前的代码
```

我们还需要处理文本元素，如果元素类型为 `TEXT_ELEMENT` 我们创建一个文本节点而不是常规节点。

```js
// 省略之前的代码

function render(element, container) {

  // 新增
  const dom =
    element.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)
​
  element.props.children.forEach(child =>
    render(child, dom)
  )
​
  container.appendChild(dom)
}

// 省略之前的代码
```

我们在这里需要做的最后一件事是将 element props 分配给节点。

```js
// 省略之前的代码

function render(element, container) {
  const dom =
    element.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)
​
// 新增
  const isProperty = key => key !== "children"
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name]
    })
​
  element.props.children.forEach(child =>
    render(child, dom)
  )
​
  container.appendChild(dom)
}

// 省略之前的代码
```

就是这样。我们现在有一个可以将 JSX 渲染到 DOM 的库。

在 [codesandbox](https://codesandbox.io/s/didact-2-k6rbj) 上试一试。

步骤 2 完整代码

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}
​
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}
​
function render(element, container) {
  const dom =
    element.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)
​
  const isProperty = key => key !== "children"
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name]
    })
​
  element.props.children.forEach(child =>
    render(child, dom)
  )
​
  container.appendChild(dom)
}
​
const Didact = {
  createElement,
  render,
}
​
/** @jsx Didact.createElement */
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
)
const container = document.getElementById("root")
Didact.render(element, container)
```

## 步骤 3：Concurrent Mode 并发模式

但。。。在我们开始添加更多代码之前，我们需要一个重构。

这个递归调用有问题。

```js
// 省略之前的代码

function render(element, container) {
  // 有问题
  element.props.children.forEach((child) => render(child, dom))
}

// 省略之前的代码
```

一旦我们开始渲染，我们不会停止，直到我们渲染了完整的元素树。如果元素树很大，则可能会阻塞主线程太久。如果浏览器需要执行高优先级操作，例如处理用户输入或保持动画流畅，则必须等到渲染完成。

因此，我们将工作分解为小单元，完成每个单元后，如果有其他需要完成的事情，我们将让浏览器中断渲染。

```js
// 省略之前的代码

let nextUnitOfWork = null

function workLoop(deadline) {
  let shouldYield = false

  // 如果有下一个单元 并且 可以继续工作
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)

    // 时间大于1的时候可以继续工作
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(nextUnitOfWork) {
  // TODO
}

// 省略之前的代码
```

我们使用 `requestIdleCallback` 来构建一个循环。你可以将 `requestIdleCallback` 看作是一个 `setTimeout`，但浏览器会在主线程空闲时运行回调，而不是我们告诉它何时运行。

```js
// 省略之前的代码
function workLoop(deadline) {
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)
// 省略之前的代码
```

React 不再使用 `requestIdleCallback`。现在它使用 scheduler 包。但对于这个用例，它在概念上是相同的。

`requestIdleCallback` 还为我们提供了一个 deadline 参数。我们可以使用它来检查浏览器需要再次控制之前我们还有多少时间。

```js
// 省略之前的代码

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    // 省略之前的代码
  }
  requestIdleCallback(workLoop)
}

// 省略之前的代码
```

截至 2019 年 11 月，Concurrent 模式在 React 中还不稳定。循环的稳定版本看起来更像这样：

```js
while (nextUnitOfWork) {
  nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
}
```

要开始使用循环，我们需要设置第一个工作单元，然后编写一个 `performUnitOfWork` 函数，该函数不仅执行工作，还返回下一个工作单元。

```js
// 省略之前的代码

let nextUnitOfWork = null
​
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    shouldYield = deadline.timeRemaining() < 1
  }
}
​
function performUnitOfWork(nextUnitOfWork) {
  // TODO
}

// 省略之前的代码
```

步骤 3 完整代码

```js
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child)
      )
    }
  }
}

function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  }
}

function render(element, container) {
  const dom =
    element.type == 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(element.type)
  const isProperty = (key) => key !== 'children'
  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = element.props[name]
    })
  element.props.children.forEach((child) => render(child, dom)) // 这里的写法有问题，应该靠workloop来完成，后面章节会修改
  container.appendChild(dom)
}

let nextUnitOfWork = null

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(nextUnitOfWork) {
  // TODO
}

const Didact = {
  createElement,
  render
}

/** @jsx Didact.createElement */
const element = (
  <div style="background: salmon">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from Didact</h2>
  </div>
)

const container = document.getElementById('root')
Didact.render(element, container)
```

## 步骤 4：Fibers

要组织工作单元，我们需要一个数据结构：fiber 树。

![alt text](https://pomb.us/static/a88a3ec01855349c14302f6da28e2b0c/d3fa7/fiber1.png)

让我给你看一个例子。

假设我们想要渲染一个像这样的元素树：

```js
Didact.render(
  <div>
    <h1>
      <p />
      <a />
    </h1>
    <h2 />
  </div>,
  container
)
```

在`渲染`中，我们将创建根 fiber 并将其设置为 `nextUnitOfWork`。其余工作将在 `performUnitOfWork` 函数上进行，我们将为每个 fiber 执行三项操作：

1. 将元素添加到 DOM
2. 为元素的 children 创建 fiber
3. 选择下一个工作单元

此数据结构的目标之一是使查找下一个工作单元变得容易。这就是为什么每个 fiber 都有一个指向其第一个子项、下一个兄弟级和父级的链接。

当我们完成对 fiber 执行工作时，如果它有一个子项(child)，则该 fiber 将是下一个工作单元。

从我们的示例中，当我们完成 div fiber 的工作时，下一个工作单元将是 h1 fiber。

如果 fiber 没有`子节点`(child)，我们将`同级`(sibling)节点用作下一个工作单元。

例如，`p` fiber 没有 `child`，因此我们在完成 p fiber 后移动到 a fiber。

如果 fiber 没有孩子也没有兄弟姐妹，我们就去找 “叔叔”：父母的兄弟姐妹。就像示例中的 a 和 h2 fiber。

此外，如果父级没有兄弟姐妹，我们会继续向上浏览父级，直到找到有兄弟姐妹的父级 或直到我们到达根 root。如果我们到达了根，则意味着我们已经完成了此`渲染`的所有工作。

现在让我们将其放入代码中。

首先，让我们从 `render` 函数中删除此代码。

```js
// 省略之前的代码

function render(element, container) {
  // 这里的内容即将删掉
  const dom =
    element.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type)
​
  const isProperty = key => key !== "children"
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name]
    })
​
  element.props.children.forEach(child =>
    render(child, dom)
  )
​
  container.appendChild(dom)
}
​
let nextUnitOfWork = null

// 省略之前的代码
```

我们将创建 DOM 节点的部分保留在它自己的函数中，我们稍后会使用它。

```js
// 省略之前的代码

function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)
​
  const isProperty = key => key !== "children"
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = fiber.props[name]
    })
​
  return dom
}
​
function render(element, container) {
  // TODO set next unit of work
}
​
let nextUnitOfWork = null

// 省略之前的代码
```

在 `render` 函数中，我们将 `nextUnitOfWork` 设置为 fiber 树的根。

```js
// 省略之前的代码

function render(element, container) {
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    },
  }
}
​
let nextUnitOfWork = null

// 省略之前的代码
```

然后，当浏览器准备好时，它将调用我们的 `workLoop`，我们将开始在根目录下工作。

```js
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}
​
requestIdleCallback(workLoop)
​
function performUnitOfWork(fiber) {
  // TODO add dom node
  // TODO create new fibers
  // TODO return next unit of work
}
```

首先，我们创建一个新节点并将其附加到 DOM。

我们在 fiber.dom 属性中跟踪 DOM 节点。

```js
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }
​
  // TODO create new fibers
  // TODO return next unit of work
}
```

然后，我们为每个孩子创建一个新的 fiber。

```js
// 省略之前的代码

function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }
​
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null
​
  while (index < elements.length) {
    const element = elements[index]
​
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }
  }
​
  // TODO return next unit of work
}

// 省略之前的代码
```

然后我们将其添加到 fiber 树中，将其设置为子项或同级项，具体取决于它是否是第一个子项。

```js
// 省略之前的代码

function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }
​
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null
​
  while (index < elements.length) {
    const element = elements[index]
​
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }

    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
​
    prevSibling = newFiber
    index++
  }
​
  // TODO return next unit of work
}

// 省略之前的代码
```

最后，我们搜索下一个工作单元。我们首先尝试与 child 一起尝试，然后与兄弟姐妹一起尝试，然后与叔叔一起尝试，依此类推。

```js
// 省略之前的代码

function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }
​
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null
​
  while (index < elements.length) {
    const element = elements[index]
​
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }

    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
​
    prevSibling = newFiber
    index++
  }

 if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
​
}

// 省略之前的代码
```

这就是我们的 performUnitOfWork。

步骤 4 完整代码

```js
// JSX转对象
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child)
      )
    }
  }
}

// JSX转对象时处理文本节点
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  }
}

// 单独的创建dom的函数，但是没有container挂载
function createDom(fiber) {
  const dom =
    fiber.type == 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)
  const isProperty = (key) => key !== 'children'
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name]
    })
  return dom
}

// ReactDOM.render 把JSX转换后到对象变成dom,并渲染到页面
// element就是fiber树，相当于传了fiber树进去当第一个工作单元
function render(element, container) {
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element]
    }
  }
}

// 下一个工作单元
let nextUnitOfWork = null

// 并发更新
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// 执行工作单元
// 1. 创建dom
// 2. 创建子节点 fiber树 或者说创建新的fiber
// 3. 返回下一个工作单元
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }

  // 只有当前级处理，但由于在workLoop里是递归，所以在递归时候会处理完所有子级 fiber
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null

  // 从根开始生成fiber
  while (index < elements.length) {
    const element = elements[index]

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null
    }

    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }

  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

// 自己定义的 React 对象
const Didact = {
  createElement,
  render
}

/** @jsx Didact.createElement */
const element = (
  <div style="background: salmon">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from Didact</h2>
  </div>
)

const container = document.getElementById('root')
Didact.render(element, container)
```

## 步骤 5：Render 和 Commit 阶段

我们这里有另一个问题。

```js
function performUnitOfWork(fiber) {
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom)
  }
}
```

每次处理元素时，我们都会向 DOM 添加新节点。而且，请记住，浏览器可能会在我们完成渲染整个树之前中断我们的工作。在这种情况下，用户将看到不完整的 UI。我们不希望那样。

所以我们需要从这里删除改变 DOM 的部分。

```js
// 删除
if (fiber.parent) {
  fiber.parent.dom.appendChild(fiber.dom)
}
```

相反，我们将跟 fiber 树的根。我们将其称为 work in progress root 或 wipRoot。

```js
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    }
  }
  nextUnitOfWork = wipRoot
}

let wipRoot = null
```

一旦我们完成了所有工作（我们知道这一点，因为没有下一个工作单元），我们将整个 fiber 树提交到 DOM。

```js
function commitRoot() {
  // TODO add nodes to dom
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
      nextUnitOfWork
    )
    shouldYield = deadline.timeRemaining() < 1
  }
​
   // 新增
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
​
  requestIdleCallback(workLoop)
}
```

我们在 `commitRoot` 函数中执行此操作。在这里，我们递归地将所有节点附加到 dom 中。

```js
function commitRoot() {
  commitWork(wipRoot.child)
  wipRoot = null
}
​
function commitWork(fiber) {
  if (!fiber) {
    return
  }
  const domParent = fiber.parent.dom
  domParent.appendChild(fiber.dom)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
```

步骤 5 完整代码

```js
debugger
/**
 * performUnitOfWork在有fiber.parent的时候，直接appendChild不行，如果被浏览器暂停任务就不会显示完整页面
 * 所以要分render和commit阶段，在commit阶段递归
 */
const createElement = (type, props, ...children) => {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        return typeof child === 'object' ? child : createTextElement(child)
      })
    }
  }
}

const createTextElement = (text) => {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  }
}

// 根据fiber创建真实dom
const createDom = (fiber) => {
  // 创建对应节点
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)

  // 过滤特殊的children
  const isProperty = (key) => {
    return key !== 'children'
  }

  // 赋给props
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name]
    })

  return dom
}

const render = (element, container) => {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    }
  }
  nextUnitOfWork = wipRoot
}

let nextUnitOfWork = null
let wipRoot = null

function commitRoot() {
  // TODO add nodes to dom
  commitWork(wipRoot.child)
  wipRoot = null
}

function commitWork(fiber) {
  if (!fiber) {
    return
  }
  const domParent = fiber.parent.dom
  domParent.appendChild(fiber.dom)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    // 如果剩余时间少于 1 毫秒，则 shouldYield 被设置为 true，表示当前任务应该让出执行权。
    shouldYield = deadline.timeRemaining() < 1
  }

  // 为什么这里就不会被中断
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// fiber对象
// {
//   type
//   props
//   dom
//   parent
//   child
//   sibling
// }

// 传入fiber,创建dom，为children创建fiber，找到下一个工作单元
function performUnitOfWork(fiber) {
  // 1、创建DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  // if (fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom)
  // }

  // 2、给children创建fiber
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null

  while (index < elements.length) {
    const element = elements[index]

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null
    }

    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }

  // 3、找到下一个工作单元

  // 向下递，向上归
  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

const MyReact = {
  createElement,
  render
}

/** @jsx MyReact.createElement */
// const element = <h1 title="foo">Hello</h1>

const element = (
  <div style="background: salmon">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from MyReact</h2>
  </div>
)

const container = document.getElementById('root')
MyReact.render(element, container)
```

## 步骤 6：Reconciliation

到目前为止，我们只向 DOM 添加了一些内容，但是更新或删除节点呢？

这就是我们现在要做的，我们需要将我们在 render 函数上接收到的元素与我们提交到 DOM 的最后一个 fiber 树进行比较。

因此，我们需要在完成提交后保存对“我们提交到 DOM 的最后一个 fiber 树”的引用。我们将其称为 currentRoot。

我们还为每个 fiber 添加了 `alternate` 属性。此属性是指向旧 fiber 的链接，即我们在上一个提交阶段提交到 DOM 的 fiber。

```js
function commitRoot() {
  commitWork(wipRoot.child)
  // 新增
  currentRoot = wipRoot
  wipRoot = null
}


function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  nextUnitOfWork = wipRoot
}

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
​
```

现在，让我们从 performUnitOfWork 中提取创建新 fiber 的代码...

```js
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  const elements = fiber.props.children
  let index = 0
  let prevSibling = null
​
  while (index < elements.length) {
    const element = elements[index]
​
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }
​
    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
​
    prevSibling = newFiber
    index++
  }
​
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}
```

…添加到新的 reconcileChildren 函数。

```js
function performUnitOfWork(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)
​
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function reconcileChildren(wipFiber, elements) {
  // TODO:
}
```

​
在这里，我们将调和旧 fiber 与新元素。

```js
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let prevSibling = null
​
  while (index < elements.length) {
    const element = elements[index]
​
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: wipFiber,
      dom: null,
    }
​
    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
​
    prevSibling = newFiber
    index++
  }
}
```

我们同时迭代旧 fiber （`wipFiber.alternate`） 的子元素和我们想要协调的元素数组。

```js
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
​
  while (
    index < elements.length ||
    oldFiber != null
  ) {
    const element = elements[index]
    let newFiber = null
​
    // TODO compare oldFiber to element
​
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
​
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }
  }
}
```

如果我们忽略掉同时遍历数组和链表所需的所有模板代码，我们就只剩下 while 循环中最核心的部分：oldFiber 和 element。element 是我们想要渲染到 DOM 中的内容，而 oldFiber 是我们上次渲染的内容。

我们需要比较它们，看看是否需要对 DOM 应用任何更改。

为了比较它们，我们使用类型：

- 如果旧的 fiber 和新的 element 具有相同的类型，我们可以保留 DOM 节点，只用新的 props 更新它
- 如果类型不同并且有新元素，则意味着我们需要创建一个新的 DOM 节点
- 如果类型不同并且存在旧 fiber，则需要删除旧节点

```js
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber =
    wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null
​
  while (
    index < elements.length ||
    oldFiber != null
  ) {
    const element = elements[index]
    let newFiber = null
​
    // 新增
    const sameType =
      oldFiber &&
      element &&
      element.type == oldFiber.type
​
    if (sameType) {
      // TODO update the node
    }
    if (element && !sameType) {
      // TODO add this node
    }
    if (oldFiber && !sameType) {
      // TODO delete the oldFiber's node
    }
​
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }
​
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }
  }
}
```

这里 React 也使用了 key，这可以更好地协调。例如，它会检测子项何时更改元素数组中的位置。

当旧 fiber 和 element 具有相同的类型时，我们创建一个新的 fiber，将 DOM 节点与旧 fiber 保持一致，并从 props 从元素中保留 props。

我们还向 fiber 添加了一个新属性：`effectTag`。我们稍后将在提交阶段使用此属性。

```js
const sameType =
  oldFiber &&
  element &&
  element.type == oldFiber.type
​
if (sameType) {
  newFiber = {
    type: oldFiber.type,
    props: element.props,
    dom: oldFiber.dom,
    parent: wipFiber,
    alternate: oldFiber,
    effectTag: "UPDATE",
  }
}
```

然后，对于元素需要新的 DOM 节点的情况，我们使用 PLACEMENT 效果标签标记新 fiber。

```js
if (element && !sameType) {
  newFiber = {
    type: element.type,
    props: element.props,
    dom: null,
    parent: wipFiber,
    alternate: null,
    effectTag: 'PLACEMENT'
  }
}
```

对于需要删除节点的情况，我们没有新的 fiber，因此我们将 effect 标签添加到旧 fiber 中。

```js
if (oldFiber && !sameType) {
  oldFiber.effectTag = 'DELETION'
  deletions.push(oldFiber)
}
```

但是当我们把 fiber tree 提交到 DOM 时，我们从 work in progress 根开始做这件事，它没有旧的 fibers。

因此，我们需要一个数组来跟踪我们想要删除的节点。

```js
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  }

  // 新增
  deletions = []
  nextUnitOfWork = wipRoot
}

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
// 新增
let deletions = null
```

然后，当我们将更改提交到 DOM 时，我们还使用来自该数组的 fibers。

```js
function commitRoot() {
  // 新增
  deletions.forEach(commitWork)

  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}
```

现在，让我们更改 `commitWork` 函数来处理新的 `effectTags`。

```js
function commitWork(fiber) {
  if (!fiber) {
    return
  }
  const domParent = fiber.parent.dom
  domParent.appendChild(fiber.dom)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
```

如果 fiber 具有 `PLACEMENT` 效果标签，我们将像以前一样，将 DOM 节点附加到父 fiber 中的节点。

```js
function commitWork(fiber) {
  if (!fiber) {
    return
  }
  const domParent = fiber.parent.dom
  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  }
​
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
```

如果是 `DELETION`，我们反其道而行之，删除 child。

```js
if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
  domParent.appendChild(fiber.dom)
} else if (fiber.effectTag === 'DELETION') {
  domParent.removeChild(fiber.dom)
}
```

如果是 `UPDATE`，我们需要用更改的 props 更新现有的 DOM 节点。

```js
if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
  domParent.appendChild(fiber.dom)
} else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
  updateDom(fiber.dom, fiber.alternate.props, fiber.props)
} else if (fiber.effectTag === 'DELETION') {
  domParent.removeChild(fiber.dom)
}
```

我们将在这个 `updateDom` 函数中执行此操作。

我们将旧 fiber 的 props 与新 fiber 的 props 进行比较，删除消失的 props，并设置新的或更改的 props。

```js
const isProperty = key => key !== "children"
const isNew = (prev, next) => key =>
  prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)
function updateDom(dom, prevProps, nextProps) {
  // 移除旧的属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })
​
  // 设置新的或更改的属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })
}
```

我们需要更新的一种特殊类型的 prop 是事件监听器，因此如果 prop 名称以 “on” 前缀开头，我们将以不同的方式处理它们。

```js
const isEvent = (key) => key.startsWith('on')
const isProperty = (key) => key !== 'children' && !isEvent(key)
```

如果事件处理程序发生更改，我们会将其从节点中删除。

```js
function updateDom(dom, prevProps, nextProps) {
  //删除事件
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      key =>
        !(key in nextProps) ||
        isNew(prevProps, nextProps)(key)
    )
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )
    })

    // 省略之前代码
​}
```

然后我们添加新的处理程序。

```js
//新增事件
Object.keys(nextProps)
  .filter(isEvent)
  .filter(isNew(prevProps, nextProps))
  .forEach((name) => {
    const eventType = name.toLowerCase().substring(2)
    dom.addEventListener(eventType, nextProps[name])
  })
```

在 [codesandbox](https://codesandbox.io/s/didact-6-96533) 上尝试具有 reconciliation 功能的版本。

步骤 6 完整代码

```js

```

## 步骤 7 Function Components

接下来我们需要添加的是 function components 的支持。

首先，让我们改变一下例子。我们将使用这个简单的函数组件，它返回一个 h1 元素。

```js
/** @jsx Didact.createElement */
function App(props) {
  return <h1>Hi {props.name}</h1>
}
const element = <App name="foo" />
const container = document.getElementById('root')
Didact.render(element, container)
```

请注意，如果我们将 jsx 转换为 js，它将是：

```js
function App(props) {
  return Didact.createElement('h1', null, 'Hi ', props.name)
}

const element = Didact.createElement(App, {
  name: 'foo'
})
```

函数组件在两个方面有所不同：

- 来自函数组件的 fiber 没有 DOM 节点
- 子项来自运行函数，而不是直接从 `props` 获取它们

```js
function performUnitOfWork(fiber) {
  // 要改动的代码

  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
​
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)

  // 省略之前的代码
​}
```

我们检查 fiber type 是否是一个函数，并根据它我们转到不同的 update 函数。

在 `updateHostComponent` 中，我们执行与以前相同的操作。

```js
function performUnitOfWork(fiber) {
  const isFunctionComponent =
    fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // 省略之前的代码
}

function updateFunctionComponent(fiber) {
  // TODO
}
​
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}
```

在 updateFunctionComponent 中，我们运行函数来获取子项

对于我们的示例，这里的 `fiber.type` 是 `App` 函数，当我们运行它时，它返回 `h1` 元素。

然后，一旦我们有了孩子，reconciliation 就会以同样的方式进行，我们不需要在那里做任何改变。

```js
function updateFunctionComponent(fiber) {
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
```

我们需要更改的是 `commitWork` 函数。

```js
function commitWork(fiber) {
  if (!fiber) {
    return
  }
​
  const domParent = fiber.parent.dom
  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null
  ) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.effectTag === "DELETION") {
    domParent.removeChild(fiber.dom)
  }
​
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
```

现在我们有了没有 DOM 节点的 fiber，我们需要改变两件事。

首先，要找到 DOM 节点的父节点，我们需要沿着 fiber 树向上走，直到找到具有 DOM 节点的 fiber。

```js
function commitWork(fiber) {
  if (!fiber) {
    return
  }
​
  // 新增
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom
​
  if (
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom != null
  ) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.effectTag === "DELETION") {
    // 新增
    commitDeletion(fiber, domParent)
  }
​
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
```

当删除一个节点时，我们还需要继续前进，直到找到一个具有 DOM 节点的子节点。

```js
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}
```

## 步骤 8 Hooks

最后一步。现在我们有了函数组件，让我们也添加 state。

让我们将示例更改为经典的 counter 组件。每次我们单击它时，它都会将状态增加 1。

请注意，我们使用 Didact.useState 来获取和更新 counter 值。

```js
const Didact = {
  createElement,
  render,
  useState,
}
​
/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}
const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)
```

这是我们从示例中调用 `Counter` 函数的地方。在这个函数中，我们称之为 `useState`。

```js
function updateFunctionComponent(fiber) {
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
​
function useState(initial) {
  // TODO
}
```

我们需要在调用函数组件之前初始化一些全局变量，以便我们可以在 useState 函数中使用它们。

首先，我们设置正在进行的 fiber 。

我们还向 fiber 添加了一个 hooks 数组，以支持在同一组件中多次调用 useState。我们跟踪当前的 hook 索引。

```js
let wipFiber = null
let hookIndex = null
​
function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
​
function useState(initial) {
  // TODO
}
```

当函数组件调用 `useState` 时，我们检查是否有旧的 hook。我们使用 hook 索引检查 fiber 的 alternate 。

如果我们有一个旧的 hook，我们将 state 从旧的 hook 复制到新的 hook 上，如果没有，我们初始化 state。

然后我们将新钩子添加到 fiber 中，将钩子索引增加 1，并返回状态。

```js
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
  }
​
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state]
}
```

`useState` 还应该返回一个函数来更新 state，因此我们定义了一个接收 action 的 `setState` 函数（对于 `Counter` 示例，这个 action 是将 state 递增 1 的函数）。

我们将该操作推送到我们添加到 hook 的队列中。

然后我们做一些类似于我们在 `render` 函数中所做的事情，将一个新的正在进行的工作根设置为下一个工作单元，以便工作循环可以开始新的渲染阶段。

```js
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
​
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }
​
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}
```

但我们尚未运行该操作。

我们下次渲染组件时执行此操作，从旧的 hook 队列中获取所有 action，然后将它们一一应用到新的 hook 状态，因此当我们返回状态时，它会被更新。

```js
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
​
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })
​
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }
​
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}
```

就这样。我们已经构建了自己的 React 版本。

您可以在 [codesandbox](https://codesandbox.io/p/sandbox/didact-8-21ost) 或 [github](https://github.com/pomber/didact) 上使用它。

## 结语

除了帮助你理解 React 的工作原理外，这篇文章的目标之一是让你更容易更深入地了解 React 代码库。这就是为什么我们几乎在所有地方都使用相同的变量和函数名称。

例如，如果你在真实 React 应用程序的一个函数组件中添加了一个断点，调用堆栈应该向你显示：

- workLoop workLoop 工作循环
- performUnitOfWork
- updateFunctionComponent

我们没有包含很多 React 功能和优化。例如，以下是 React 的不同之处：

- 在 Didact 中，我们在渲染阶段遍历整个树。相反，React 遵循一些提示和启发式方法来跳过没有任何变化的整个子树。
- 我们还在 commit 阶段遍历整个 tree。React 保留一个链表，其中仅包含具有 effect 的 fibers，并且只访问这些 fiber。
- 每次我们构建一个新的 work in progress 树时，我们都会为每个 fiber 创建新的对象。React 回收了之前树的 fiber。
- 当 Didact 在渲染阶段收到新的更新时，它会丢弃正在进行的工作树并从根重新开始。React 使用过期时间戳标记每个更新，并使用它来决定哪个更新具有更高的优先级。
- 还有更多...

您还可以轻松添加一些功能：

- 为 style 属性使用对象
- 展平子数组
- useEffect 钩子
- 根据 key 做 reconciliation

如果您向 Didact 添加了这些或其他功能中的任何一个，请向 [GitHub 存储库](https://github.com/pomber/didact)发送拉取请求，以便其他人可以看到它。

感谢阅读！
