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
