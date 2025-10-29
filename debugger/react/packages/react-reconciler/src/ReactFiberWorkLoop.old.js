/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Wakeable} from 'shared/ReactTypes';
import type {Fiber, FiberRoot} from './ReactInternalTypes';
import type {Lanes, Lane} from './ReactFiberLane.old';
import type {SuspenseState} from './ReactFiberSuspenseComponent.old';
import type {Flags} from './ReactFiberFlags';
import type {FunctionComponentUpdateQueue} from './ReactFiberHooks.old';
import type {EventPriority} from './ReactEventPriorities.old';
import type {
  PendingTransitionCallbacks,
  PendingBoundaries,
  Transition,
} from './ReactFiberTracingMarkerComponent.old';
import type {OffscreenInstance} from './ReactFiberOffscreenComponent';

import {
  warnAboutDeprecatedLifecycles,
  replayFailedUnitOfWorkWithInvokeGuardedCallback,
  enableCreateEventHandleAPI,
  enableProfilerTimer,
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerNestedUpdateScheduledHook,
  deferRenderPhaseUpdateToNextBatch,
  enableDebugTracing,
  enableSchedulingProfiler,
  disableSchedulerTimeoutInWorkLoop,
  enableStrictEffects,
  skipUnmountedBoundaries,
  enableUpdaterTracking,
  enableCache,
  enableTransitionTracing,
} from 'shared/ReactFeatureFlags';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import is from 'shared/objectIs';

import {
  // Aliased because `act` will override and push to an internal queue
  scheduleCallback as Scheduler_scheduleCallback,
  cancelCallback as Scheduler_cancelCallback,
  shouldYield,
  requestPaint,
  now,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
} from './Scheduler';
import {
  flushSyncCallbacks,
  flushSyncCallbacksOnlyInLegacyMode,
  scheduleSyncCallback,
  scheduleLegacySyncCallback,
} from './ReactFiberSyncTaskQueue.old';
import {
  logCommitStarted,
  logCommitStopped,
  logLayoutEffectsStarted,
  logLayoutEffectsStopped,
  logPassiveEffectsStarted,
  logPassiveEffectsStopped,
  logRenderStarted,
  logRenderStopped,
} from './DebugTracing';

import {
  resetAfterCommit,
  scheduleTimeout,
  cancelTimeout,
  noTimeout,
  afterActiveInstanceBlur,
  getCurrentEventPriority,
  supportsMicrotasks,
  errorHydratingContainer,
  scheduleMicrotask,
} from './ReactFiberHostConfig';

import {
  createWorkInProgress,
  assignFiberPropertiesInDEV,
} from './ReactFiber.old';
import {isRootDehydrated} from './ReactFiberShellHydration';
import {didSuspendOrErrorWhileHydratingDEV} from './ReactFiberHydrationContext.old';
import {NoMode, ProfileMode, ConcurrentMode} from './ReactTypeOfMode';
import {
  HostRoot,
  IndeterminateComponent,
  ClassComponent,
  SuspenseComponent,
  SuspenseListComponent,
  OffscreenComponent,
  FunctionComponent,
  ForwardRef,
  MemoComponent,
  SimpleMemoComponent,
  Profiler,
} from './ReactWorkTags';
import {LegacyRoot} from './ReactRootTags';
import {
  NoFlags,
  Incomplete,
  StoreConsistency,
  HostEffectMask,
  ForceClientRender,
  BeforeMutationMask,
  MutationMask,
  LayoutMask,
  PassiveMask,
  MountPassiveDev,
  MountLayoutDev,
} from './ReactFiberFlags';
import {
  NoLanes,
  NoLane,
  SyncLane,
  NoTimestamp,
  claimNextTransitionLane,
  claimNextRetryLane,
  includesSomeLane,
  isSubsetOfLanes,
  mergeLanes,
  removeLanes,
  pickArbitraryLane,
  includesNonIdleWork,
  includesOnlyRetries,
  includesOnlyTransitions,
  includesBlockingLane,
  includesExpiredLane,
  getNextLanes,
  markStarvedLanesAsExpired,
  getLanesToRetrySynchronouslyOnError,
  getMostRecentEventTime,
  markRootUpdated,
  markRootSuspended as markRootSuspended_dontCallThisOneDirectly,
  markRootPinged,
  markRootEntangled,
  markRootFinished,
  getHighestPriorityLane,
  addFiberToLanesMap,
  movePendingFibersToMemoized,
  addTransitionToLanesMap,
  getTransitionsForLanes,
} from './ReactFiberLane.old';
import {
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
  lowerEventPriority,
  lanesToEventPriority,
} from './ReactEventPriorities.old';
import {requestCurrentTransition, NoTransition} from './ReactFiberTransition';
import {beginWork as originalBeginWork} from './ReactFiberBeginWork.old';
import {completeWork} from './ReactFiberCompleteWork.old';
import {unwindWork, unwindInterruptedWork} from './ReactFiberUnwindWork.old';
import {
  throwException,
  createRootErrorUpdate,
  createClassErrorUpdate,
} from './ReactFiberThrow.old';
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveEffectDurations,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
  invokeLayoutEffectMountInDEV,
  invokePassiveEffectMountInDEV,
  invokeLayoutEffectUnmountInDEV,
  invokePassiveEffectUnmountInDEV,
  reportUncaughtErrorInDEV,
} from './ReactFiberCommitWork.old';
import {enqueueUpdate} from './ReactFiberClassUpdateQueue.old';
import {resetContextDependencies} from './ReactFiberNewContext.old';
import {
  resetHooksAfterThrow,
  ContextOnlyDispatcher,
  getIsUpdatingOpaqueValueInRenderPhaseInDEV,
} from './ReactFiberHooks.old';
import {
  createCapturedValueAtFiber,
  type CapturedValue,
} from './ReactCapturedValue';
import {
  enqueueConcurrentRenderForLane,
  finishQueueingConcurrentUpdates,
  getConcurrentlyUpdatedLanes,
} from './ReactFiberConcurrentUpdates.old';

import {
  markNestedUpdateScheduled,
  recordCommitTime,
  resetNestedUpdateFlag,
  startProfilerTimer,
  stopProfilerTimerIfRunningAndRecordDelta,
  syncNestedUpdateFlag,
} from './ReactProfilerTimer.old';

// DEV stuff
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';
import ReactStrictModeWarnings from './ReactStrictModeWarnings.old';
import {
  isRendering as ReactCurrentDebugFiberIsRenderingInDEV,
  current as ReactCurrentFiberCurrent,
  resetCurrentFiber as resetCurrentDebugFiberInDEV,
  setCurrentFiber as setCurrentDebugFiberInDEV,
} from './ReactCurrentFiber';
import {
  invokeGuardedCallback,
  hasCaughtError,
  clearCaughtError,
} from 'shared/ReactErrorUtils';
import {
  isDevToolsPresent,
  markCommitStarted,
  markCommitStopped,
  markComponentRenderStopped,
  markComponentSuspended,
  markComponentErrored,
  markLayoutEffectsStarted,
  markLayoutEffectsStopped,
  markPassiveEffectsStarted,
  markPassiveEffectsStopped,
  markRenderStarted,
  markRenderYielded,
  markRenderStopped,
  onCommitRoot as onCommitRootDevTools,
  onPostCommitRoot as onPostCommitRootDevTools,
} from './ReactFiberDevToolsHook.old';
import {onCommitRoot as onCommitRootTestSelector} from './ReactTestSelectors';
import {releaseCache} from './ReactFiberCacheComponent.old';
import {
  isLegacyActEnvironment,
  isConcurrentActEnvironment,
} from './ReactFiberAct.old';
import {processTransitionCallbacks} from './ReactFiberTracingMarkerComponent.old';

const ceil = Math.ceil;

const {
  ReactCurrentDispatcher,
  ReactCurrentOwner,
  ReactCurrentBatchConfig,
  ReactCurrentActQueue,
} = ReactSharedInternals;

type ExecutionContext = number;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

// Describes where we are in the React execution stack
let executionContext: ExecutionContext = NoContext;
// The root we're working on
let workInProgressRoot: FiberRoot | null = null;
// The fiber we're working on
let workInProgress: Fiber | null = null;
// The lanes we're rendering
let workInProgressRootRenderLanes: Lanes = NoLanes;

// A contextual version of workInProgressRootRenderLanes. It is a superset of
// the lanes that we started working on at the root. When we enter a subtree
// that is currently hidden, we add the lanes that would have committed if
// the hidden tree hadn't been deferred. This is modified by the
// HiddenContext module.
//
// Most things in the work loop should deal with workInProgressRootRenderLanes.
// Most things in begin/complete phases should deal with renderLanes.
export let renderLanes: Lanes = NoLanes;

// Whether to root completed, errored, suspended, etc.
let workInProgressRootExitStatus: RootExitStatus = RootInProgress;
// A fatal error, if one is thrown
let workInProgressRootFatalError: mixed = null;
// The work left over by components that were visited during this render. Only
// includes unprocessed updates, not work in bailed out children.
let workInProgressRootSkippedLanes: Lanes = NoLanes;
// Lanes that were updated (in an interleaved event) during this render.
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;
// Lanes that were updated during the render phase (*not* an interleaved event).
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;
// Lanes that were pinged (in an interleaved event) during this render.
let workInProgressRootPingedLanes: Lanes = NoLanes;
// Errors that are thrown during the render phase.
let workInProgressRootConcurrentErrors: Array<
  CapturedValue<mixed>,
> | null = null;
// These are errors that we recovered from without surfacing them to the UI.
// We will log them once the tree commits.
let workInProgressRootRecoverableErrors: Array<
  CapturedValue<mixed>,
> | null = null;

// The most recent time we committed a fallback. This lets us ensure a train
// model where we don't commit new loading states in too quick succession.
let globalMostRecentFallbackTime: number = 0;
const FALLBACK_THROTTLE_MS: number = 500;

// The absolute time for when we should start giving up on rendering
// more and prefer CPU suspense heuristics instead.
let workInProgressRootRenderTargetTime: number = Infinity;
// How long a render is supposed to take before we start following CPU
// suspense heuristics and opt out of rendering more content.
const RENDER_TIMEOUT_MS = 500;

let workInProgressTransitions: Array<Transition> | null = null;
export function getWorkInProgressTransitions() {
  return workInProgressTransitions;
}

let currentPendingTransitionCallbacks: PendingTransitionCallbacks | null = null;

export function addTransitionStartCallbackToPendingTransition(
  transition: Transition,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: [],
        transitionProgress: null,
        transitionComplete: null,
        markerProgress: null,
        markerComplete: null,
      };
    }

    if (currentPendingTransitionCallbacks.transitionStart === null) {
      currentPendingTransitionCallbacks.transitionStart = [];
    }

    currentPendingTransitionCallbacks.transitionStart.push(transition);
  }
}

export function addMarkerProgressCallbackToPendingTransition(
  markerName: string,
  transitions: Set<Transition>,
  pendingBoundaries: PendingBoundaries | null,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: null,
        transitionProgress: null,
        transitionComplete: null,
        markerProgress: new Map(),
        markerComplete: null,
      };
    }

    if (currentPendingTransitionCallbacks.markerProgress === null) {
      currentPendingTransitionCallbacks.markerProgress = new Map();
    }

    currentPendingTransitionCallbacks.markerProgress.set(markerName, {
      pendingBoundaries,
      transitions,
    });
  }
}

export function addMarkerCompleteCallbackToPendingTransition(
  markerName: string,
  transitions: Set<Transition>,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: null,
        transitionProgress: null,
        transitionComplete: null,
        markerProgress: null,
        markerComplete: new Map(),
      };
    }

    if (currentPendingTransitionCallbacks.markerComplete === null) {
      currentPendingTransitionCallbacks.markerComplete = new Map();
    }

    currentPendingTransitionCallbacks.markerComplete.set(
      markerName,
      transitions,
    );
  }
}

export function addTransitionProgressCallbackToPendingTransition(
  transition: Transition,
  boundaries: PendingBoundaries,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: null,
        transitionProgress: new Map(),
        transitionComplete: null,
        markerProgress: null,
        markerComplete: null,
      };
    }

    if (currentPendingTransitionCallbacks.transitionProgress === null) {
      currentPendingTransitionCallbacks.transitionProgress = new Map();
    }

    currentPendingTransitionCallbacks.transitionProgress.set(
      transition,
      boundaries,
    );
  }
}

export function addTransitionCompleteCallbackToPendingTransition(
  transition: Transition,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: null,
        transitionProgress: null,
        transitionComplete: [],
        markerProgress: null,
        markerComplete: null,
      };
    }

    if (currentPendingTransitionCallbacks.transitionComplete === null) {
      currentPendingTransitionCallbacks.transitionComplete = [];
    }

    currentPendingTransitionCallbacks.transitionComplete.push(transition);
  }
}

function resetRenderTimer() {
  workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
}

export function getRenderTargetTime(): number {
  return workInProgressRootRenderTargetTime;
}

let hasUncaughtError = false;
let firstUncaughtError = null;
let legacyErrorBoundariesThatAlreadyFailed: Set<mixed> | null = null;

// Only used when enableProfilerNestedUpdateScheduledHook is true;
// to track which root is currently committing layout effects.
let rootCommittingMutationOrLayoutEffects: FiberRoot | null = null;

let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let pendingPassiveProfilerEffects: Array<Fiber> = [];
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;
let pendingPassiveTransitions: Array<Transition> | null = null;

// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

// If two updates are scheduled within the same event, we should treat their
// event times as simultaneous, even if the actual clock time has advanced
// between the first and second call.
let currentEventTime: number = NoTimestamp;
let currentEventTransitionLane: Lanes = NoLanes;

let isRunningInsertionEffect = false;

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

export function getWorkInProgressRootRenderLanes(): Lanes {
  return workInProgressRootRenderLanes;
}

/**
 * 请求事件时间 - 获取用于优先级计算的时间戳
 * 这个函数确保在同一个浏览器事件处理过程中，所有更新都使用相同的时间戳
 * 这对于 React 的优先级调度和批处理机制至关重要
 *
 * @returns {number} 事件时间戳
 */
export function requestEventTime() {
  // 检查当前是否在 React 的渲染或提交上下文中
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // 我们在 React 内部，可以直接读取实际时间
    return now();
  }

  // 我们不在 React 内部，可能正在处理浏览器事件
  if (currentEventTime !== NoTimestamp) {
    // 使用相同的时间戳，直到我们重新进入 React
    // 这确保了同一个浏览器事件中的所有更新具有相同的时间戳
    return currentEventTime;
  }

  // 这是自 React 让出控制权以来的第一次更新，计算新的开始时间
  currentEventTime = now();
  return currentEventTime;
}

export function getCurrentTime() {
  return now();
}

/**
 * 请求更新车道 - 为 Fiber 节点分配更新优先级车道
 * 这个函数根据不同的更新来源和上下文，为更新分配合适的优先级车道
 * 车道系统是 React 并发渲染和优先级调度的核心机制
 *
 * @param {Fiber} fiber - 需要更新的 Fiber 节点
 * @returns {Lane} 返回分配的优先级车道
 */
export function requestUpdateLane(fiber: Fiber): Lane {
  // 特殊情况处理
  const mode = fiber.mode;

  // 情况1：非并发模式 - 直接返回同步车道
  if ((mode & ConcurrentMode) === NoMode) {
    return (SyncLane: Lane);
  }
  // 情况2：渲染阶段更新 - 在组件渲染过程中触发的更新
  else if (
    !deferRenderPhaseUpdateToNextBatch &&
    (executionContext & RenderContext) !== NoContext &&
    workInProgressRootRenderLanes !== NoLanes
  ) {
    // 这是一个渲染阶段更新。这些更新不被官方支持。
    // 旧的行为是给这个更新分配与当前正在渲染的相同"线程"（车道）。
    // 所以如果你在同一个渲染中稍后发生的组件上调用 `setState`，它会立即刷新。
    // 理想情况下，我们希望移除这个特殊情况，将它们视为来自交错事件。
    // 无论如何，这种模式不被官方支持。
    // 这种行为只是一个后备方案。这个标志只存在于我们能够推出 setState 警告之前，
    // 因为现有代码可能意外地依赖当前行为。
    return pickArbitraryLane(workInProgressRootRenderLanes);
  }

  // 情况3：过渡更新 - 使用 startTransition 或 useTransition 触发的更新
  const isTransition = requestCurrentTransition() !== NoTransition;
  if (isTransition) {
    // 为更新分配车道的算法应该在同一个事件中所有相同优先级的更新中保持稳定。
    // 要做到这一点，算法的输入必须相同。
    //
    // 我们使用的技巧是在一个事件中缓存这些输入中的第一个。
    // 然后一旦我们确定事件结束，就重置缓存的值。
    // 我们的启发式方法是每当我们进入并发工作循环时。
    if (currentEventTransitionLane === NoLane) {
      // 同一个事件中的所有过渡都被分配相同的车道。
      currentEventTransitionLane = claimNextTransitionLane();
    }
    return currentEventTransitionLane;
  }

  // 情况4：React 内部方法触发的更新 - 如 flushSync 等
  // 这些更新的优先级通过上下文变量跟踪设置。
  //
  // 主机配置返回的不透明类型内部是一个车道，所以我们可以直接使用它。
  // TODO: 将此类型转换移动到事件优先级模块。
  const updateLane: Lane = (getCurrentUpdatePriority(): any);
  if (updateLane !== NoLane) {
    return updateLane;
  }

  // 情况5：React 外部触发的更新 - 如用户事件、网络请求等
  // 这个更新来源于 React 外部。向主机环境询问适当的优先级，基于事件类型。
  //
  // 主机配置返回的不透明类型内部是一个车道，所以我们可以直接使用它。
  // TODO: 将此类型转换移动到事件优先级模块。
  const eventLane: Lane = (getCurrentEventPriority(): any);
  return eventLane;
}

function requestRetryLane(fiber: Fiber) {
  // This is a fork of `requestUpdateLane` designed specifically for Suspense
  // "retries" — a special update that attempts to flip a Suspense boundary
  // from its placeholder state to its primary/resolved state.

  // Special cases
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) {
    return (SyncLane: Lane);
  }

  return claimNextRetryLane();
}

/**
 * 在指定的 Fiber 节点上调度更新
 * 这是 React 更新调度的核心函数，负责处理所有类型的更新（同步、异步、并发等）
 *
 * @param {FiberRoot} root - 根 Fiber 节点
 * @param {Fiber} fiber - 需要更新的 Fiber 节点
 * @param {Lane} lane - 更新优先级车道
 * @param {number} eventTime - 事件时间戳
 */
export function scheduleUpdateOnFiber(
  root: FiberRoot,
  fiber: Fiber,
  lane: Lane,
  eventTime: number,
) {
  console.log('scheduleUpdateOnFiber', '开始调度的入口标记Root的pendingLanes'，);
  // 标记根节点有待处理的更新
  markRootUpdated(root, lane, eventTime);

  // 检查是否在渲染阶段调度更新
  if (
    (executionContext & RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    // 在渲染阶段调度的更新。如果更新来自用户空间，这通常是一个错误
    // （除了本地 hook 更新，它们有不同的处理方式且不会到达此函数）
    // 但有一些内部 React 功能将此作为实现细节使用，比如选择性水合
    warnAboutRenderPhaseUpdatesInDEV(fiber);

    // 跟踪在渲染阶段更新的车道
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane,
    );
  } else {
    // 这是一个正常的更新，在渲染阶段之外调度
    // 例如，在输入事件期间

    // 如果启用了更新器跟踪，将 Fiber 添加到车道映射中（用于 DevTools）
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        addFiberToLanesMap(root, fiber, lane);
      }
    }

    // 在开发模式下警告未用 act 包装的更新
    warnIfUpdatesNotWrappedWithActDEV(fiber);

    // 处理性能分析器相关的嵌套更新调度钩子
    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      if (
        (executionContext & CommitContext) !== NoContext &&
        root === rootCommittingMutationOrLayoutEffects
      ) {
        if (fiber.mode & ProfileMode) {
          let current = fiber;
          // 向上遍历 Fiber 树，查找 Profiler 组件
          while (current !== null) {
            if (current.tag === Profiler) {
              const {id, onNestedUpdateScheduled} = current.memoizedProps;
              if (typeof onNestedUpdateScheduled === 'function') {
                onNestedUpdateScheduled(id);
              }
            }
            current = current.return;
          }
        }
      }
    }

    // 处理过渡跟踪（Transition Tracing）
    if (enableTransitionTracing) {
      const transition = ReactCurrentBatchConfig.transition;
      if (transition !== null && transition.name != null) {
        // 如果过渡还没有开始时间，设置开始时间
        if (transition.startTime === -1) {
          transition.startTime = now();
        }

        // 将过渡添加到车道映射中
        addTransitionToLanesMap(root, transition, lane);
      }
    }

    // 如果当前根节点正在渲染中
    if (root === workInProgressRoot) {
      // 接收到对正在渲染中的树的更新。标记此根节点有交错更新工作
      // 除非 `deferRenderPhaseUpdateToNextBatch` 标志关闭且这是渲染阶段更新
      // 在这种情况下，为了向后兼容，我们不将渲染阶段更新视为交错的
      if (
        deferRenderPhaseUpdateToNextBatch ||
        (executionContext & RenderContext) === NoContext
      ) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane,
        );
      }

      // 如果根节点已经延迟挂起，意味着当前渲染肯定不会完成
      // 由于我们有新的更新，让我们在标记传入更新之前立即将其标记为挂起
      // 这具有中断当前渲染并切换到更新的效果
      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // TODO: 确保这不会覆盖我们在已经开始渲染时发生的 ping
        markRootSuspended(root, workInProgressRootRenderLanes);
      }
    }

    // 确保根节点被调度 - 连接到 Scheduler 的桥梁
    ensureRootIsScheduled(root, eventTime);

    // 处理同步更新的特殊情况（仅在传统模式下）
    if (
      lane === SyncLane &&
      executionContext === NoContext &&
      (fiber.mode & ConcurrentMode) === NoMode &&
      // 将 `act` 视为在 `batchedUpdates` 内部，即使在传统模式下也是如此
      !(__DEV__ && ReactCurrentActQueue.isBatchingLegacy)
    ) {
      // 立即刷新同步工作，除非我们已经在工作或处于批处理中
      // 这有意放在 scheduleUpdateOnFiber 内部而不是 scheduleCallbackForFiber 中
      // 以保留调度回调而不立即刷新它的能力
      // 我们只对用户发起的更新执行此操作，以保留传统模式的历史行为
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

export function scheduleInitialHydrationOnRoot(
  root: FiberRoot,
  lane: Lane,
  eventTime: number,
) {
  // This is a special fork of scheduleUpdateOnFiber that is only used to
  // schedule the initial hydration of a root that has just been created. Most
  // of the stuff in scheduleUpdateOnFiber can be skipped.
  //
  // The main reason for this separate path, though, is to distinguish the
  // initial children from subsequent updates. In fully client-rendered roots
  // (createRoot instead of hydrateRoot), all top-level renders are modeled as
  // updates, but hydration roots are special because the initial render must
  // match what was rendered on the server.
  const current = root.current;
  current.lanes = lane;
  markRootUpdated(root, lane, eventTime);
  ensureRootIsScheduled(root, eventTime);
}

export function isUnsafeClassRenderPhaseUpdate(fiber: Fiber) {
  // Check if this is a render phase update. Only called by class components,
  // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
  return (
    // TODO: Remove outdated deferRenderPhaseUpdateToNextBatch experiment. We
    // decided not to enable it.
    (!deferRenderPhaseUpdateToNextBatch ||
      (fiber.mode & ConcurrentMode) === NoMode) &&
    (executionContext & RenderContext) !== NoContext
  );
}

// 使用此函数为根节点调度任务。每个根节点只有一个任务；
// 如果任务已经调度，我们会检查确保现有任务的优先级与根节点需要工作的下一个级别的优先级相同。
// 此函数在每次更新时调用，并在退出任务之前调用。
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  console.log('ensureRootIsScheduled', '链接 Scheduler 的桥梁');
  const existingCallbackNode = root.callbackNode;

  // 检查是否有任何车道被其他工作饿死。如果有，将它们标记为过期，
  // 这样我们就知道接下来要处理这些车道。
  markStarvedLanesAsExpired(root, currentTime);

  // 确定下一个要工作的车道及其优先级。
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );

  if (nextLanes === NoLanes) {
    // 特殊情况：没有工作需要处理。
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  // 我们使用最高优先级的车道来表示回调的优先级。
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // 检查是否已有现有任务。我们可能能够重用它。
  const existingCallbackPriority = root.callbackPriority;
  if (
    existingCallbackPriority === newCallbackPriority &&
    // 与 `act` 相关的特殊情况。如果当前调度的任务是调度器任务，
    // 而不是 `act` 任务，则取消它并在 `act` 队列上重新调度。
    !(
      __DEV__ &&
      ReactCurrentActQueue.current !== null &&
      existingCallbackNode !== fakeActCallbackNode
    )
  ) {
    if (__DEV__) {
      // 如果我们要重用现有任务，它必须存在。
      // 假设离散更新微任务是不可取消的且为 null。
      // TODO: 临时，直到我们确认此警告不会触发。
      if (
        existingCallbackNode == null &&
        existingCallbackPriority !== SyncLane
      ) {
        console.error(
          'Expected scheduled callback to exist. This error is likely caused by a bug in React. Please file an issue.',
        );
      }
    }
    // 优先级没有改变。我们可以重用现有任务。退出。
    return;
  }

  if (existingCallbackNode != null) {
    // 取消现有回调。我们将在下面调度一个新的。
    cancelCallback(existingCallbackNode);
  }

  // 调度新的回调。
  let newCallbackNode;
  if (newCallbackPriority === SyncLane) { // （includesSyncLane）同步渲染，用户点击事件、输入事件、表单提交、紧急状态更新
    // 特殊情况：同步 React 回调在特殊的内部队列上调度
    if (root.tag === LegacyRoot) {
      if (__DEV__ && ReactCurrentActQueue.isBatchingLegacy !== null) {
        ReactCurrentActQueue.didScheduleLegacyUpdate = true;
      }
      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
    } else {
      // 添加到 syncQueue
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    }
    if (supportsMicrotasks) {
      // 在微任务中刷新队列。
      if (__DEV__ && ReactCurrentActQueue.current !== null) {
        // 在 `act` 内部，使用我们的内部 `act` 队列，这样即使在
        // 使用同步版本的 `act` 时，这些也会在当前作用域结束时被刷新。
        ReactCurrentActQueue.current.push(flushSyncCallbacks);
      } else {
        // 清空syncQueue
        scheduleMicrotask(() => {
          // 在 Safari 中，附加 iframe 会强制微任务运行。
          // https://github.com/facebook/react/issues/22459
          // 我们不支持在渲染或提交中间运行回调，所以我们需要检查。
          if (
            (executionContext & (RenderContext | CommitContext)) ===
            NoContext
          ) {
            // 注意，如果这发生在渲染或提交阶段之外（例如在事件中），
            // 这仍然会过早地刷新回调。
            flushSyncCallbacks();
          }
        });
      }
    } else { 
      // 在立即任务中刷新队列。
      scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);
    }
    newCallbackNode = null;
  } else { // 并发渲染，数据请求，transition
    // 根据车道优先级确定调度器优先级级别
    let schedulerPriorityLevel;
    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;
      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;
      case DefaultEventPriority:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
      case IdleEventPriority:
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;
      default:
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }
    // 调度并发工作回调
    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  }

  // 更新根节点的回调优先级和回调节点
  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}

/**
 * 执行根节点的并发工作
 * 这是每个并发任务的入口点，即任何通过 Scheduler 调度的任务
 * 
 * @param {FiberRoot} root - 要处理的根节点
 * @param {boolean} didTimeout - 是否超时
 * @returns {Function|null} 如果需要继续执行则返回绑定函数，否则返回 null
 */
function performConcurrentWorkOnRoot(root, didTimeout) {
  // 如果启用了性能分析定时器和嵌套更新阶段，重置嵌套更新标志
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    resetNestedUpdateFlag();
  }

  // 由于我们知道我们在 React 事件中，可以清除当前事件时间
  // 下一个更新将计算新的事件时间
  currentEventTime = NoTimestamp;
  currentEventTransitionLane = NoLanes;

  // 检查是否已经在渲染或提交上下文中，如果是则抛出错误
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  // 在决定处理哪些 lanes 之前，先刷新任何待处理的被动效果
  // 以防它们调度额外的工作
  const originalCallbackNode = root.callbackNode;
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    // 被动效果阶段中的某些操作可能已经取消了当前任务
    // 检查此根节点的任务节点是否已更改
    if (root.callbackNode !== originalCallbackNode) {
      // 当前任务已被取消，退出
      // 我们不需要调用 ensureRootIsScheduled，因为上面的检查意味着
      // 要么有新任务，要么此根节点上没有剩余工作
      return null;
    } else {
      // 当前任务未被取消，继续执行
    }
  }

  // 确定要处理的下一个 lanes，使用存储在根节点上的字段
  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );
  if (lanes === NoLanes) {
    // 防御性编程，这不应该发生
    return null;
  }

  // 在某些情况下我们禁用时间切片：
  // 1. 工作已经 CPU 密集型运行太久（"过期"工作，防止饥饿）
  // 2. 我们处于默认同步更新模式
  // TODO: 我们只是防御性地检查 didTimeout，以应对我们仍在调查的 Scheduler 错误
  // 一旦 Scheduler 中的错误被修复，我们可以删除这个，因为我们自己跟踪过期
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    (disableSchedulerTimeoutInWorkLoop || !didTimeout);
  
  // 根据是否应该时间切片选择渲染方式
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)  // 并发渲染
    : renderRootSync(root, lanes);      // 同步渲染
  // 如果渲染状态不是进行中，处理各种退出状态
  if (exitStatus !== RootInProgress) {
    if (exitStatus === RootErrored) {
      // 如果某些东西抛出错误，尝试再次渲染
      // 我们将同步渲染以阻止并发数据突变，并包含所有待处理的更新
      // 如果在第二次尝试后仍然失败，我们将放弃并提交结果树
      const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
      if (errorRetryLanes !== NoLanes) {
        lanes = errorRetryLanes;
        exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
      }
    }
    if (exitStatus === RootFatalErrored) {
      // 处理致命错误
      const fatalError = workInProgressRootFatalError;
      prepareFreshStack(root, NoLanes);
      markRootSuspended(root, lanes);
      ensureRootIsScheduled(root, now());
      throw fatalError;
    }

    if (exitStatus === RootDidNotComplete) {
      // 渲染在没有完成树的情况下展开，这在特殊情况下发生
      // 需要退出当前渲染而不产生一致的树或提交
      //
      // 这应该只在并发渲染期间发生，而不是离散或同步更新
      // 我们在展开堆栈时应该已经检查过这个
      markRootSuspended(root, lanes);
    } else {
      // 渲染已完成

      // 检查此渲染是否可能已让出给并发事件，如果是，
      // 确认任何新渲染的存储都是一致的
      // TODO: 即使并发渲染也可能从未让出给主线程，如果它足够快，或者如果它过期了
      // 在这种情况下，我们也可以跳过一致性检查
      const renderWasConcurrent = !includesBlockingLane(root, lanes);
      const finishedWork: Fiber = (root.current.alternate: any);
      if (
        renderWasConcurrent &&
        !isRenderConsistentWithExternalStores(finishedWork)
      ) {
        // 存储在一个交错事件中被突变，再次渲染，
        // 同步地，以阻止进一步的突变
        exitStatus = renderRootSync(root, lanes);

        // 我们需要再次检查是否有东西抛出错误
        if (exitStatus === RootErrored) {
          const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
          if (errorRetryLanes !== NoLanes) {
            lanes = errorRetryLanes;
            exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
            // 我们假设树现在是一致的，因为我们没有让出给任何并发事件
          }
        }
        if (exitStatus === RootFatalErrored) {
          const fatalError = workInProgressRootFatalError;
          prepareFreshStack(root, NoLanes);
          markRootSuspended(root, lanes);
          ensureRootIsScheduled(root, now());
          throw fatalError;
        }
      }

      // 我们现在有一个一致的树，下一步要么提交它，
      // 要么，如果某些东西被暂停，等待超时后提交它
      root.finishedWork = finishedWork;
      root.finishedLanes = lanes;
      finishConcurrentRender(root, exitStatus, lanes);
    }
  }

  // 确保根节点被调度
  ensureRootIsScheduled(root, now());
  if (root.callbackNode === originalCallbackNode) {
    // 为此根节点调度的任务节点与当前执行的节点相同
    // 需要返回一个延续函数
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  return null;
}

function recoverFromConcurrentError(root, errorRetryLanes) {
  // If an error occurred during hydration, discard server response and fall
  // back to client side render.

  // Before rendering again, save the errors from the previous attempt.
  const errorsFromFirstAttempt = workInProgressRootConcurrentErrors;

  if (isRootDehydrated(root)) {
    // The shell failed to hydrate. Set a flag to force a client rendering
    // during the next attempt. To do this, we call prepareFreshStack now
    // to create the root work-in-progress fiber. This is a bit weird in terms
    // of factoring, because it relies on renderRootSync not calling
    // prepareFreshStack again in the call below, which happens because the
    // root and lanes haven't changed.
    //
    // TODO: I think what we should do is set ForceClientRender inside
    // throwException, like we do for nested Suspense boundaries. The reason
    // it's here instead is so we can switch to the synchronous work loop, too.
    // Something to consider for a future refactor.
    const rootWorkInProgress = prepareFreshStack(root, errorRetryLanes);
    rootWorkInProgress.flags |= ForceClientRender;
    if (__DEV__) {
      errorHydratingContainer(root.containerInfo);
    }
  }

  const exitStatus = renderRootSync(root, errorRetryLanes);
  if (exitStatus !== RootErrored) {
    // Successfully finished rendering on retry

    // The errors from the failed first attempt have been recovered. Add
    // them to the collection of recoverable errors. We'll log them in the
    // commit phase.
    const errorsFromSecondAttempt = workInProgressRootRecoverableErrors;
    workInProgressRootRecoverableErrors = errorsFromFirstAttempt;
    // The errors from the second attempt should be queued after the errors
    // from the first attempt, to preserve the causal sequence.
    if (errorsFromSecondAttempt !== null) {
      queueRecoverableErrors(errorsFromSecondAttempt);
    }
  } else {
    // The UI failed to recover.
  }
  return exitStatus;
}

export function queueRecoverableErrors(errors: Array<CapturedValue<mixed>>) {
  if (workInProgressRootRecoverableErrors === null) {
    workInProgressRootRecoverableErrors = errors;
  } else {
    workInProgressRootRecoverableErrors.push.apply(
      workInProgressRootRecoverableErrors,
      errors,
    );
  }
}

function finishConcurrentRender(root, exitStatus, lanes) {
  switch (exitStatus) {
    case RootInProgress:
    case RootFatalErrored: {
      throw new Error('Root did not complete. This is a bug in React.');
    }
    // Flow knows about invariant, so it complains if I add a break
    // statement, but eslint doesn't know about invariant, so it complains
    // if I do. eslint-disable-next-line no-fallthrough
    case RootErrored: {
      // We should have already attempted to retry this tree. If we reached
      // this point, it errored again. Commit it.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootSuspended: {
      markRootSuspended(root, lanes);

      // We have an acceptable loading state. We need to figure out if we
      // should immediately commit it or wait a bit.

      if (
        includesOnlyRetries(lanes) &&
        // do not delay if we're inside an act() scope
        !shouldForceFlushFallbacksInDEV()
      ) {
        // This render only included retries, no updates. Throttle committing
        // retries so that we don't show too many loading states too quickly.
        const msUntilTimeout =
          globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
        // Don't bother with a very short suspense time.
        if (msUntilTimeout > 10) {
          const nextLanes = getNextLanes(root, NoLanes);
          if (nextLanes !== NoLanes) {
            // There's additional work on this root.
            break;
          }
          const suspendedLanes = root.suspendedLanes;
          if (!isSubsetOfLanes(suspendedLanes, lanes)) {
            // We should prefer to render the fallback of at the last
            // suspended level. Ping the last suspended level to try
            // rendering it again.
            // FIXME: What if the suspended lanes are Idle? Should not restart.
            const eventTime = requestEventTime();
            markRootPinged(root, suspendedLanes, eventTime);
            break;
          }

          // The render is suspended, it hasn't timed out, and there's no
          // lower priority work to do. Instead of committing the fallback
          // immediately, wait for more data to arrive.
          root.timeoutHandle = scheduleTimeout(
            commitRoot.bind(
              null,
              root,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions,
            ),
            msUntilTimeout,
          );
          break;
        }
      }
      // The work expired. Commit immediately.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootSuspendedWithDelay: {
      markRootSuspended(root, lanes);

      if (includesOnlyTransitions(lanes)) {
        // This is a transition, so we should exit without committing a
        // placeholder and without scheduling a timeout. Delay indefinitely
        // until we receive more data.
        break;
      }

      if (!shouldForceFlushFallbacksInDEV()) {
        // This is not a transition, but we did trigger an avoided state.
        // Schedule a placeholder to display after a short delay, using the Just
        // Noticeable Difference.
        // TODO: Is the JND optimization worth the added complexity? If this is
        // the only reason we track the event time, then probably not.
        // Consider removing.

        const mostRecentEventTime = getMostRecentEventTime(root, lanes);
        const eventTimeMs = mostRecentEventTime;
        const timeElapsedMs = now() - eventTimeMs;
        const msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;

        // Don't bother with a very short suspense time.
        if (msUntilTimeout > 10) {
          // Instead of committing the fallback immediately, wait for more data
          // to arrive.
          root.timeoutHandle = scheduleTimeout(
            commitRoot.bind(
              null,
              root,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions,
            ),
            msUntilTimeout,
          );
          break;
        }
      }

      // Commit the placeholder.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootCompleted: {
      // The work completed. Ready to commit.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    default: {
      throw new Error('Unknown root exit status.');
    }
  }
}

function isRenderConsistentWithExternalStores(finishedWork: Fiber): boolean {
  // Search the rendered tree for external store reads, and check whether the
  // stores were mutated in a concurrent event. Intentionally using an iterative
  // loop instead of recursion so we can exit early.
  let node: Fiber = finishedWork;
  while (true) {
    if (node.flags & StoreConsistency) {
      const updateQueue: FunctionComponentUpdateQueue | null = (node.updateQueue: any);
      if (updateQueue !== null) {
        const checks = updateQueue.stores;
        if (checks !== null) {
          for (let i = 0; i < checks.length; i++) {
            const check = checks[i];
            const getSnapshot = check.getSnapshot;
            const renderedValue = check.value;
            try {
              if (!is(getSnapshot(), renderedValue)) {
                // Found an inconsistent store.
                return false;
              }
            } catch (error) {
              // If `getSnapshot` throws, return `false`. This will schedule
              // a re-render, and the error will be rethrown during render.
              return false;
            }
          }
        }
      }
    }
    const child = node.child;
    if (node.subtreeFlags & StoreConsistency && child !== null) {
      child.return = node;
      node = child;
      continue;
    }
    if (node === finishedWork) {
      return true;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return true;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  // Flow doesn't know this is unreachable, but eslint does
  // eslint-disable-next-line no-unreachable
  return true;
}

function markRootSuspended(root, suspendedLanes) {
  // When suspending, we should always exclude lanes that were pinged or (more
  // rarely, since we try to avoid it) updated during the render phase.
  // TODO: Lol maybe there's a better way to factor this besides this
  // obnoxiously named function :)
  suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
  suspendedLanes = removeLanes(
    suspendedLanes,
    workInProgressRootInterleavedUpdatedLanes,
  );
  markRootSuspended_dontCallThisOneDirectly(root, suspendedLanes);
}

// This is the entry point for synchronous tasks that don't go
// through Scheduler
function performSyncWorkOnRoot(root) {
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    syncNestedUpdateFlag();
  }

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  flushPassiveEffects();

  let lanes = getNextLanes(root, NoLanes);
  if (!includesSomeLane(lanes, SyncLane)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root, now());
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);
  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // If something threw an error, try rendering one more time. We'll render
    // synchronously to block concurrent data mutations, and we'll includes
    // all pending updates are included. If it still fails after the second
    // attempt, we'll give up and commit the resulting tree.
    const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
    if (errorRetryLanes !== NoLanes) {
      lanes = errorRetryLanes;
      exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
    }
  }

  if (exitStatus === RootFatalErrored) {
    const fatalError = workInProgressRootFatalError;
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, lanes);
    ensureRootIsScheduled(root, now());
    throw fatalError;
  }

  if (exitStatus === RootDidNotComplete) {
    throw new Error('Root did not complete. This is a bug in React.');
  }

  // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.
  const finishedWork: Fiber = (root.current.alternate: any);
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(
    root,
    workInProgressRootRecoverableErrors,
    workInProgressTransitions,
  );

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root, now());

  return null;
}

export function flushRoot(root: FiberRoot, lanes: Lanes) {
  if (lanes !== NoLanes) {
    markRootEntangled(root, mergeLanes(lanes, SyncLane));
    ensureRootIsScheduled(root, now());
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      resetRenderTimer();
      flushSyncCallbacks();
    }
  }
}

export function getExecutionContext(): ExecutionContext {
  return executionContext;
}

export function deferredUpdates<A>(fn: () => A): A {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DefaultEventPriority);
    return fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

export function batchedUpdates<A, R>(fn: A => R, a: A): R {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    // If there were legacy sync updates, flush them at the end of the outer
    // most batchedUpdates-like method.
    if (
      executionContext === NoContext &&
      // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
      !(__DEV__ && ReactCurrentActQueue.isBatchingLegacy)
    ) {
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

export function discreteUpdates<A, B, C, D, R>(
  fn: (A, B, C, D) => R,
  a: A,
  b: B,
  c: C,
  d: D,
): R {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    return fn(a, b, c, d);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
    if (executionContext === NoContext) {
      resetRenderTimer();
    }
  }
}

// Overload the definition to the two valid signatures.
// Warning, this opts-out of checking the function body.
declare function flushSync<R>(fn: () => R): R;
// eslint-disable-next-line no-redeclare
declare function flushSync(): void;
// eslint-disable-next-line no-redeclare
export function flushSync(fn) {
  // In legacy mode, we flush pending passive effects at the beginning of the
  // next event, not at the end of the previous one.
  if (
    rootWithPendingPassiveEffects !== null &&
    rootWithPendingPassiveEffects.tag === LegacyRoot &&
    (executionContext & (RenderContext | CommitContext)) === NoContext
  ) {
    flushPassiveEffects();
  }

  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;

  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    // Flush the immediate callbacks that were scheduled during this batch.
    // Note that this will happen even if batchedUpdates is higher up
    // the stack.
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      flushSyncCallbacks();
    }
  }
}

export function isAlreadyRendering() {
  // Used by the renderer to print a warning if certain APIs are called from
  // the wrong context.
  return (
    __DEV__ &&
    (executionContext & (RenderContext | CommitContext)) !== NoContext
  );
}

export function flushControlled(fn: () => mixed): void {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      resetRenderTimer();
      flushSyncCallbacks();
    }
  }
}

// This is called by the HiddenContext module when we enter or leave a
// hidden subtree. The stack logic is managed there because that's the only
// place that ever modifies it. Which module it lives in doesn't matter for
// performance because this function will get inlined regardless
export function setRenderLanes(subtreeRenderLanes: Lanes) {
  renderLanes = subtreeRenderLanes;
}

export function getRenderLanes(): Lanes {
  return renderLanes;
}

/**
 * prepareFreshStack
 * 准备新的工作栈：为新的渲染周期初始化所有相关状态
 * - 清理之前渲染的完成状态和超时处理
 * - 处理被中断的工作栈，确保状态一致性
 * - 创建新的工作进度 Fiber 并初始化全局状态
 * - 完成并发更新的队列化处理
 * 
 * @param {FiberRoot} root - 要准备新工作栈的根节点
 * @param {Lanes} lanes - 新的渲染优先级车道
 * @returns {Fiber} 新创建的工作进度根 Fiber
 */
function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  // 清理根节点的完成状态：重置已完成的工作和车道
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  // 处理超时回调：如果根节点之前暂停并设置了超时回调
  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // 根节点之前暂停并调度了超时来提交回退状态
    // 现在我们有了额外的工作，取消这个超时
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }

  // 处理被中断的工作：如果当前有进行中的工作，需要清理
  if (workInProgress !== null) {
    // 从当前工作单元开始，向上遍历到根节点
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      const current = interruptedWork.alternate;
      // 展开被中断的工作：清理状态并恢复一致性
      unwindInterruptedWork(
        current,
        interruptedWork,
        workInProgressRootRenderLanes,
      );
      // 继续向上遍历父节点
      interruptedWork = interruptedWork.return;
    }
  }
  
  // 设置新的工作根节点
  workInProgressRoot = root;
  
  // 为根节点创建新的工作进度 Fiber
  // 这是整个渲染树的起点，alternate 为 null 表示是全新的工作
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  
  // 初始化渲染相关的全局状态
  workInProgressRootRenderLanes = renderLanes = lanes; // 设置渲染车道
  workInProgressRootExitStatus = RootInProgress; // 标记为进行中状态
  workInProgressRootFatalError = null; // 清空致命错误
  workInProgressRootSkippedLanes = NoLanes; // 清空跳过的车道
  workInProgressRootInterleavedUpdatedLanes = NoLanes; // 清空交错更新的车道
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes; // 清空渲染阶段更新的车道
  workInProgressRootPingedLanes = NoLanes; // 清空被 ping 的车道
  workInProgressRootConcurrentErrors = null; // 清空并发错误
  workInProgressRootRecoverableErrors = null; // 清空可恢复错误

  // 完成并发更新的队列化：将待处理的更新加入队列
  finishQueueingConcurrentUpdates();

  // 开发模式：丢弃待处理的严格模式警告
  if (__DEV__) {
    ReactStrictModeWarnings.discardPendingWarnings();
  }

  // 返回新创建的工作进度根 Fiber
  return rootWorkInProgress;
}

function handleError(root, thrownValue): void {
  do {
    let erroredWork = workInProgress;
    try {
      // Reset module-level state that was set during the render phase.
      resetContextDependencies();
      resetHooksAfterThrow();
      resetCurrentDebugFiberInDEV();
      // TODO: I found and added this missing line while investigating a
      // separate issue. Write a regression test using string refs.
      ReactCurrentOwner.current = null;

      if (erroredWork === null || erroredWork.return === null) {
        // Expected to be working on a non-root fiber. This is a fatal error
        // because there's no ancestor that can handle it; the root is
        // supposed to capture all errors that weren't caught by an error
        // boundary.
        workInProgressRootExitStatus = RootFatalErrored;
        workInProgressRootFatalError = thrownValue;
        // Set `workInProgress` to null. This represents advancing to the next
        // sibling, or the parent if there are no siblings. But since the root
        // has no siblings nor a parent, we set it to null. Usually this is
        // handled by `completeUnitOfWork` or `unwindWork`, but since we're
        // intentionally not calling those, we need set it here.
        // TODO: Consider calling `unwindWork` to pop the contexts.
        workInProgress = null;
        return;
      }

      if (enableProfilerTimer && erroredWork.mode & ProfileMode) {
        // Record the time spent rendering before an error was thrown. This
        // avoids inaccurate Profiler durations in the case of a
        // suspended render.
        stopProfilerTimerIfRunningAndRecordDelta(erroredWork, true);
      }

      if (enableSchedulingProfiler) {
        markComponentRenderStopped();

        if (
          thrownValue !== null &&
          typeof thrownValue === 'object' &&
          typeof thrownValue.then === 'function'
        ) {
          const wakeable: Wakeable = (thrownValue: any);
          markComponentSuspended(
            erroredWork,
            wakeable,
            workInProgressRootRenderLanes,
          );
        } else {
          markComponentErrored(
            erroredWork,
            thrownValue,
            workInProgressRootRenderLanes,
          );
        }
      }

      throwException(
        root,
        erroredWork.return,
        erroredWork,
        thrownValue,
        workInProgressRootRenderLanes,
      );
      completeUnitOfWork(erroredWork);
    } catch (yetAnotherThrownValue) {
      // Something in the return path also threw.
      thrownValue = yetAnotherThrownValue;
      if (workInProgress === erroredWork && erroredWork !== null) {
        // If this boundary has already errored, then we had trouble processing
        // the error. Bubble it to the next boundary.
        erroredWork = erroredWork.return;
        workInProgress = erroredWork;
      } else {
        erroredWork = workInProgress;
      }
      continue;
    }
    // Return to the normal work loop.
    return;
  } while (true);
}

function pushDispatcher() {
  const prevDispatcher = ReactCurrentDispatcher.current;
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
  if (prevDispatcher === null) {
    // The React isomorphic package does not include a default dispatcher.
    // Instead the first renderer will lazily attach one, in order to give
    // nicer error messages.
    return ContextOnlyDispatcher;
  } else {
    return prevDispatcher;
  }
}

function popDispatcher(prevDispatcher) {
  ReactCurrentDispatcher.current = prevDispatcher;
}

export function markCommitTimeOfFallback() {
  globalMostRecentFallbackTime = now();
}

export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  workInProgressRootSkippedLanes = mergeLanes(
    lane,
    workInProgressRootSkippedLanes,
  );
}

export function renderDidSuspend(): void {
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootSuspended;
  }
}

export function renderDidSuspendDelayIfPossible(): void {
  if (
    workInProgressRootExitStatus === RootInProgress ||
    workInProgressRootExitStatus === RootSuspended ||
    workInProgressRootExitStatus === RootErrored
  ) {
    workInProgressRootExitStatus = RootSuspendedWithDelay;
  }

  // Check if there are updates that we skipped tree that might have unblocked
  // this render.
  if (
    workInProgressRoot !== null &&
    (includesNonIdleWork(workInProgressRootSkippedLanes) ||
      includesNonIdleWork(workInProgressRootInterleavedUpdatedLanes))
  ) {
    // Mark the current render as suspended so that we switch to working on
    // the updates that were skipped. Usually we only suspend at the end of
    // the render phase.
    // TODO: We should probably always mark the root as suspended immediately
    // (inside this function), since by suspending at the end of the render
    // phase introduces a potential mistake where we suspend lanes that were
    // pinged or updated while we were rendering.
    markRootSuspended(workInProgressRoot, workInProgressRootRenderLanes);
  }
}

export function renderDidError(error: CapturedValue<mixed>) {
  if (workInProgressRootExitStatus !== RootSuspendedWithDelay) {
    workInProgressRootExitStatus = RootErrored;
  }
  if (workInProgressRootConcurrentErrors === null) {
    workInProgressRootConcurrentErrors = [error];
  } else {
    workInProgressRootConcurrentErrors.push(error);
  }
}

// Called during render to determine if anything has suspended.
// Returns false if we're not sure.
export function renderHasNotSuspendedYet(): boolean {
  // If something errored or completed, we can't really be sure,
  // so those are false.
  return workInProgressRootExitStatus === RootInProgress;
}

function renderRootSync(root: FiberRoot, lanes: Lanes) {
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        const memoizedUpdaters = root.memoizedUpdaters;
        if (memoizedUpdaters.size > 0) {
          restorePendingUpdaters(root, workInProgressRootRenderLanes);
          memoizedUpdaters.clear();
        }

        // At this point, move Fibers that scheduled the upcoming work from the Map to the Set.
        // If we bailout on this work, we'll move them back (like above).
        // It's important to move them now in case the work spawns more work at the same priority with different updaters.
        // That way we can keep the current update and future updates separate.
        movePendingFibersToMemoized(root, lanes);
      }
    }

    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    prepareFreshStack(root, lanes);
  }

  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStarted(lanes);
    }
  }

  if (enableSchedulingProfiler) {
    markRenderStarted(lanes);
  }

  do {
    try {
      workLoopSync();
      break;
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  executionContext = prevExecutionContext;
  popDispatcher(prevDispatcher);

  if (workInProgress !== null) {
    // This is a sync render, so we should have finished the whole tree.
    throw new Error(
      'Cannot commit an incomplete root. This error is likely caused by a ' +
        'bug in React. Please file an issue.',
    );
  }

  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStopped();
    }
  }

  if (enableSchedulingProfiler) {
    markRenderStopped();
  }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  return workInProgressRootExitStatus;
}

// The work loop is an extremely hot path. Tell Closure not to inline it.
/** @noinline */
function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * renderRootConcurrent
 * 并发渲染根节点：在时间切片中执行 Fiber 树的渲染工作
 * - 支持中断和恢复，通过 workLoopConcurrent 实现时间切片
 * - 处理根节点或优先级变化时的状态重置
 * - 管理开发工具的状态跟踪和性能分析
 * 
 * @param {FiberRoot} root - 要渲染的 Fiber 根节点
 * @param {Lanes} lanes - 渲染优先级车道
 * @returns {RootExitStatus} 渲染结果状态
 */
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  // 保存当前执行上下文，并切换到渲染上下文
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  
  // 保存当前 dispatcher，并推入新的 dispatcher
  const prevDispatcher = pushDispatcher();

  // 检查是否需要重置工作栈
  // 如果根节点或优先级车道发生变化，丢弃现有栈并准备新的
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    // 开发工具状态跟踪：处理更新器状态
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        const memoizedUpdaters = root.memoizedUpdaters;
        if (memoizedUpdaters.size > 0) {
          // 恢复待处理的更新器到之前的状态
          restorePendingUpdaters(root, workInProgressRootRenderLanes);
          memoizedUpdaters.clear();
        }

        // 将调度了即将进行的工作的 Fiber 从 Map 移动到 Set
        // 如果在此工作上回退，我们会将它们移回（如上面所示）
        // 现在移动它们很重要，以防工作在同一优先级下产生更多具有不同更新器的工作
        // 这样我们可以将当前更新和未来更新分开
        movePendingFibersToMemoized(root, lanes);
      }
    }

    // 获取当前优先级车道对应的过渡状态
    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    
    // 重置渲染计时器
    resetRenderTimer();
    
    // 准备新的工作栈：初始化 workInProgress 和相关状态
    prepareFreshStack(root, lanes);
  }

  // 开发模式：记录渲染开始
  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStarted(lanes);
    }
  }

  // 性能分析：标记渲染开始
  if (enableSchedulingProfiler) {
    markRenderStarted(lanes);
  }

  // 主渲染循环：持续执行直到完成或出错
  do {
    try {
      // 执行并发工作循环，可能被时间切片中断
      workLoopConcurrent();
      break; // 正常完成，退出循环
    } catch (thrownValue) {
      // 捕获错误并处理，然后继续循环
      handleError(root, thrownValue);
    }
  } while (true);
  
  // 重置上下文依赖
  resetContextDependencies();

  // 恢复之前的 dispatcher 和执行上下文
  popDispatcher(prevDispatcher);
  executionContext = prevExecutionContext;

  // 开发模式：记录渲染停止
  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStopped();
    }
  }

  // 检查渲染是否完成
  if (workInProgress !== null) {
    // 还有剩余工作：渲染被中断，需要继续
    if (enableSchedulingProfiler) {
      markRenderYielded(); // 标记渲染让出
    }
    return RootInProgress; // 返回进行中状态
  } else {
    // 渲染完成：整个树已处理完毕
    if (enableSchedulingProfiler) {
      markRenderStopped(); // 标记渲染停止
    }

    // 清空进行中的渲染状态
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;

    // 返回最终的退出状态（可能是 RootCompleted 或 RootFatalErrored）
    return workInProgressRootExitStatus;
  }
}

/** @noinline */
/**
 * workLoopConcurrent
 * 并发工作循环：在时间切片中持续执行 Fiber 工作单元
 * - 通过 shouldYield() 检查是否应该让出控制权给调度器
 * - 每次循环处理一个工作单元，直到没有工作或需要让出
 * - 这是 React 并发特性的核心实现，支持渲染中断和恢复
 */
function workLoopConcurrent() {
  // 持续执行工作直到调度器要求让出控制权
  // workInProgress !== null：还有待处理的工作单元
  // !shouldYield()：调度器允许继续执行（未达到时间切片边界）
  while (workInProgress !== null && !shouldYield()) {
    // 执行当前工作单元：包括 beginWork 和 completeWork
    // 执行后 workInProgress 会指向下一个待处理的工作单元
    performUnitOfWork(workInProgress);
  }
  // 循环结束条件：
  // 1. workInProgress === null：所有工作单元已处理完毕
  // 2. shouldYield() === true：达到时间切片边界，需要让出控制权
}

/**
 * performUnitOfWork
 * 执行单个工作单元：处理一个 Fiber 节点的渲染工作
 * - 调用 beginWork 进行组件的渲染和子节点的创建
 * - 根据 beginWork 的返回值决定下一步操作
 * - 支持性能分析和开发调试功能
 * 
 * @param {Fiber} unitOfWork - 要处理的工作单元 Fiber 节点
 */
function performUnitOfWork(unitOfWork: Fiber): void {
  // 获取当前 Fiber 的 alternate（已提交的版本）
  // 英文注释翻译：
  // 这个 Fiber 的当前、已刷新的状态是 alternate。理想情况下
  // 不应该依赖这个，但在这里依赖它意味着我们不需要
  // 在工作进度中添加额外的字段。
  // 中文详细解释：
  // alternate 是 Fiber 的双缓存机制中的已提交版本
  // 通过 alternate 可以获取到组件的前一次渲染结果
  // 用于 diff 算法和状态比较
  const current = unitOfWork.alternate;
  
  // 开发模式：设置当前调试的 Fiber 节点
  setCurrentDebugFiberInDEV(unitOfWork);

  let next; // 下一个要处理的工作单元
  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
    // 性能分析模式：记录组件渲染时间
    startProfilerTimer(unitOfWork);
    // 执行 beginWork：渲染当前组件并创建子节点
    next = beginWork(current, unitOfWork, renderLanes);
    // 停止计时器并记录渲染耗时
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    // 普通模式：直接执行 beginWork
    next = beginWork(current, unitOfWork, renderLanes);
  }

  // 开发模式：重置当前调试的 Fiber 节点
  resetCurrentDebugFiberInDEV();
  
  // 将待处理的 props 标记为已记忆的 props
  // 这表示这些 props 已经被处理过了
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  
  if (next === null) {
    // beginWork 返回 null：当前工作单元没有产生新的子工作
    // 英文注释翻译：
    // 如果这没有产生新的工作，完成当前工作。
    // 中文详细解释：
    // 当组件没有子组件或者子组件不需要更新时
    // beginWork 会返回 null，表示当前节点的工作已完成
    // 需要调用 completeUnitOfWork 来完成当前节点的工作
    completeUnitOfWork(unitOfWork);
  } else {
    // beginWork 返回了子 Fiber：还有新的工作单元需要处理
    // 将 workInProgress 指向下一个要处理的工作单元
    // 这样 workLoopConcurrent 会在下次循环中处理这个新的工作单元
    workInProgress = next;
  }

  // 清空当前所有者引用，避免内存泄漏
  // 这是 React 内部状态管理的一部分
  ReactCurrentOwner.current = null;
}

/**
 * completeUnitOfWork
 * 完成当前工作单元，并按深度优先的逆序回溯到兄弟或父节点
 * - 正常路径：进入 completeWork，可能派生出新的工作（如插入副作用）
 * - 异常路径：进入 unwindWork，回滚并标记父级未完成
 * - 回溯策略：优先处理兄弟；无兄弟则回到父级；到根则设置完成状态
 */
function completeUnitOfWork(unitOfWork: Fiber): void {
  // 尝试完成当前工作单元，然后处理下一个兄弟；若无兄弟则回到父节点
  let completedWork = unitOfWork;
  do {
    // alternate：该 Fiber 在已提交树中的对应节点（用于对比与回滚）
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    // 分支：本节点是否正常完成（未带有 Incomplete 标记）
    if ((completedWork.flags & Incomplete) === NoFlags) {
      setCurrentDebugFiberInDEV(completedWork);
      let next;
      if (
        !enableProfilerTimer ||
        (completedWork.mode & ProfileMode) === NoMode
      ) {
        // 正常完成阶段：执行 completeWork，可能生成更多工作（如副作用收集）
        next = completeWork(current, completedWork, renderLanes);
      } else {
        // 性能分析：记录完成阶段耗时
        startProfilerTimer(completedWork);
        next = completeWork(current, completedWork, renderLanes);
        // 未出错前提下更新渲染耗时
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
      }
      resetCurrentDebugFiberInDEV();

      if (next !== null) {
        // completeWork 派生出新的工作（例如向上冒泡的副作用或更新）
        // 立即切换去处理该工作
        workInProgress = next;
        return;
      }
    } else {
      // 异常路径：该 Fiber 未完成（抛错或中断）
      // 不进入 complete 阶段，转而展开回滚逻辑
      const next = unwindWork(current, completedWork, renderLanes);

      // 注意：未完成的节点不重置其 lanes，保持后续可重试性

      if (next !== null) {
        // 回滚可能派生出新的需要立刻处理的工作
        // 既然是重新开始，去除非 host effect 的标记，只保留宿主相关效果
        next.flags &= HostEffectMask;
        workInProgress = next;
        return;
      }

      if (
        enableProfilerTimer &&
        (completedWork.mode & ProfileMode) !== NoMode
      ) {
        // 记录出错 Fiber 的渲染耗时，并将失败子树的耗时汇总到当前
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);

        let actualDuration = completedWork.actualDuration;
        let child = completedWork.child;
        while (child !== null) {
          actualDuration += child.actualDuration;
          child = child.sibling;
        }
        completedWork.actualDuration = actualDuration;
      }

      if (returnFiber !== null) {
        // 向上标记父 Fiber 未完成，并清空其子树副作用标记与删除列表
        returnFiber.flags |= Incomplete;
        returnFiber.subtreeFlags = NoFlags;
        returnFiber.deletions = null;
      } else {
        // 已经回溯到根：本次渲染未能完成
        workInProgressRootExitStatus = RootDidNotComplete;
        workInProgress = null;
        return;
      }
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      // 还有兄弟节点：转去处理兄弟分支
      workInProgress = siblingFiber;
      return;
    }
    // 无兄弟：回到父节点，继续在父层级回溯
    completedWork = returnFiber;
    // 发生异常时，保持 workInProgress 指向正在回溯的节点
    workInProgress = completedWork;
  } while (completedWork !== null);

  // 回溯到根：若之前仍为进行中，则标记为已完成
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

function commitRoot(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null,
) {
  // TODO: This no longer makes any sense. We already wrap the mutation and
  // layout phases. Should be able to remove.
  const previousUpdateLanePriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    commitRootImpl(
      root,
      recoverableErrors,
      transitions,
      previousUpdateLanePriority,
    );
  } finally {
    ReactCurrentBatchConfig.transition = prevTransition;
    setCurrentUpdatePriority(previousUpdateLanePriority);
  }

  return null;
}

function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null,
  renderPriorityLevel: EventPriority,
) {
  do {
    // `flushPassiveEffects` will call `flushSyncUpdateQueue` at the end, which
    // means `flushPassiveEffects` will sometimes result in additional
    // passive effects. So we need to keep flushing in a loop until there are
    // no more pending effects.
    // TODO: Might be better if `flushPassiveEffects` did not automatically
    // flush synchronous work at the end, to avoid factoring hazards like this.
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);
  flushRenderPhaseStrictModeWarningsInDEV();

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  if (__DEV__) {
    if (enableDebugTracing) {
      logCommitStarted(lanes);
    }
  }

  if (enableSchedulingProfiler) {
    markCommitStarted(lanes);
  }

  if (finishedWork === null) {
    if (__DEV__) {
      if (enableDebugTracing) {
        logCommitStopped();
      }
    }

    if (enableSchedulingProfiler) {
      markCommitStopped();
    }

    return null;
  } else {
    if (__DEV__) {
      if (lanes === NoLanes) {
        console.error(
          'root.finishedLanes should not be empty during a commit. This is a ' +
            'bug in React.',
        );
      }
    }
  }
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  if (finishedWork === root.current) {
    throw new Error(
      'Cannot commit the same tree as before. This error is likely caused by ' +
        'a bug in React. Please file an issue.',
    );
  }

  // commitRoot never returns a continuation; it always finishes synchronously.
  // So we can clear these now to allow a new callback to be scheduled.
  root.callbackNode = null;
  root.callbackPriority = NoLane;

  // Check which lanes no longer have any work scheduled on them, and mark
  // those as finished.
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);

  // Make sure to account for lanes that were updated by a concurrent event
  // during the render phase; don't mark them as finished.
  const concurrentlyUpdatedLanes = getConcurrentlyUpdatedLanes();
  remainingLanes = mergeLanes(remainingLanes, concurrentlyUpdatedLanes);

  markRootFinished(root, remainingLanes);

  if (root === workInProgressRoot) {
    // We can reset these now that they are finished.
    workInProgressRoot = null;
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;
  } else {
    // This indicates that the last root we worked on is not the same one that
    // we're committing now. This most commonly happens when a suspended root
    // times out.
  }

  // If there are pending passive effects, schedule a callback to process them.
  // Do this as early as possible, so it is queued before anything else that
  // might get scheduled in the commit phase. (See #16714.)
  // TODO: Delete all other places that schedule the passive effect callback
  // They're redundant.
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      pendingPassiveEffectsRemainingLanes = remainingLanes;
      // workInProgressTransitions might be overwritten, so we want
      // to store it in pendingPassiveTransitions until they get processed
      // We need to pass this through as an argument to commitRoot
      // because workInProgressTransitions might have changed between
      // the previous render and commit if we throttle the commit
      // with setTimeout
      pendingPassiveTransitions = transitions;
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        // This render triggered passive effects: release the root cache pool
        // *after* passive effects fire to avoid freeing a cache pool that may
        // be referenced by a node in the tree (HostRoot, Cache boundary etc)
        return null;
      });
    }
  }

  // Check if there are any effects in the whole tree.
  // TODO: This is left over from the effect list implementation, where we had
  // to check for the existence of `firstEffect` to satisfy Flow. I think the
  // only other reason this optimization exists is because it affects profiling.
  // Reconsider whether this is necessary.
  const subtreeHasEffects =
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffect =
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const prevTransition = ReactCurrentBatchConfig.transition;
    ReactCurrentBatchConfig.transition = null;
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(DiscreteEventPriority);

    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    // Reset this to null before calling lifecycles
    ReactCurrentOwner.current = null;

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
      root,
      finishedWork,
    );

    if (enableProfilerTimer) {
      // Mark the current commit time to be shared by all Profilers in this
      // batch. This enables them to be grouped later.
      recordCommitTime();
    }

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      // Track the root here, rather than in commitLayoutEffects(), because of ref setters.
      // Updates scheduled during ref detachment should also be flagged.
      rootCommittingMutationOrLayoutEffects = root;
    }

    // The next phase is the mutation phase, where we mutate the host tree.
    commitMutationEffects(root, finishedWork, lanes);

    if (enableCreateEventHandleAPI) {
      if (shouldFireAfterActiveInstanceBlur) {
        afterActiveInstanceBlur();
      }
    }
    resetAfterCommit(root.containerInfo);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    if (__DEV__) {
      if (enableDebugTracing) {
        logLayoutEffectsStarted(lanes);
      }
    }
    if (enableSchedulingProfiler) {
      markLayoutEffectsStarted(lanes);
    }
    commitLayoutEffects(finishedWork, root, lanes);
    if (__DEV__) {
      if (enableDebugTracing) {
        logLayoutEffectsStopped();
      }
    }

    if (enableSchedulingProfiler) {
      markLayoutEffectsStopped();
    }

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      rootCommittingMutationOrLayoutEffects = null;
    }

    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();

    executionContext = prevExecutionContext;

    // Reset the priority to the previous non-sync value.
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  } else {
    // No effects.
    root.current = finishedWork;
    // Measure these anyway so the flamegraph explicitly shows that there were
    // no effects.
    // TODO: Maybe there's a better way to report this.
    if (enableProfilerTimer) {
      recordCommitTime();
    }
  }

  const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

  if (rootDoesHavePassiveEffects) {
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsLanes = lanes;
  } else {
    // There were no passive effects, so we can immediately release the cache
    // pool for this render.
    releaseRootPooledCache(root, remainingLanes);
    if (__DEV__) {
      nestedPassiveUpdateCount = 0;
      rootWithPassiveNestedUpdates = null;
    }
  }

  // Read this again, since an effect might have updated it
  remainingLanes = root.pendingLanes;

  // Check if there's remaining work on this root
  // TODO: This is part of the `componentDidCatch` implementation. Its purpose
  // is to detect whether something might have called setState inside
  // `componentDidCatch`. The mechanism is known to be flawed because `setState`
  // inside `componentDidCatch` is itself flawed — that's why we recommend
  // `getDerivedStateFromError` instead. However, it could be improved by
  // checking if remainingLanes includes Sync work, instead of whether there's
  // any work remaining at all (which would also include stuff like Suspense
  // retries or transitions). It's been like this for a while, though, so fixing
  // it probably isn't that urgent.
  if (remainingLanes === NoLanes) {
    // If there's no remaining work, we can clear the set of already failed
    // error boundaries.
    legacyErrorBoundariesThatAlreadyFailed = null;
  }

  if (__DEV__ && enableStrictEffects) {
    if (!rootDidHavePassiveEffects) {
      commitDoubleInvokeEffectsInDEV(root.current, false);
    }
  }

  onCommitRootDevTools(finishedWork.stateNode, renderPriorityLevel);

  if (enableUpdaterTracking) {
    if (isDevToolsPresent) {
      root.memoizedUpdaters.clear();
    }
  }

  if (__DEV__) {
    onCommitRootTestSelector();
  }

  // Always call this before exiting `commitRoot`, to ensure that any
  // additional work on this root is scheduled.
  ensureRootIsScheduled(root, now());

  if (recoverableErrors !== null) {
    // There were errors during this render, but recovered from them without
    // needing to surface it to the UI. We log them here.
    const onRecoverableError = root.onRecoverableError;
    for (let i = 0; i < recoverableErrors.length; i++) {
      const recoverableError = recoverableErrors[i];
      const componentStack = recoverableError.stack;
      const digest = recoverableError.digest;
      onRecoverableError(recoverableError.value, {componentStack, digest});
    }
  }

  if (hasUncaughtError) {
    hasUncaughtError = false;
    const error = firstUncaughtError;
    firstUncaughtError = null;
    throw error;
  }

  // If the passive effects are the result of a discrete render, flush them
  // synchronously at the end of the current task so that the result is
  // immediately observable. Otherwise, we assume that they are not
  // order-dependent and do not need to be observed by external systems, so we
  // can wait until after paint.
  // TODO: We can optimize this by not scheduling the callback earlier. Since we
  // currently schedule the callback in multiple places, will wait until those
  // are consolidated.
  if (
    includesSomeLane(pendingPassiveEffectsLanes, SyncLane) &&
    root.tag !== LegacyRoot
  ) {
    flushPassiveEffects();
  }

  // Read this again, since a passive effect might have updated it
  remainingLanes = root.pendingLanes;
  if (includesSomeLane(remainingLanes, (SyncLane: Lane))) {
    if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
      markNestedUpdateScheduled();
    }

    // Count the number of times the root synchronously re-renders without
    // finishing. If there are too many, it indicates an infinite update loop.
    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  // If layout work was scheduled, flush it now.
  flushSyncCallbacks();

  if (__DEV__) {
    if (enableDebugTracing) {
      logCommitStopped();
    }
  }

  if (enableSchedulingProfiler) {
    markCommitStopped();
  }

  return null;
}

function releaseRootPooledCache(root: FiberRoot, remainingLanes: Lanes) {
  if (enableCache) {
    const pooledCacheLanes = (root.pooledCacheLanes &= remainingLanes);
    if (pooledCacheLanes === NoLanes) {
      // None of the remaining work relies on the cache pool. Clear it so
      // subsequent requests get a new cache
      const pooledCache = root.pooledCache;
      if (pooledCache != null) {
        root.pooledCache = null;
        releaseCache(pooledCache);
      }
    }
  }
}

export function flushPassiveEffects(): boolean {
  // Returns whether passive effects were flushed.
  // TODO: Combine this check with the one in flushPassiveEFfectsImpl. We should
  // probably just combine the two functions. I believe they were only separate
  // in the first place because we used to wrap it with
  // `Scheduler.runWithPriority`, which accepts a function. But now we track the
  // priority within React itself, so we can mutate the variable directly.
  if (rootWithPendingPassiveEffects !== null) {
    // Cache the root since rootWithPendingPassiveEffects is cleared in
    // flushPassiveEffectsImpl
    const root = rootWithPendingPassiveEffects;
    // Cache and clear the remaining lanes flag; it must be reset since this
    // method can be called from various places, not always from commitRoot
    // where the remaining lanes are known
    const remainingLanes = pendingPassiveEffectsRemainingLanes;
    pendingPassiveEffectsRemainingLanes = NoLanes;

    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority);
    const prevTransition = ReactCurrentBatchConfig.transition;
    const previousPriority = getCurrentUpdatePriority();

    try {
      ReactCurrentBatchConfig.transition = null;
      setCurrentUpdatePriority(priority);
      return flushPassiveEffectsImpl();
    } finally {
      setCurrentUpdatePriority(previousPriority);
      ReactCurrentBatchConfig.transition = prevTransition;

      // Once passive effects have run for the tree - giving components a
      // chance to retain cache instances they use - release the pooled
      // cache at the root (if there is one)
      releaseRootPooledCache(root, remainingLanes);
    }
  }
  return false;
}

export function enqueuePendingPassiveProfilerEffect(fiber: Fiber): void {
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    pendingPassiveProfilerEffects.push(fiber);
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null;
      });
    }
  }
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  // Cache and clear the transitions flag
  const transitions = pendingPassiveTransitions;
  pendingPassiveTransitions = null;

  const root = rootWithPendingPassiveEffects;
  const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  // TODO: This is sometimes out of sync with rootWithPendingPassiveEffects.
  // Figure out why and fix it. It's not causing any known issues (probably
  // because it's only used for profiling), but it's a refactor hazard.
  pendingPassiveEffectsLanes = NoLanes;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Cannot flush passive effects while already rendering.');
  }

  if (__DEV__) {
    isFlushingPassiveEffects = true;
    didScheduleUpdateDuringPassiveEffects = false;

    if (enableDebugTracing) {
      logPassiveEffectsStarted(lanes);
    }
  }

  if (enableSchedulingProfiler) {
    markPassiveEffectsStarted(lanes);
  }

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes, transitions);

  // TODO: Move to commitPassiveMountEffects
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const profilerEffects = pendingPassiveProfilerEffects;
    pendingPassiveProfilerEffects = [];
    for (let i = 0; i < profilerEffects.length; i++) {
      const fiber = ((profilerEffects[i]: any): Fiber);
      commitPassiveEffectDurations(root, fiber);
    }
  }

  if (__DEV__) {
    if (enableDebugTracing) {
      logPassiveEffectsStopped();
    }
  }

  if (enableSchedulingProfiler) {
    markPassiveEffectsStopped();
  }

  if (__DEV__ && enableStrictEffects) {
    commitDoubleInvokeEffectsInDEV(root.current, true);
  }

  executionContext = prevExecutionContext;

  flushSyncCallbacks();

  if (enableTransitionTracing) {
    const prevPendingTransitionCallbacks = currentPendingTransitionCallbacks;
    const prevRootTransitionCallbacks = root.transitionCallbacks;
    if (
      prevPendingTransitionCallbacks !== null &&
      prevRootTransitionCallbacks !== null
    ) {
      // TODO(luna) Refactor this code into the Host Config
      // TODO(luna) The end time here is not necessarily accurate
      // because passive effects could be called before paint
      // (synchronously) or after paint (normally). We need
      // to come up with a way to get the correct end time for both cases.
      // One solution is in the host config, if the passive effects
      // have not yet been run, make a call to flush the passive effects
      // right after paint.
      const endTime = now();
      currentPendingTransitionCallbacks = null;

      scheduleCallback(IdleSchedulerPriority, () =>
        processTransitionCallbacks(
          prevPendingTransitionCallbacks,
          endTime,
          prevRootTransitionCallbacks,
        ),
      );
    }
  }

  if (__DEV__) {
    // If additional passive effects were scheduled, increment a counter. If this
    // exceeds the limit, we'll fire a warning.
    if (didScheduleUpdateDuringPassiveEffects) {
      if (root === rootWithPassiveNestedUpdates) {
        nestedPassiveUpdateCount++;
      } else {
        nestedPassiveUpdateCount = 0;
        rootWithPassiveNestedUpdates = root;
      }
    } else {
      nestedPassiveUpdateCount = 0;
    }
    isFlushingPassiveEffects = false;
    didScheduleUpdateDuringPassiveEffects = false;
  }

  // TODO: Move to commitPassiveMountEffects
  onPostCommitRootDevTools(root);
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const stateNode = root.current.stateNode;
    stateNode.effectDuration = 0;
    stateNode.passiveEffectDuration = 0;
  }

  return true;
}

export function isAlreadyFailedLegacyErrorBoundary(instance: mixed): boolean {
  return (
    legacyErrorBoundariesThatAlreadyFailed !== null &&
    legacyErrorBoundariesThatAlreadyFailed.has(instance)
  );
}

export function markLegacyErrorBoundaryAsFailed(instance: mixed) {
  if (legacyErrorBoundariesThatAlreadyFailed === null) {
    legacyErrorBoundariesThatAlreadyFailed = new Set([instance]);
  } else {
    legacyErrorBoundariesThatAlreadyFailed.add(instance);
  }
}

function prepareToThrowUncaughtError(error: mixed) {
  if (!hasUncaughtError) {
    hasUncaughtError = true;
    firstUncaughtError = error;
  }
}
export const onUncaughtError = prepareToThrowUncaughtError;

function captureCommitPhaseErrorOnRoot(
  rootFiber: Fiber,
  sourceFiber: Fiber,
  error: mixed,
) {
  const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
  const update = createRootErrorUpdate(rootFiber, errorInfo, (SyncLane: Lane));
  const root = enqueueUpdate(rootFiber, update, (SyncLane: Lane));
  const eventTime = requestEventTime();
  if (root !== null) {
    markRootUpdated(root, SyncLane, eventTime);
    ensureRootIsScheduled(root, eventTime);
  }
}

export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: mixed,
) {
  if (__DEV__) {
    reportUncaughtErrorInDEV(error);
    setIsRunningInsertionEffect(false);
  }
  if (sourceFiber.tag === HostRoot) {
    // Error was thrown at the root. There is no parent, so the root
    // itself should capture it.
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    return;
  }

  let fiber = null;
  if (skipUnmountedBoundaries) {
    fiber = nearestMountedAncestor;
  } else {
    fiber = sourceFiber.return;
  }

  while (fiber !== null) {
    if (fiber.tag === HostRoot) {
      captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error);
      return;
    } else if (fiber.tag === ClassComponent) {
      const ctor = fiber.type;
      const instance = fiber.stateNode;
      if (
        typeof ctor.getDerivedStateFromError === 'function' ||
        (typeof instance.componentDidCatch === 'function' &&
          !isAlreadyFailedLegacyErrorBoundary(instance))
      ) {
        const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
        const update = createClassErrorUpdate(
          fiber,
          errorInfo,
          (SyncLane: Lane),
        );
        const root = enqueueUpdate(fiber, update, (SyncLane: Lane));
        const eventTime = requestEventTime();
        if (root !== null) {
          markRootUpdated(root, SyncLane, eventTime);
          ensureRootIsScheduled(root, eventTime);
        }
        return;
      }
    }
    fiber = fiber.return;
  }

  if (__DEV__) {
    // TODO: Until we re-land skipUnmountedBoundaries (see #20147), this warning
    // will fire for errors that are thrown by destroy functions inside deleted
    // trees. What it should instead do is propagate the error to the parent of
    // the deleted tree. In the meantime, do not add this warning to the
    // allowlist; this is only for our internal use.
    console.error(
      'Internal React error: Attempted to capture a commit phase error ' +
        'inside a detached tree. This indicates a bug in React. Likely ' +
        'causes include deleting the same fiber more than once, committing an ' +
        'already-finished tree, or an inconsistent return pointer.\n\n' +
        'Error message:\n\n%s',
      error,
    );
  }
}

export function pingSuspendedRoot(
  root: FiberRoot,
  wakeable: Wakeable,
  pingedLanes: Lanes,
) {
  const pingCache = root.pingCache;
  if (pingCache !== null) {
    // The wakeable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    pingCache.delete(wakeable);
  }

  const eventTime = requestEventTime();
  markRootPinged(root, pingedLanes, eventTime);

  warnIfSuspenseResolutionNotWrappedWithActDEV(root);

  if (
    workInProgressRoot === root &&
    isSubsetOfLanes(workInProgressRootRenderLanes, pingedLanes)
  ) {
    // Received a ping at the same priority level at which we're currently
    // rendering. We might want to restart this render. This should mirror
    // the logic of whether or not a root suspends once it completes.

    // TODO: If we're rendering sync either due to Sync, Batched or expired,
    // we should probably never restart.

    // If we're suspended with delay, or if it's a retry, we'll always suspend
    // so we can always restart.
    if (
      workInProgressRootExitStatus === RootSuspendedWithDelay ||
      (workInProgressRootExitStatus === RootSuspended &&
        includesOnlyRetries(workInProgressRootRenderLanes) &&
        now() - globalMostRecentFallbackTime < FALLBACK_THROTTLE_MS)
    ) {
      // Restart from the root.
      prepareFreshStack(root, NoLanes);
    } else {
      // Even though we can't restart right now, we might get an
      // opportunity later. So we mark this render as having a ping.
      workInProgressRootPingedLanes = mergeLanes(
        workInProgressRootPingedLanes,
        pingedLanes,
      );
    }
  }

  ensureRootIsScheduled(root, eventTime);
}

function retryTimedOutBoundary(boundaryFiber: Fiber, retryLane: Lane) {
  // The boundary fiber (a Suspense component or SuspenseList component)
  // previously was rendered in its fallback state. One of the promises that
  // suspended it has resolved, which means at least part of the tree was
  // likely unblocked. Try rendering again, at a new lanes.
  if (retryLane === NoLane) {
    // TODO: Assign this to `suspenseState.retryLane`? to avoid
    // unnecessary entanglement?
    retryLane = requestRetryLane(boundaryFiber);
  }
  // TODO: Special case idle priority?
  const eventTime = requestEventTime();
  const root = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
  if (root !== null) {
    markRootUpdated(root, retryLane, eventTime);
    ensureRootIsScheduled(root, eventTime);
  }
}

export function retryDehydratedSuspenseBoundary(boundaryFiber: Fiber) {
  const suspenseState: null | SuspenseState = boundaryFiber.memoizedState;
  let retryLane = NoLane;
  if (suspenseState !== null) {
    retryLane = suspenseState.retryLane;
  }
  retryTimedOutBoundary(boundaryFiber, retryLane);
}

export function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable) {
  let retryLane = NoLane; // Default
  let retryCache: WeakSet<Wakeable> | Set<Wakeable> | null;
  switch (boundaryFiber.tag) {
    case SuspenseComponent:
      retryCache = boundaryFiber.stateNode;
      const suspenseState: null | SuspenseState = boundaryFiber.memoizedState;
      if (suspenseState !== null) {
        retryLane = suspenseState.retryLane;
      }
      break;
    case SuspenseListComponent:
      retryCache = boundaryFiber.stateNode;
      break;
    case OffscreenComponent: {
      const instance: OffscreenInstance = boundaryFiber.stateNode;
      retryCache = instance.retryCache;
      break;
    }
    default:
      throw new Error(
        'Pinged unknown suspense boundary type. ' +
          'This is probably a bug in React.',
      );
  }

  if (retryCache !== null) {
    // The wakeable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    retryCache.delete(wakeable);
  }

  retryTimedOutBoundary(boundaryFiber, retryLane);
}

// Computes the next Just Noticeable Difference (JND) boundary.
// The theory is that a person can't tell the difference between small differences in time.
// Therefore, if we wait a bit longer than necessary that won't translate to a noticeable
// difference in the experience. However, waiting for longer might mean that we can avoid
// showing an intermediate loading state. The longer we have already waited, the harder it
// is to tell small differences in time. Therefore, the longer we've already waited,
// the longer we can wait additionally. At some point we have to give up though.
// We pick a train model where the next boundary commits at a consistent schedule.
// These particular numbers are vague estimates. We expect to adjust them based on research.
function jnd(timeElapsed: number) {
  return timeElapsed < 120
    ? 120
    : timeElapsed < 480
    ? 480
    : timeElapsed < 1080
    ? 1080
    : timeElapsed < 1920
    ? 1920
    : timeElapsed < 3000
    ? 3000
    : timeElapsed < 4320
    ? 4320
    : ceil(timeElapsed / 1960) * 1960;
}

export function throwIfInfiniteUpdateLoopDetected() {
  if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
    nestedUpdateCount = 0;
    nestedPassiveUpdateCount = 0;
    rootWithNestedUpdates = null;
    rootWithPassiveNestedUpdates = null;

    throw new Error(
      'Maximum update depth exceeded. This can happen when a component ' +
        'repeatedly calls setState inside componentWillUpdate or ' +
        'componentDidUpdate. React limits the number of nested updates to ' +
        'prevent infinite loops.',
    );
  }

  if (__DEV__) {
    if (nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT) {
      nestedPassiveUpdateCount = 0;
      rootWithPassiveNestedUpdates = null;

      console.error(
        'Maximum update depth exceeded. This can happen when a component ' +
          "calls setState inside useEffect, but useEffect either doesn't " +
          'have a dependency array, or one of the dependencies changes on ' +
          'every render.',
      );
    }
  }
}

function flushRenderPhaseStrictModeWarningsInDEV() {
  if (__DEV__) {
    ReactStrictModeWarnings.flushLegacyContextWarning();

    if (warnAboutDeprecatedLifecycles) {
      ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
    }
  }
}

function commitDoubleInvokeEffectsInDEV(
  fiber: Fiber,
  hasPassiveEffects: boolean,
) {
  if (__DEV__ && enableStrictEffects) {
    // TODO (StrictEffects) Should we set a marker on the root if it contains strict effects
    // so we don't traverse unnecessarily? similar to subtreeFlags but just at the root level.
    // Maybe not a big deal since this is DEV only behavior.

    setCurrentDebugFiberInDEV(fiber);
    invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectUnmountInDEV);
    if (hasPassiveEffects) {
      invokeEffectsInDev(
        fiber,
        MountPassiveDev,
        invokePassiveEffectUnmountInDEV,
      );
    }

    invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectMountInDEV);
    if (hasPassiveEffects) {
      invokeEffectsInDev(fiber, MountPassiveDev, invokePassiveEffectMountInDEV);
    }
    resetCurrentDebugFiberInDEV();
  }
}

function invokeEffectsInDev(
  firstChild: Fiber,
  fiberFlags: Flags,
  invokeEffectFn: (fiber: Fiber) => void,
): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.

    let current = firstChild;
    let subtreeRoot = null;
    while (current !== null) {
      const primarySubtreeFlag = current.subtreeFlags & fiberFlags;
      if (
        current !== subtreeRoot &&
        current.child !== null &&
        primarySubtreeFlag !== NoFlags
      ) {
        current = current.child;
      } else {
        if ((current.flags & fiberFlags) !== NoFlags) {
          invokeEffectFn(current);
        }

        if (current.sibling !== null) {
          current = current.sibling;
        } else {
          current = subtreeRoot = current.return;
        }
      }
    }
  }
}

let didWarnStateUpdateForNotYetMountedComponent: Set<string> | null = null;
export function warnAboutUpdateOnNotYetMountedFiberInDEV(fiber: Fiber) {
  if (__DEV__) {
    if ((executionContext & RenderContext) !== NoContext) {
      // We let the other warning about render phase updates deal with this one.
      return;
    }

    if (!(fiber.mode & ConcurrentMode)) {
      return;
    }

    const tag = fiber.tag;
    if (
      tag !== IndeterminateComponent &&
      tag !== HostRoot &&
      tag !== ClassComponent &&
      tag !== FunctionComponent &&
      tag !== ForwardRef &&
      tag !== MemoComponent &&
      tag !== SimpleMemoComponent
    ) {
      // Only warn for user-defined components, not internal ones like Suspense.
      return;
    }

    // We show the whole stack but dedupe on the top component's name because
    // the problematic code almost always lies inside that component.
    const componentName = getComponentNameFromFiber(fiber) || 'ReactComponent';
    if (didWarnStateUpdateForNotYetMountedComponent !== null) {
      if (didWarnStateUpdateForNotYetMountedComponent.has(componentName)) {
        return;
      }
      didWarnStateUpdateForNotYetMountedComponent.add(componentName);
    } else {
      didWarnStateUpdateForNotYetMountedComponent = new Set([componentName]);
    }

    const previousFiber = ReactCurrentFiberCurrent;
    try {
      setCurrentDebugFiberInDEV(fiber);
      console.error(
        "Can't perform a React state update on a component that hasn't mounted yet. " +
          'This indicates that you have a side-effect in your render function that ' +
          'asynchronously later calls tries to update the component. Move this work to ' +
          'useEffect instead.',
      );
    } finally {
      if (previousFiber) {
        setCurrentDebugFiberInDEV(fiber);
      } else {
        resetCurrentDebugFiberInDEV();
      }
    }
  }
}

let beginWork;
if (__DEV__ && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
  const dummyFiber = null;
  beginWork = (current, unitOfWork, lanes) => {
    // If a component throws an error, we replay it again in a synchronously
    // dispatched event, so that the debugger will treat it as an uncaught
    // error See ReactErrorUtils for more information.

    // Before entering the begin phase, copy the work-in-progress onto a dummy
    // fiber. If beginWork throws, we'll use this to reset the state.
    const originalWorkInProgressCopy = assignFiberPropertiesInDEV(
      dummyFiber,
      unitOfWork,
    );
    try {
      return originalBeginWork(current, unitOfWork, lanes);
    } catch (originalError) {
      if (
        didSuspendOrErrorWhileHydratingDEV() ||
        (originalError !== null &&
          typeof originalError === 'object' &&
          typeof originalError.then === 'function')
      ) {
        // Don't replay promises.
        // Don't replay errors if we are hydrating and have already suspended or handled an error
        throw originalError;
      }

      // Keep this code in sync with handleError; any changes here must have
      // corresponding changes there.
      resetContextDependencies();
      resetHooksAfterThrow();
      // Don't reset current debug fiber, since we're about to work on the
      // same fiber again.

      // Unwind the failed stack frame
      unwindInterruptedWork(current, unitOfWork, workInProgressRootRenderLanes);

      // Restore the original properties of the fiber.
      assignFiberPropertiesInDEV(unitOfWork, originalWorkInProgressCopy);

      if (enableProfilerTimer && unitOfWork.mode & ProfileMode) {
        // Reset the profiler timer.
        startProfilerTimer(unitOfWork);
      }

      // Run beginWork again.
      invokeGuardedCallback(
        null,
        originalBeginWork,
        null,
        current,
        unitOfWork,
        lanes,
      );

      if (hasCaughtError()) {
        const replayError = clearCaughtError();
        if (
          typeof replayError === 'object' &&
          replayError !== null &&
          replayError._suppressLogging &&
          typeof originalError === 'object' &&
          originalError !== null &&
          !originalError._suppressLogging
        ) {
          // If suppressed, let the flag carry over to the original error which is the one we'll rethrow.
          originalError._suppressLogging = true;
        }
      }
      // We always throw the original error in case the second render pass is not idempotent.
      // This can happen if a memoized function or CommonJS module doesn't throw after first invocation.
      throw originalError;
    }
  };
} else {
  beginWork = originalBeginWork;
}

let didWarnAboutUpdateInRender = false;
let didWarnAboutUpdateInRenderForAnotherComponent;
if (__DEV__) {
  didWarnAboutUpdateInRenderForAnotherComponent = new Set();
}

function warnAboutRenderPhaseUpdatesInDEV(fiber) {
  if (__DEV__) {
    if (
      ReactCurrentDebugFiberIsRenderingInDEV &&
      !getIsUpdatingOpaqueValueInRenderPhaseInDEV()
    ) {
      switch (fiber.tag) {
        case FunctionComponent:
        case ForwardRef:
        case SimpleMemoComponent: {
          const renderingComponentName =
            (workInProgress && getComponentNameFromFiber(workInProgress)) ||
            'Unknown';
          // Dedupe by the rendering component because it's the one that needs to be fixed.
          const dedupeKey = renderingComponentName;
          if (!didWarnAboutUpdateInRenderForAnotherComponent.has(dedupeKey)) {
            didWarnAboutUpdateInRenderForAnotherComponent.add(dedupeKey);
            const setStateComponentName =
              getComponentNameFromFiber(fiber) || 'Unknown';
            console.error(
              'Cannot update a component (`%s`) while rendering a ' +
                'different component (`%s`). To locate the bad setState() call inside `%s`, ' +
                'follow the stack trace as described in https://reactjs.org/link/setstate-in-render',
              setStateComponentName,
              renderingComponentName,
              renderingComponentName,
            );
          }
          break;
        }
        case ClassComponent: {
          if (!didWarnAboutUpdateInRender) {
            console.error(
              'Cannot update during an existing state transition (such as ' +
                'within `render`). Render methods should be a pure ' +
                'function of props and state.',
            );
            didWarnAboutUpdateInRender = true;
          }
          break;
        }
      }
    }
  }
}

export function restorePendingUpdaters(root: FiberRoot, lanes: Lanes): void {
  if (enableUpdaterTracking) {
    if (isDevToolsPresent) {
      const memoizedUpdaters = root.memoizedUpdaters;
      memoizedUpdaters.forEach(schedulingFiber => {
        addFiberToLanesMap(root, schedulingFiber, lanes);
      });

      // This function intentionally does not clear memoized updaters.
      // Those may still be relevant to the current commit
      // and a future one (e.g. Suspense).
    }
  }
}

const fakeActCallbackNode = {};
function scheduleCallback(priorityLevel, callback) {
  if (__DEV__) {
    // If we're currently inside an `act` scope, bypass Scheduler and push to
    // the `act` queue instead.
    const actQueue = ReactCurrentActQueue.current;
    if (actQueue !== null) {
      actQueue.push(callback);
      return fakeActCallbackNode;
    } else {
      return Scheduler_scheduleCallback(priorityLevel, callback);
    }
  } else {
    // In production, always call Scheduler. This function will be stripped out.
    return Scheduler_scheduleCallback(priorityLevel, callback);
  }
}

function cancelCallback(callbackNode) {
  if (__DEV__ && callbackNode === fakeActCallbackNode) {
    return;
  }
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_cancelCallback(callbackNode);
}

function shouldForceFlushFallbacksInDEV() {
  // Never force flush in production. This function should get stripped out.
  return __DEV__ && ReactCurrentActQueue.current !== null;
}

function warnIfUpdatesNotWrappedWithActDEV(fiber: Fiber): void {
  if (__DEV__) {
    if (fiber.mode & ConcurrentMode) {
      if (!isConcurrentActEnvironment()) {
        // Not in an act environment. No need to warn.
        return;
      }
    } else {
      // Legacy mode has additional cases where we suppress a warning.
      if (!isLegacyActEnvironment(fiber)) {
        // Not in an act environment. No need to warn.
        return;
      }
      if (executionContext !== NoContext) {
        // Legacy mode doesn't warn if the update is batched, i.e.
        // batchedUpdates or flushSync.
        return;
      }
      if (
        fiber.tag !== FunctionComponent &&
        fiber.tag !== ForwardRef &&
        fiber.tag !== SimpleMemoComponent
      ) {
        // For backwards compatibility with pre-hooks code, legacy mode only
        // warns for updates that originate from a hook.
        return;
      }
    }

    if (ReactCurrentActQueue.current === null) {
      const previousFiber = ReactCurrentFiberCurrent;
      try {
        setCurrentDebugFiberInDEV(fiber);
        console.error(
          'An update to %s inside a test was not wrapped in act(...).\n\n' +
            'When testing, code that causes React state updates should be ' +
            'wrapped into act(...):\n\n' +
            'act(() => {\n' +
            '  /* fire events that update state */\n' +
            '});\n' +
            '/* assert on the output */\n\n' +
            "This ensures that you're testing the behavior the user would see " +
            'in the browser.' +
            ' Learn more at https://reactjs.org/link/wrap-tests-with-act',
          getComponentNameFromFiber(fiber),
        );
      } finally {
        if (previousFiber) {
          setCurrentDebugFiberInDEV(fiber);
        } else {
          resetCurrentDebugFiberInDEV();
        }
      }
    }
  }
}

function warnIfSuspenseResolutionNotWrappedWithActDEV(root: FiberRoot): void {
  if (__DEV__) {
    if (
      root.tag !== LegacyRoot &&
      isConcurrentActEnvironment() &&
      ReactCurrentActQueue.current === null
    ) {
      console.error(
        'A suspended resource finished loading inside a test, but the event ' +
          'was not wrapped in act(...).\n\n' +
          'When testing, code that resolves suspended data should be wrapped ' +
          'into act(...):\n\n' +
          'act(() => {\n' +
          '  /* finish loading suspended data */\n' +
          '});\n' +
          '/* assert on the output */\n\n' +
          "This ensures that you're testing the behavior the user would see " +
          'in the browser.' +
          ' Learn more at https://reactjs.org/link/wrap-tests-with-act',
      );
    }
  }
}

export function setIsRunningInsertionEffect(isRunning: boolean): void {
  if (__DEV__) {
    isRunningInsertionEffect = isRunning;
  }
}
