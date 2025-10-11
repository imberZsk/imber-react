import { useState } from 'react'

const Count = () => {
  const [count, setCount] = useState(0)

  return (
    <div>
      <div>count: {count}</div>
      <br />
      <button
        className="bg-blue-500 text-white p-2 rounded-md cursor-pointer"
        onClick={() => setCount(count - 1)}
      >
        点击加1
      </button>
    </div>
  )
}

export default Count
