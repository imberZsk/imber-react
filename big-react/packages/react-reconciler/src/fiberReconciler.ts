import { Container } from 'hostConfig'
// import { unstable_ImmediatePriority, unstable_runWithPriority } from 'scheduler'
import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode, FiberRootNode } from './fiber'
// import { requestUpdateLane } from './fiberLanes'
import { createUpdate, createUpdateQueue, enqueueUpdate, UpdateQueue } from './updateQueue'
import { scheduleUpdateOnFiber } from './workLoop'
import { HostRoot } from './workTags'

// ReactDOM.createRoot().render中，createRoot会执行这个函数
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null)
  const root = new FiberRootNode(container, hostRootFiber)
  hostRootFiber.updateQueue = createUpdateQueue()
  return root
}

// ReactDOM.createRoot().render中，render会执行这个函数
export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {
  // unstable_runWithPriority(unstable_ImmediatePriority, () => {
  const hostRootFiber = root.current
  // const lane = requestUpdateLane()
  // const update = createUpdate<ReactElementType | null>(element, lane)
  const update = createUpdate<ReactElementType | null>(element)
  // enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>, update, hostRootFiber, lane)
  enqueueUpdate(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>, update)
  scheduleUpdateOnFiber(hostRootFiber)
  // scheduleUpdateOnFiber(hostRootFiber, lane)
  // })
  return element
}
