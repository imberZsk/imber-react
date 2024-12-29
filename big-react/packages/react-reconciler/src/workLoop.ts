import { beginWork } from './beginWork'
import { completeWork } from './completeWork'
import { createWorkInProgress, FiberNode, FiberRootNode } from './fiber'
import { HostRoot } from './workTags'

let workInProgress: FiberNode | null = null

function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, {})
}

// export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
export function scheduleUpdateOnFiber(fiber: FiberNode) {
  // fiberRootNode
  // const root = markUpdateLaneFromFiberToRoot(fiber, lane)
  // markRootUpdated(root, lane)

  // 得到fiberRootNode
  const root = markUpdateLaneFromFiberToRoot(fiber)

  renderRoot(root)
  // markRootUpdated(root)
  // ensureRootIsScheduled(root)
}

// export function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
export function markUpdateLaneFromFiberToRoot(fiber: FiberNode) {
  let node = fiber
  let parent = node.return
  while (parent !== null) {
    // parent.childLanes = mergeLanes(parent.childLanes, lane)
    // const alternate = parent.alternate
    // if (alternate !== null) {
    // alternate.childLanes = mergeLanes(alternate.childLanes, lane)
    // }

    node = parent
    parent = node.return
  }
  if (node.tag === HostRoot) {
    return node.stateNode
  }
  return null
}

function renderRoot(root: FiberNode) {
  //  初始化
  prepareFreshStack(root)

  do {
    try {
      workLoopSync()
    } catch (error) {
      console.warn('workLoopSync error', error)
    }
  } while (true)
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane)
  fiber.memoizedProps = fiber.pendingProps

  if (next === null) {
    completeUnitOfWork(fiber)
  } else {
    workInProgress = next
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber

  do {
    completeWork(node)
    const sibling = node.sibling

    if (sibling !== null) {
      workInProgress = sibling
      return
    }
    node = node.return
    workInProgress = node
  } while (node !== null)
}
