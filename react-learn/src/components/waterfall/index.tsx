import React from 'react'
// import './grid-dense.css' // 你可以把样式写在这里

interface Props {
  columnCount?: number
  gap?: number
}

const items = Array.from({ length: 20 }).map((_, i) => ({
  id: i,
  color: `hsl(${Math.random() * 360}, 70%, 50%)`,
  height: 80 + Math.random() * 120,
  content: <div>卡片 {i + 1}</div>
}))

const GridDense: React.FC<Props> = ({ columnCount = 4, gap = 16 }) => {
  return (
    <div
      className="grid-dense-masonry"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridAutoRows: 8, // 控制最小单元高度，越小越精细
        gap,
        gridAutoFlow: 'dense'
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            gridRowEnd: `span ${Math.ceil(item.height / 8)}`,
            background: item.color,
            borderRadius: 8,
            padding: 8,
            boxSizing: 'border-box'
          }}
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}

export default GridDense
