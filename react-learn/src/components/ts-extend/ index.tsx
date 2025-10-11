// button 基础配置
function Button({ className }: { className?: string }) {
  return (
    <button
      className={`bg-blue-500 text-white p-2 rounded-md cursor-pointer ${className}`}
    >
      Button
    </button>
  )
}

function ErrorButton() {
  return <Button />
}

export { Button, ErrorButton }
