/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {FiberRoot} from './ReactInternalTypes';
import type {
  UpdateQueue as HookQueue,
  Update as HookUpdate,
} from './ReactFiberHooks.old';
import type {
  SharedQueue as ClassQueue,
  Update as ClassUpdate,
} from './ReactFiberClassUpdateQueue.old';
import type {Lane, Lanes} from './ReactFiberLane.old';
import type {OffscreenInstance} from './ReactFiberOffscreenComponent';

import {
  warnAboutUpdateOnNotYetMountedFiberInDEV,
  throwIfInfiniteUpdateLoopDetected,
} from './ReactFiberWorkLoop.old';
import {
  NoLane,
  NoLanes,
  mergeLanes,
  markHiddenUpdate,
} from './ReactFiberLane.old';
import {NoFlags, Placement, Hydrating} from './ReactFiberFlags';
import {HostRoot, OffscreenComponent} from './ReactWorkTags';
import {OffscreenVisible} from './ReactFiberOffscreenComponent';

export type ConcurrentUpdate = {
  next: ConcurrentUpdate,
  lane: Lane,
};

type ConcurrentQueue = {
  pending: ConcurrentUpdate | null,
};

// If a render is in progress, and we receive an update from a concurrent event,
// we wait until the current render is over (either finished or interrupted)
// before adding it to the fiber/hook queue. Push to this array so we can
// access the queue, fiber, update, et al later.
const concurrentQueues: Array<any> = [];
let concurrentQueuesIndex = 0;

let concurrentlyUpdatedLanes: Lanes = NoLanes;

export function finishQueueingConcurrentUpdates(): void {
  const endIndex = concurrentQueuesIndex;
  concurrentQueuesIndex = 0;

  concurrentlyUpdatedLanes = NoLanes;

  let i = 0;
  while (i < endIndex) {
    const fiber: Fiber = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const queue: ConcurrentQueue = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const update: ConcurrentUpdate = concurrentQueues[i];
    concurrentQueues[i++] = null;
    const lane: Lane = concurrentQueues[i];
    concurrentQueues[i++] = null;

    if (queue !== null && update !== null) {
      const pending = queue.pending;
      if (pending === null) {
        // This is the first update. Create a circular list.
        update.next = update;
      } else {
        update.next = pending.next;
        pending.next = update;
      }
      queue.pending = update;
    }

    if (lane !== NoLane) {
      markUpdateLaneFromFiberToRoot(fiber, update, lane);
    }
  }
}

export function getConcurrentlyUpdatedLanes(): Lanes {
  return concurrentlyUpdatedLanes;
}

function enqueueUpdate(
  fiber: Fiber,
  queue: ConcurrentQueue | null,
  update: ConcurrentUpdate | null,
  lane: Lane,
) {
  // Don't update the `childLanes` on the return path yet. If we already in
  // the middle of rendering, wait until after it has completed.
  concurrentQueues[concurrentQueuesIndex++] = fiber;
  concurrentQueues[concurrentQueuesIndex++] = queue;
  concurrentQueues[concurrentQueuesIndex++] = update;
  concurrentQueues[concurrentQueuesIndex++] = lane;

  concurrentlyUpdatedLanes = mergeLanes(concurrentlyUpdatedLanes, lane);

  // The fiber's `lane` field is used in some places to check if any work is
  // scheduled, to perform an eager bailout, so we need to update it immediately.
  // TODO: We should probably move this to the "shared" queue instead.
  fiber.lanes = mergeLanes(fiber.lanes, lane);
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
}

export function enqueueConcurrentHookUpdate<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
  lane: Lane,
): FiberRoot | null {
  const concurrentQueue: ConcurrentQueue = (queue: any);
  const concurrentUpdate: ConcurrentUpdate = (update: any);
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);
  return getRootForUpdatedFiber(fiber);
}

export function enqueueConcurrentHookUpdateAndEagerlyBailout<S, A>(
  fiber: Fiber,
  queue: HookQueue<S, A>,
  update: HookUpdate<S, A>,
): void {
  // This function is used to queue an update that doesn't need a rerender. The
  // only reason we queue it is in case there's a subsequent higher priority
  // update that causes it to be rebased.
  const lane = NoLane;
  const concurrentQueue: ConcurrentQueue = (queue: any);
  const concurrentUpdate: ConcurrentUpdate = (update: any);
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);
}

/**
 * 将类组件的更新加入并发更新队列
 *
 * 这个函数是类组件状态更新的入口点，负责将更新加入并发更新系统。
 * 它处理类组件的setState调用，将更新排队等待调度，并返回对应的FiberRoot用于调度。
 *
 * @param {Fiber} fiber - 需要更新的Fiber节点（类组件）
 * @param {ClassQueue<State>} queue - 类组件的更新队列
 * @param {ClassUpdate<State>} update - 要加入队列的更新对象
 * @param {Lane} lane - 更新的优先级车道
 * @returns {FiberRoot | null} 返回对应的FiberRoot用于调度更新，如果找不到则返回null
 */
export function enqueueConcurrentClassUpdate<State>(
  fiber: Fiber,
  queue: ClassQueue<State>,
  update: ClassUpdate<State>,
  lane: Lane,
): FiberRoot | null {
  // 将类组件的更新队列转换为并发更新队列格式
  // 这是为了统一处理类组件和函数组件的更新机制
  const concurrentQueue: ConcurrentQueue = (queue: any);

  // 将类组件的更新对象转换为并发更新格式
  // 确保更新对象符合并发更新系统的要求
  const concurrentUpdate: ConcurrentUpdate = (update: any);

  // 将更新加入并发更新队列
  // 这个函数会处理并发更新的排队逻辑，包括：
  // 1. 将更新添加到concurrentQueues数组中
  // 2. 更新fiber的lanes字段
  // 3. 处理alternate fiber的同步
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);

  // 获取更新Fiber对应的根节点，用于后续的调度
  // 这是React更新调度机制的关键步骤
  return getRootForUpdatedFiber(fiber);
}

export function enqueueConcurrentRenderForLane(
  fiber: Fiber,
  lane: Lane,
): FiberRoot | null {
  enqueueUpdate(fiber, null, null, lane);
  return getRootForUpdatedFiber(fiber);
}

// Calling this function outside this module should only be done for backwards
// compatibility and should always be accompanied by a warning.
export function unsafe_markUpdateLaneFromFiberToRoot(
  sourceFiber: Fiber,
  lane: Lane,
): FiberRoot | null {
  // NOTE: For Hyrum's Law reasons, if an infinite update loop is detected, it
  // should throw before `markUpdateLaneFromFiberToRoot` is called. But this is
  // undefined behavior and we can change it if we need to; it just so happens
  // that, at the time of this writing, there's an internal product test that
  // happens to rely on this.
  const root = getRootForUpdatedFiber(sourceFiber);
  markUpdateLaneFromFiberToRoot(sourceFiber, null, lane);
  return root;
}

function markUpdateLaneFromFiberToRoot(
  sourceFiber: Fiber,
  update: ConcurrentUpdate | null,
  lane: Lane,
): void {
  // Update the source fiber's lanes
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  let alternate = sourceFiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
  // Walk the parent path to the root and update the child lanes.
  let isHidden = false;
  let parent = sourceFiber.return;
  let node = sourceFiber;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    alternate = parent.alternate;
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    }

    if (parent.tag === OffscreenComponent) {
      // Check if this offscreen boundary is currently hidden.
      //
      // The instance may be null if the Offscreen parent was unmounted. Usually
      // the parent wouldn't be reachable in that case because we disconnect
      // fibers from the tree when they are deleted. However, there's a weird
      // edge case where setState is called on a fiber that was interrupted
      // before it ever mounted. Because it never mounts, it also never gets
      // deleted. Because it never gets deleted, its return pointer never gets
      // disconnected. Which means it may be attached to a deleted Offscreen
      // parent node. (This discovery suggests it may be better for memory usage
      // if we don't attach the `return` pointer until the commit phase, though
      // in order to do that we'd need some other way to track the return
      // pointer during the initial render, like on the stack.)
      //
      // This case is always accompanied by a warning, but we still need to
      // account for it. (There may be other cases that we haven't discovered,
      // too.)
      const offscreenInstance: OffscreenInstance | null = parent.stateNode;
      if (
        offscreenInstance !== null &&
        !(offscreenInstance.visibility & OffscreenVisible)
      ) {
        isHidden = true;
      }
    }

    node = parent;
    parent = parent.return;
  }

  if (isHidden && update !== null && node.tag === HostRoot) {
    const root: FiberRoot = node.stateNode;
    markHiddenUpdate(root, update, lane);
  }
}

/**
 * 获取更新Fiber对应的根节点
 *
 * 当Fiber节点发生状态更新时，需要找到对应的FiberRoot来调度更新。
 * 由于更新队列没有指向根节点的反向指针，只能通过向上遍历Fiber树来找到根节点。
 *
 * @param {Fiber} sourceFiber - 发生更新的源Fiber节点
 * @returns {FiberRoot | null} 返回对应的FiberRoot，如果找不到则返回null
 */
function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot | null {
  // TODO: 即使这个Fiber已经卸载，我们也会检测无限更新循环并抛出错误。
  // 这实际上不是必需的，但这恰好是我们几个发布周期以来一直使用的当前行为。
  // 考虑在更新的Fiber已经卸载时不执行此检查，因为那不可能导致无限更新循环。
  throwIfInfiniteUpdateLoopDetected();

  // 当setState发生时，我们必须确保根节点被调度。
  // 因为更新队列没有指向根节点的反向指针，目前唯一的方法是向上遍历返回路径。
  // 这以前不是大问题，因为无论如何我们都必须向上遍历返回路径来设置`childLanes`，
  // 但现在这两个遍历发生在不同的时间。
  // TODO: 考虑在更新队列上添加一个`root`反向指针。

  // 检测源Fiber本身是否在未挂载的Fiber上更新
  detectUpdateOnUnmountedFiber(sourceFiber, sourceFiber);

  // 从源Fiber开始向上遍历到根节点
  let node = sourceFiber;
  let parent = node.return;

  // 向上遍历Fiber树，直到找到根节点
  while (parent !== null) {
    // 检测每个父节点是否在未挂载的Fiber上更新
    detectUpdateOnUnmountedFiber(sourceFiber, node);
    // 移动到父节点
    node = parent;
    parent = node.return;
  }

  // 检查最终节点是否为HostRoot类型，如果是则返回其stateNode（FiberRoot）
  // 否则返回null
  return node.tag === HostRoot ? (node.stateNode: FiberRoot) : null;
}

function detectUpdateOnUnmountedFiber(sourceFiber: Fiber, parent: Fiber) {
  if (__DEV__) {
    const alternate = parent.alternate;
    if (
      alternate === null &&
      (parent.flags & (Placement | Hydrating)) !== NoFlags
    ) {
      warnAboutUpdateOnNotYetMountedFiberInDEV(sourceFiber);
    }
  }
}
