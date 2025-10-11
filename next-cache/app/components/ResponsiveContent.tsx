export default function ResponsiveContent() {
  return (
    <div
      className="
        before:content-['移动端专用内容'] 
        md:before:content-['PC端专用内容']
        before:block 
        md:before:block
      "
    >
      {/* 这个div是空的，内容通过CSS的content属性显示 */}
    </div>
  )
}
