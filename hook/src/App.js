let isMount = true
let workInProgressHook = null

const fiber = {
  stateNode: App,
  memorizedState: null // 保存的时候hooks的数据，链表的结构
}

function useState(initialState) {
  // 获取到当前对应哪一个hook
  let hook
  if (isMount) {
    hook = {
      memorizedState: initialState,
      next: null
    }
    if (!fiber.memorizedState) {
      fiber.memorizedState = hook
      workInProgressHook = hook
    } else {
      workInProgressHook.next = hook
    }
  } else {
  }
}

function schedule() {
  workInProgressHook = fiber.memorizedState // 重新指向第一个
  const app = fiber.stateNode()
  isMount = false
  return app
}

function App() {
  const [num, updateNum] = useState(0)

  // return (
  //   <p
  //     onClick={() => {
  //       updateNum(num + 1)
  //     }}
  //   >
  //     {num}
  //   </p>
  // )
  return {
    onclick: () => {
      updateNum((num) => num + 1)
    }
  }
}

export default App

window.app = schedule()

window.app.onclick()
