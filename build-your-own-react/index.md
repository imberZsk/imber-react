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
- 步骤五：Reconciliation
- 步骤六：Function Components
- 步骤七：Hooks

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

此数据结构的目标之一是使查找下一个工作单元变得容易。这就是为什么每个纤程都有一个指向其第一个子项、下一个兄弟级和父级的链接。

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

相反，我们将跟踪纤维树的根。我们将其称为 work in progress root 或 wipRoot。

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

一旦我们完成了所有工作（我们知道这一点，因为没有下一个工作单元），我们将整个纤维树提交到 DOM。

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

## 步骤 6：Reconciliation

到目前为止，我们只向 DOM 添加了一些内容，但是更新或删除节点呢？

这就是我们现在要做的，我们需要将我们在 render 函数上接收到的元素与我们提交到 DOM 的最后一个 fiber 树进行比较。

因此，我们需要在完成提交后保存对“我们提交到 DOM 的最后一个纤程树”的引用。我们将其称为 currentRoot。
