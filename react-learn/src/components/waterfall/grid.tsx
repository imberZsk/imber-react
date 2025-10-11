import { useEffect } from 'react'

const data = Array(20)
  .fill(0)
  .map((_, index) => ({
    id: index,
    height: Math.floor(Math.random() * 8) + 4, // 4-12行
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  }))

const Index = () => {
  useEffect(() => {
    console.log('Waterfall data:', data)
  }, [])

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">瀑布流布局演示</h2>
      <p className="text-gray-400 mb-8">使用CSS Grid实现瀑布流效果</p>

      {/* 实际情况可能是 1px 才方便 */}
      <div className="grid grid-cols-3 gap-4" style={{ gridAutoRows: '60px' }}>
        {data.map((item, index) => (
          <div
            key={index}
            className="rounded-lg p-4 text-white font-medium flex items-center justify-center"
            style={{
              gridRow: `span ${item.height}`,
              backgroundColor: item.color
            }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold">{item.id}</div>
              <div className="text-sm opacity-80">{item.height * 60}px</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Index
