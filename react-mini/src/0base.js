// import React from 'react'
// import ReactDOM from 'react-dom'
// const element = <h1 title="foo">Hello</h1>
// const container = document.getElementById('root')
// ReactDOM.render(element, container)

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
