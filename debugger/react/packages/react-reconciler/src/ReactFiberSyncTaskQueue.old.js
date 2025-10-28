/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {SchedulerCallback} from './Scheduler';

import {
  DiscreteEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from './ReactEventPriorities.old';
import {ImmediatePriority, scheduleCallback} from './Scheduler';

// 同步任务队列，用于存储需要同步执行的回调函数
let syncQueue: Array<SchedulerCallback> | null = null;
// 标记是否包含传统同步回调（用于区分新旧模式）
let includesLegacySyncCallbacks: boolean = false;
// 标记是否正在刷新同步队列，防止重复执行
let isFlushingSyncQueue: boolean = false;

/**
 * 调度同步回调函数
 * 将回调函数添加到内部同步队列中，这些回调会在下一个 tick 执行，
 * 或者当调用 flushSyncCallbackQueue 时更早执行
 */
export function scheduleSyncCallback(callback: SchedulerCallback) {
  // 将回调函数推入内部队列
  if (syncQueue === null) {
    // 如果队列为空，创建新队列并添加回调
    syncQueue = [callback];
  } else {
    // 如果队列已存在，直接推入回调
    // 不需要重新调度，因为在创建队列时已经调度过了
    syncQueue.push(callback);
  }
}

/**
 * 调度传统同步回调函数
 * 标记队列包含传统同步回调，然后调用 scheduleSyncCallback
 */
export function scheduleLegacySyncCallback(callback: SchedulerCallback) {
  // 标记队列包含传统同步回调
  includesLegacySyncCallbacks = true;
  // 调用普通的同步回调调度函数
  scheduleSyncCallback(callback);
}

/**
 * 仅在传统模式下刷新同步回调
 * 只有当存在传统同步回调时才刷新队列
 * 
 * TODO: 目前只有一种类型的回调：performSyncOnWorkOnRoot
 * 可能将队列改为根节点列表而不是通用回调列表会更合理
 * 这样我们可以有两个队列：一个用于传统根节点，一个用于并发根节点
 * 这个方法就只刷新传统根节点的回调
 */
export function flushSyncCallbacksOnlyInLegacyMode() {
  // 只有当存在传统同步回调时才刷新队列
  if (includesLegacySyncCallbacks) {
    flushSyncCallbacks();
  }
}

/**
 * 刷新同步回调队列
 * 执行队列中的所有同步回调函数
 */
export function flushSyncCallbacks() {
  // 只有在没有正在刷新队列且队列不为空时才执行
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // 防止重复进入
    isFlushingSyncQueue = true;
    let i = 0;
    // 保存当前的更新优先级
    const previousUpdatePriority = getCurrentUpdatePriority();
    
    try {
      const isSync = true;
      const queue = syncQueue;
      
      // TODO: 这还有必要吗？在这个队列中运行的唯一用户代码是在渲染或提交阶段
      // 设置当前更新优先级为离散事件优先级
      setCurrentUpdatePriority(DiscreteEventPriority);
      
      // 遍历队列中的所有回调并执行
      for (; i < queue.length; i++) {
        let callback = queue[i];
        // 执行回调，如果返回新的回调则继续执行（支持链式回调）
        do {
          callback = callback(isSync);
        } while (callback !== null);
      }
      
      // 清空队列和传统回调标记
      syncQueue = null;
      includesLegacySyncCallbacks = false;
    } catch (error) {
      // 如果发生错误，保留队列中剩余的回调
      if (syncQueue !== null) {
        syncQueue = syncQueue.slice(i + 1);
      }
      // 在下一个 tick 中恢复刷新
      scheduleCallback(ImmediatePriority, flushSyncCallbacks);
      throw error;
    } finally {
      // 恢复之前的更新优先级
      setCurrentUpdatePriority(previousUpdatePriority);
      // 重置刷新状态
      isFlushingSyncQueue = false;
    }
  }
  return null;
}
