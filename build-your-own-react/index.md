## Build your own React

我们将从头开始重写 React。一步一步。遵循真实 React 代码的架构，但没有所有优化和非必要的功能。

如果你读过我之前的任何一篇 [“构建你自己的 React”](https://engineering.hexacta.com/didact-learning-how-react-works-by-building-it-from-scratch-51007984e5c5) 的文章，不同的是这篇文章是基于 React 16.8 的，所以我们现在可以使用 hooks 并删除所有与 class 相关的代码。

你可以在 [Didact](https://github.com/pomber/didact) 存储库上找到包含旧博客文章和代码的历史记录。还有一个讲座涵盖了相同的内容。但这是一个独立的帖子。

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
