import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes'
import { WorkTag } from './workTags'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'

export class FiberNode {
  type: any
  tag: WorkTag
  pendingProps: Props
  key: Key
  stateNode: any
  ref: Ref | null

  return: FiberNode | null
  sibling: FiberNode | null
  child: FiberNode | null
  index: number

  memoizedProps: Props | null
  memoizedState: any
  alternate: FiberNode | null
  flags: Flags
  // subtreeFlags: Flags
  updateQueue: unknown
  // deletions: FiberNode[] | null

  // lanes: Lanes
  // childLanes: Lanes

  // dependencies: FiberDependencies<any> | null

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例
    this.tag = tag
    this.key = key || null
    // HostComponent <div> div DOM
    this.stateNode = null
    // FunctionComponent () => {}
    this.type = null

    // 构成树状结构
    this.return = null
    this.sibling = null
    this.child = null
    this.index = 0

    this.ref = null

    // 作为工作单元
    this.pendingProps = pendingProps
    this.memoizedProps = null
    this.memoizedState = null
    this.updateQueue = null

    this.alternate = null
    // 副作用
    this.flags = NoFlags
    // this.subtreeFlags = NoFlags
    // this.deletions = null

    // this.lanes = NoLanes
    // this.childLanes = NoLanes

    // this.dependencies = null
  }
}

export class FiberRootNode {
  container: Container
  current: FiberNode
  // 保存更新完成的hostRootFiber
  finishedWork: FiberNode | null
  // pendingLanes: Lanes
  // suspendedLanes: Lanes
  // pingedLanes: Lanes
  // finishedLane: Lane
  // pendingPassiveEffects: PendingPassiveEffects

  // callbackNode: CallbackNode | null
  // callbackPriority: Lane

  // pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container
    this.current = hostRootFiber
    hostRootFiber.stateNode = this
    this.finishedWork = null
    // this.pendingLanes = NoLanes
    // this.suspendedLanes = NoLanes
    // this.pingedLanes = NoLanes
    // this.finishedLane = NoLane

    // this.callbackNode = null
    // this.callbackPriority = NoLane

    // this.pendingPassiveEffects = {
    //   unmount: [],
    //   update: []
    // }

    // this.pingCache = null
  }
}

export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => {
  let wip = current.alternate
  if (wip === null) {
    // mount
    wip = new FiberNode(current.tag, pendingProps, current.key)
    wip.stateNode = current.stateNode

    wip.alternate = current
    current.alternate = wip
  } else {
    // update
    wip.pendingProps = pendingProps
    wip.flags = NoFlags
    // wip.subtreeFlags = NoFlags
    // wip.deletions = null
  }
  wip.type = current.type
  wip.updateQueue = current.updateQueue
  wip.child = current.child
  wip.memoizedProps = current.memoizedProps
  wip.memoizedState = current.memoizedState
  wip.ref = current.ref

  // wip.lanes = current.lanes
  // wip.childLanes = current.childLanes

  const currentDeps = current.dependencies
  wip.dependencies =
    currentDeps === null
      ? null
      : {
          lanes: currentDeps.lanes,
          firstContext: currentDeps.firstContext
        }

  return wip
}
