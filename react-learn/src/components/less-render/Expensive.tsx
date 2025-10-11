const Expensive = () => {
  console.log('Expensive')

  const now = performance.now()

  while (performance.now() - now < 1000) {
    // 模拟耗时操作
  }

  return (
    <div>
      <div>Expensive</div>
    </div>
  )
}

export default Expensive
