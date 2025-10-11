import { Link, useLocation, Outlet } from 'react-router'

export interface Demo {
  id: string
  name: string
  path: string
  description?: string
}

const demos: Demo[] = [
  {
    id: 'context-theme',
    name: 'Context主题切换',
    path: 'context-theme',
    description: 'React Context API 主题切换示例'
  },
  {
    id: 'less-render',
    name: '将变的部分与不变部分分离',
    path: 'less-render',
    description: 'React 性能优化技巧'
  },
  {
    id: 'zod-form',
    name: '使用Zod进行表单验证',
    path: 'zod-form',
    description: 'React Zod表单验证示例'
  },
  {
    id: 'waterfall',
    name: '瀑布流布局',
    path: 'waterfall',
    description: 'React 瀑布流'
  }
  // 在这里添加更多的demo
]

const DemoSwitcher = () => {
  const location = useLocation()
  const currentPath = location.pathname

  // 根据当前路径找到对应的demo
  const currentDemo = demos.find((demo) => currentPath.includes(demo.path))

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 顶部导航 */}
      <div className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-black shadow-2xl">
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-2xl font-light mb-6 tracking-wider">
            <Link to="/" className="hover:text-gray-300 transition-colors">
              <span className="text-white">React</span>
              <span className="text-gray-400 ml-2">Learning Demos</span>
            </Link>
          </h1>

          {/* demo导航 */}
          <div className="flex gap-3 flex-wrap">
            {demos.map((demo) => (
              <Link
                key={demo.id}
                to={demo.path}
                className={`group relative px-6 py-3 rounded-lg cursor-pointer text-sm font-medium transition-all duration-300 overflow-hidden ${
                  currentPath.includes(demo.path)
                    ? 'bg-white text-black shadow-lg transform scale-105'
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-600 hover:shadow-lg hover:transform hover:scale-102'
                }`}
              >
                <span className="relative z-10">{demo.name}</span>
                {currentPath.includes(demo.path) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      {currentPath === '/' ? (
        // 首页显示demo列表
        <div className="max-w-6xl mx-auto p-8">
          <div className="mb-8">
            <h2 className="text-xl font-medium mb-3 text-white">
              欢迎使用 React Learning Demos
            </h2>
            <p className="text-gray-400 text-base leading-relaxed">
              选择一个demo开始学习React相关技术
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {demos.map((demo) => (
              <Link
                key={demo.id}
                to={demo.path}
                className="group bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105"
              >
                <h3 className="text-lg font-medium text-white mb-3 group-hover:text-gray-200">
                  {demo.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300">
                  {demo.description}
                </p>
                <div className="mt-4 text-right">
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">
                    点击查看 →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        // 其他页面显示当前demo信息和内容
        <div className="max-w-6xl mx-auto p-8">
          {currentDemo && (
            <div className="mb-8">
              <h2 className="text-xl font-medium mb-3 text-white">
                {currentDemo.name}
              </h2>
              <p className="text-gray-400 text-base leading-relaxed">
                {currentDemo.description}
              </p>
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 border border-gray-700 shadow-2xl">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  )
}

export default DemoSwitcher
