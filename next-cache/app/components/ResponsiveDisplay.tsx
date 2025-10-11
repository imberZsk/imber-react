'use client'

import { useState, useEffect } from 'react'

export default function ResponsiveDisplay() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768) // md 断点
    }

    // 初始检查
    checkIsMobile()

    // 监听窗口大小变化
    window.addEventListener('resize', checkIsMobile)

    // 清理事件监听器
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return (
    <>
      {isMobile ? (
        <div>我是移动端才能看到的(客户端组件)</div>
      ) : (
        <div>我是PC端才能看到的(客户端组件)</div>
      )}
    </>
  )
}
