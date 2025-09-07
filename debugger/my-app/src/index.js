import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
// import App from './App'
import AppJsx from './AppJsx'
// import reportWebVitals from './reportWebVitals'

// 客户端初始化阶段
debugger
const root = ReactDOM.createRoot(document.getElementById('root'))

// 调度阶段开始
// debugger
// root.render(<App />)
root.render(<AppJsx />)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals()
