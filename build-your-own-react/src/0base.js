/**
 * jsx通过babel转成React.createElement()，返回 element 对象
 * element 主要属性有type和props
 * 根据type创建dom节点，props赋给属性
 * props有个特殊的属性 children,可以是文本节点，也可以是一个element
 */

// import React from 'react'
// import ReactDOM from 'react-dom'
// const element = <h1 title="foo">Hello</h1>
// const container = document.getElementById('root')
// ReactDOM.render(element, container)

// 初始化cra

// ReactDOM把虚拟fiber渲染渲染成web使用规范

const element = {
  type: 'h1',
  props: {
    title: 'foo',
    children: 'hello'
  }
}

const container = document.getElementById('root')

const node = document.createElement(element.type)
element['title'] = element.props.title

const text = document.createTextNode('')
text.nodeValue = element.props.children

node.appendChild(text)

container.appendChild(node)
