import { ThemeContext } from './theme-context'
import { ThemeProvider } from './theme-provider'
import { useContext } from 'react'

const InnerContext = () => {
  const { theme, setTheme } = useContext(ThemeContext)

  return (
    <div className="p-8 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 shadow-inner">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-white mb-3">主题控制器</h3>
        <p className="text-gray-300 text-sm">
          当前主题:{' '}
          <span className="text-white font-semibold px-2 py-1 bg-gray-700 rounded-md">
            {theme}
          </span>
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          className={`relative px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300 min-w-[100px] ${
            theme === 'light'
              ? 'bg-white text-black shadow-lg transform scale-105 border-2 border-white'
              : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500 hover:shadow-md'
          }`}
          onClick={() => setTheme('light')}
        >
          <span className="relative z-10">☀️ 浅色</span>
        </button>

        <button
          className={`relative px-6 py-3 rounded-lg text-sm font-medium transition-all duration-300 min-w-[100px] ${
            theme === 'dark'
              ? 'bg-white text-black shadow-lg transform scale-105 border-2 border-white'
              : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500 hover:shadow-md'
          }`}
          onClick={() => setTheme('dark')}
        >
          <span className="relative z-10">🌙 深色</span>
        </button>
      </div>

      {/* 主题预览区域 */}
      <div
        className={`p-6 rounded-lg border-2 transition-all duration-500 ${
          theme === 'light'
            ? 'bg-gradient-to-br from-white to-gray-100 text-black border-gray-300 shadow-inner'
            : 'bg-gradient-to-br from-black to-gray-900 text-white border-gray-500 shadow-inner'
        }`}
      >
        <div className="text-center">
          <h4
            className={`text-lg font-semibold mb-3 ${
              theme === 'light' ? 'text-gray-800' : 'text-gray-200'
            }`}
          >
            预览区域
          </h4>
          <p
            className={`text-sm leading-relaxed ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}
          >
            这是一个 <strong>{theme === 'light' ? '浅色' : '深色'}</strong>{' '}
            主题的示例区域。 你可以看到不同主题下的文字和背景色效果。
          </p>

          <div
            className={`mt-4 p-3 rounded border ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 text-gray-700'
                : 'bg-gray-800 border-gray-600 text-gray-300'
            }`}
          >
            <small>嵌套内容区域示例</small>
          </div>
        </div>
      </div>
    </div>
  )
}

const ContextTheme = () => {
  return (
    <ThemeProvider>
      <InnerContext />
    </ThemeProvider>
  )
}

export default ContextTheme
