'use client'

import { useState, useEffect } from 'react'

interface HybridResponsiveProps {
  initialIsMobile: boolean
  mobileContent: React.ReactNode
  desktopContent: React.ReactNode
}

export default function HybridResponsive({
  initialIsMobile,
  mobileContent,
  desktopContent
}: HybridResponsiveProps) {
  const [isMobile, setIsMobile] = useState(initialIsMobile)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // 监听窗口大小变化
    window.addEventListener('resize', checkIsMobile)

    // 清理事件监听器
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return <>{isMobile ? mobileContent : desktopContent}</>
}
