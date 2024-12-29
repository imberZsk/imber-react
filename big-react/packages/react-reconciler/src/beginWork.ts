import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode, createWorkInProgress } from './fiber'
import { processUpdateQueue, UpdateQueue } from './updateQueue'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  MemoComponent,
  OffscreenComponent,
  SuspenseComponent,
  LazyComponent
} from './workTags'
import { Ref, NoFlags, DidCapture, Placement, ChildDeletion } from './fiberFlags'

// 是否能命中bailout
let didReceiveUpdate = false

export function markWipReceivedUpdate() {
  didReceiveUpdate = true
}

// 递归中的递阶段
export const beginWork = (wip: FiberNode) => {
  // 比较，返回子fiberNode
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip)
    case HostComponent:
      return updateHostComponent(wip)
    case HostText:
      return null
    // case FunctionComponent:
    //   return updateFunctionComponent(wip, wip.type, renderLane)
    // case Fragment:
    //   return updateFragment(wip)
    // case ContextProvider:
    //   return updateContextProvider(wip, renderLane)
    // case SuspenseComponent:
    //   return updateSuspenseComponent(wip)
    // case OffscreenComponent:
    //   return updateOffscreenComponent(wip)
    // case LazyComponent:
    //   return mountLazyComponent(wip, renderLane)
    // case MemoComponent:
    //   return updateMemoComponent(wip, renderLane)
    default:
      if (__DEV__) {
        console.warn('beginWork未实现的类型')
      }
      break
  }
  return null
}

// 计算最新值并且创建子fiber node
function updateHostRoot(wip: FiberNode) {
  const baseState = wip.memoizedState
  const updateQueue = wip.updateQueue as UpdateQueue<Element>
  const pending = updateQueue.shared.pending
  updateQueue.shared.pending = null

  const prevChildren = wip.memoizedState

  // 计算最新值
  const { memoizedState } = processUpdateQueue(baseState, pending)
  wip.memoizedState = memoizedState

  const current = wip.alternate
  // 考虑RootDidNotComplete的情况，需要复用memoizedState
  if (current !== null) {
    if (!current.memoizedState) {
      current.memoizedState = memoizedState
    }
  }

  const nextChildren = wip.memoizedState
  reconcileChildren(wip, nextChildren)
  return wip.child
}

// 只有创建子fiber node
function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps
  const nextChildren = nextProps.children
  reconcileChildren(wip, nextChildren)
  return wip.child
}
