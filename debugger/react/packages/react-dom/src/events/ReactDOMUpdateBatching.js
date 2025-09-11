/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  needsStateRestore,
  restoreStateIfNeeded,
} from './ReactDOMControlledComponent';

// Used as a way to call batchedUpdates when we don't have a reference to
// the renderer. Such as when we're dispatching events or if third party
// libraries need to call batchedUpdates. Eventually, this API will go away when
// everything is batched by default. We'll then have a similar API to opt-out of
// scheduled work and instead do synchronous work.

// Defaults
let batchedUpdatesImpl = function(fn, bookkeeping) {
  return fn(bookkeeping);
};
let discreteUpdatesImpl = function(fn, a, b, c, d) {
  return fn(a, b, c, d);
};
let flushSyncImpl = function() {};

let isInsideEventHandler = false;

function finishEventHandler() {
  // Here we wait until all updates have propagated, which is important
  // when using controlled components within layers:
  // https://github.com/facebook/react/issues/1698
  // Then we restore state of any controlled component.
  const controlledComponentsHavePendingUpdates = needsStateRestore();
  if (controlledComponentsHavePendingUpdates) {
    // If a controlled event was fired, we may need to restore the state of
    // the DOM node back to the controlled value. This is necessary when React
    // bails out of the update without touching the DOM.
    // TODO: Restore state in the microtask, after the discrete updates flush,
    // instead of early flushing them here.
    flushSyncImpl();
    restoreStateIfNeeded();
  }
}

export function batchedUpdates(fn, a, b) {
  // 1. 检查是否已经在事件处理器内部（嵌套批处理检查）
  if (isInsideEventHandler) {
    // 1.1 如果当前已经在另一个批处理内部，我们需要等待它完全完成后再恢复状态
    // 这种情况下直接执行函数，不进行额外的批处理包装
    return fn(a, b);
  }

  // 2. 标记当前正在事件处理器内部，防止嵌套批处理
  isInsideEventHandler = true;

  try {
    // 3. 执行实际的批处理更新实现
    // 这会将多个状态更新合并到一个批次中，提高性能
    return batchedUpdatesImpl(fn, a, b);
  } finally {
    // 4. 无论成功还是失败，都要清理状态
    // 4.1 重置事件处理器内部标志
    isInsideEventHandler = false;
    // 4.2 完成事件处理器，处理受控组件的状态恢复
    finishEventHandler();
  }
}

// TODO: Replace with flushSync
export function discreteUpdates(fn, a, b, c, d) {
  return discreteUpdatesImpl(fn, a, b, c, d);
}

export function setBatchingImplementation(
  _batchedUpdatesImpl,
  _discreteUpdatesImpl,
  _flushSyncImpl,
) {
  batchedUpdatesImpl = _batchedUpdatesImpl;
  discreteUpdatesImpl = _discreteUpdatesImpl;
  flushSyncImpl = _flushSyncImpl;
}
