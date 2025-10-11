import { useState } from 'react'
import Expensive from './Expensive'

const Index = () => {
  const [count, setCount] = useState(0)

  return (
    <div>
      <div>count: {count}</div>
      <br />
      <button
        className="bg-blue-500 text-white p-2 rounded-md cursor-pointer"
        onClick={() => setCount(count + 1)}
      >
        点击加1
      </button>
      <br />
      <br />
      <Expensive />
      <div>
        把index2的代码复制过来替换index，也就是把父组件需要更新的代码抽离成单独的组件，
        这样可以避免耗时组件的重复渲染
      </div>
    </div>
  )
}

export default Index
