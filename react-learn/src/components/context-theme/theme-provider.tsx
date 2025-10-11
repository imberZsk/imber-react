import { useState } from 'react'
import { ThemeContext, type Theme } from './theme-context'

export const ThemeProvider = ({
  children
}: {
  children: React.ReactElement
}) => {
  const [theme, setTheme] = useState<Theme>('dark')

  const value = {
    theme,
    setTheme
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
