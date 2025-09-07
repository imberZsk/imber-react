/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  Fiber,
  SuspenseHydrationCallbacks,
  TransitionTracingCallbacks,
} from './ReactInternalTypes';
import type {FiberRoot} from './ReactInternalTypes';
import type {RootTag} from './ReactRootTags';
import type {
  Instance,
  TextInstance,
  Container,
  PublicInstance,
} from './ReactFiberHostConfig';
import type {RendererInspectionConfig} from './ReactFiberHostConfig';
import type {ReactNodeList} from 'shared/ReactTypes';
import type {Lane} from './ReactFiberLane.new';
import type {SuspenseState} from './ReactFiberSuspenseComponent.new';

import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals,
} from './ReactFiberTreeReflection';
import {get as getInstance} from 'shared/ReactInstanceMap';
import {
  HostComponent,
  ClassComponent,
  HostRoot,
  SuspenseComponent,
} from './ReactWorkTags';
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';
import isArray from 'shared/isArray';
import {enableSchedulingProfiler} from 'shared/ReactFeatureFlags';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import {getPublicInstance} from './ReactFiberHostConfig';
import {
  findCurrentUnmaskedContext,
  processChildContext,
  emptyContextObject,
  isContextProvider as isLegacyContextProvider,
} from './ReactFiberContext.new';
import {createFiberRoot} from './ReactFiberRoot.new';
import {isRootDehydrated} from './ReactFiberShellHydration';
import {
  injectInternals,
  markRenderScheduled,
  onScheduleRoot,
} from './ReactFiberDevToolsHook.new';
import {
  requestEventTime,
  requestUpdateLane,
  scheduleUpdateOnFiber,
  scheduleInitialHydrationOnRoot,
  flushRoot,
  batchedUpdates,
  flushSync,
  isAlreadyRendering,
  flushControlled,
  deferredUpdates,
  discreteUpdates,
  flushPassiveEffects,
} from './ReactFiberWorkLoop.new';
import {enqueueConcurrentRenderForLane} from './ReactFiberConcurrentUpdates.new';
import {
  createUpdate,
  enqueueUpdate,
  entangleTransitions,
} from './ReactFiberClassUpdateQueue.new';
import {
  isRendering as ReactCurrentFiberIsRendering,
  current as ReactCurrentFiberCurrent,
  resetCurrentFiber as resetCurrentDebugFiberInDEV,
  setCurrentFiber as setCurrentDebugFiberInDEV,
} from './ReactCurrentFiber';
import {StrictLegacyMode} from './ReactTypeOfMode';
import {
  SyncLane,
  SelectiveHydrationLane,
  NoTimestamp,
  getHighestPriorityPendingLanes,
  higherPriorityLane,
} from './ReactFiberLane.new';
import {
  getCurrentUpdatePriority,
  runWithPriority,
} from './ReactEventPriorities.new';
import {
  scheduleRefresh,
  scheduleRoot,
  setRefreshHandler,
  findHostInstancesForRefresh,
} from './ReactFiberHotReloading.new';
import ReactVersion from 'shared/ReactVersion';
export {registerMutableSourceForHydration} from './ReactMutableSource.new';
export {createPortal} from './ReactPortal';
export {
  createComponentSelector,
  createHasPseudoClassSelector,
  createRoleSelector,
  createTestNameSelector,
  createTextSelector,
  getFindAllNodesFailureDescription,
  findAllNodes,
  findBoundingRects,
  focusWithin,
  observeVisibleRects,
} from './ReactTestSelectors';

type OpaqueRoot = FiberRoot;

// 0 是生产环境，1 是开发环境。
// 稍后可能会添加 PROFILE。
type BundleType = 0 | 1;

type DevToolsConfig = {|
  bundleType: BundleType,
  version: string,
  rendererPackageName: string,
  // 注意：这实际上*确实*依赖于 Fiber 内部字段。
  // 被 React DevTools 中的"检查点击的 DOM 元素"功能使用。
  findFiberByHostInstance?: (instance: Instance | TextInstance) => Fiber | null,
  rendererConfig?: RendererInspectionConfig,
|};

let didWarnAboutFindNodeInStrictMode;

function getContextForSubtree(
  parentComponent: ?React$Component<any, any>,
): Object {
  if (!parentComponent) {
    return emptyContextObject;
  }

  const fiber = getInstance(parentComponent);
  const parentContext = findCurrentUnmaskedContext(fiber);

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type;
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext);
    }
  }

  return parentContext;
}

function findHostInstance(component: Object): PublicInstance | null {
  const fiber = getInstance(component);
  if (fiber === undefined) {
    if (typeof component.render === 'function') {
      throw new Error('Unable to find node on an unmounted component.');
    } else {
      const keys = Object.keys(component).join(',');
      throw new Error(
        `Argument appears to not be a ReactComponent. Keys: ${keys}`,
      );
    }
  }
  const hostFiber = findCurrentHostFiber(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

function findHostInstanceWithWarning(
  component: Object,
  methodName: string,
): PublicInstance | null {
  if (__DEV__) {
    const fiber = getInstance(component);
    if (fiber === undefined) {
      if (typeof component.render === 'function') {
        throw new Error('Unable to find node on an unmounted component.');
      } else {
        const keys = Object.keys(component).join(',');
        throw new Error(
          `Argument appears to not be a ReactComponent. Keys: ${keys}`,
        );
      }
    }
    const hostFiber = findCurrentHostFiber(fiber);
    if (hostFiber === null) {
      return null;
    }
    if (hostFiber.mode & StrictLegacyMode) {
      const componentName = getComponentNameFromFiber(fiber) || 'Component';
      if (!didWarnAboutFindNodeInStrictMode[componentName]) {
        didWarnAboutFindNodeInStrictMode[componentName] = true;

        const previousFiber = ReactCurrentFiberCurrent;
        try {
          setCurrentDebugFiberInDEV(hostFiber);
          if (fiber.mode & StrictLegacyMode) {
            console.error(
              '%s is deprecated in StrictMode. ' +
                '%s was passed an instance of %s which is inside StrictMode. ' +
                'Instead, add a ref directly to the element you want to reference. ' +
                'Learn more about using refs safely here: ' +
                'https://reactjs.org/link/strict-mode-find-node',
              methodName,
              methodName,
              componentName,
            );
          } else {
            console.error(
              '%s is deprecated in StrictMode. ' +
                '%s was passed an instance of %s which renders StrictMode children. ' +
                'Instead, add a ref directly to the element you want to reference. ' +
                'Learn more about using refs safely here: ' +
                'https://reactjs.org/link/strict-mode-find-node',
              methodName,
              methodName,
              componentName,
            );
          }
        } finally {
          // 理想情况下这应该重置为之前的值，但这不应该在
          // 渲染中调用，而且无论如何都有另一个警告。
          if (previousFiber) {
            setCurrentDebugFiberInDEV(previousFiber);
          } else {
            resetCurrentDebugFiberInDEV();
          }
        }
      }
    }
    return hostFiber.stateNode;
  }
  return findHostInstance(component);
}

export function createContainer(
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onRecoverableError: (error: mixed) => void,
  transitionCallbacks: null | TransitionTracingCallbacks,
): OpaqueRoot {
  const hydrate = false;
  const initialChildren = null;
  return createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
    identifierPrefix,
    onRecoverableError,
    transitionCallbacks,
  );
}

export function createHydrationContainer(
  initialChildren: ReactNodeList,
  // TODO: 删除遗留模式时移除 `callback`。
  callback: ?Function,
  containerInfo: Container,
  tag: RootTag,
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
  isStrictMode: boolean,
  concurrentUpdatesByDefaultOverride: null | boolean,
  identifierPrefix: string,
  onRecoverableError: (error: mixed) => void,
  transitionCallbacks: null | TransitionTracingCallbacks,
): OpaqueRoot {
  const hydrate = true;
  const root = createFiberRoot(
    containerInfo,
    tag,
    hydrate,
    initialChildren,
    hydrationCallbacks,
    isStrictMode,
    concurrentUpdatesByDefaultOverride,
    identifierPrefix,
    onRecoverableError,
    transitionCallbacks,
  );

  // TODO: 将此移动到 FiberRoot 构造函数
  root.context = getContextForSubtree(null);

  // 调度初始渲染。在 hydration 根中，这与
  // 常规更新不同，因为初始渲染必须匹配
  // 服务器上渲染的内容。
  // 注意：此更新故意没有有效载荷。我们只是使用
  // 更新来调度根 fiber 上的工作（对于遗留根，如果
  // 提供了回调，则将其加入队列）。
  const current = root.current;
  const eventTime = requestEventTime();
  const lane = requestUpdateLane(current);
  const update = createUpdate(eventTime, lane);
  update.callback =
    callback !== undefined && callback !== null ? callback : null;
  enqueueUpdate(current, update, lane);
  scheduleInitialHydrationOnRoot(root, lane, eventTime);

  return root;
}

export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function,
): Lane {
  const current = container.current;
  const eventTime = requestEventTime();
  const lane = requestUpdateLane(current);

  if (enableSchedulingProfiler) {
    markRenderScheduled(lane);
  }

  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }

  const update = createUpdate(eventTime, lane);
  // 注意：React DevTools 目前依赖于这个属性
  // 被称为 "element"。
  update.payload = {element};

  callback = callback === undefined ? null : callback;
  if (callback !== null) {
    update.callback = callback;
  }

  const root = enqueueUpdate(current, update, lane);
  if (root !== null) {
    scheduleUpdateOnFiber(root, current, lane, eventTime);
    entangleTransitions(root, current, lane);
  }

  return lane;
}

export {
  batchedUpdates,
  deferredUpdates,
  discreteUpdates,
  flushControlled,
  flushSync,
  isAlreadyRendering,
  flushPassiveEffects,
};

export function getPublicRootInstance(
  container: OpaqueRoot,
): React$Component<any, any> | PublicInstance | null {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  switch (containerFiber.child.tag) {
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode);
    default:
      return containerFiber.child.stateNode;
  }
}

export function attemptSynchronousHydration(fiber: Fiber): void {
  switch (fiber.tag) {
    case HostRoot: {
      const root: FiberRoot = fiber.stateNode;
      if (isRootDehydrated(root)) {
        // 刷新第一个调度的"更新"。
        const lanes = getHighestPriorityPendingLanes(root);
        flushRoot(root, lanes);
      }
      break;
    }
    case SuspenseComponent: {
      flushSync(() => {
        const root = enqueueConcurrentRenderForLane(fiber, SyncLane);
        if (root !== null) {
          const eventTime = requestEventTime();
          scheduleUpdateOnFiber(root, fiber, SyncLane, eventTime);
        }
      });
      // 如果在此之后我们仍然被阻塞，我们需要增加
      // 在此边界内解析的任何 promise 的优先级，
      // 以便它们下次尝试也具有更高的优先级。
      const retryLane = SyncLane;
      markRetryLaneIfNotHydrated(fiber, retryLane);
      break;
    }
  }
}

function markRetryLaneImpl(fiber: Fiber, retryLane: Lane) {
  const suspenseState: null | SuspenseState = fiber.memoizedState;
  if (suspenseState !== null && suspenseState.dehydrated !== null) {
    suspenseState.retryLane = higherPriorityLane(
      suspenseState.retryLane,
      retryLane,
    );
  }
}

// 当 thenables 在此边界内解析时增加它们的优先级。
function markRetryLaneIfNotHydrated(fiber: Fiber, retryLane: Lane) {
  markRetryLaneImpl(fiber, retryLane);
  const alternate = fiber.alternate;
  if (alternate) {
    markRetryLaneImpl(alternate, retryLane);
  }
}

export function attemptDiscreteHydration(fiber: Fiber): void {
  if (fiber.tag !== SuspenseComponent) {
    // 我们在这里忽略 HostRoots，因为我们无法增加
    // 它们的优先级，而且它们不应该在 I/O 上暂停，
    // 因为你必须将任何可能暂停的内容包装在
    // Suspense 中。
    return;
  }
  const lane = SyncLane;
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export function attemptContinuousHydration(fiber: Fiber): void {
  if (fiber.tag !== SuspenseComponent) {
    // 我们在这里忽略 HostRoots，因为我们无法增加
    // 它们的优先级，而且它们不应该在 I/O 上暂停，
    // 因为你必须将任何可能暂停的内容包装在
    // Suspense 中。
    return;
  }
  const lane = SelectiveHydrationLane;
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export function attemptHydrationAtCurrentPriority(fiber: Fiber): void {
  if (fiber.tag !== SuspenseComponent) {
    // 我们在这里忽略 HostRoots，因为我们无法增加
    // 它们的优先级，除了同步刷新它。
    return;
  }
  const lane = requestUpdateLane(fiber);
  const root = enqueueConcurrentRenderForLane(fiber, lane);
  if (root !== null) {
    const eventTime = requestEventTime();
    scheduleUpdateOnFiber(root, fiber, lane, eventTime);
  }
  markRetryLaneIfNotHydrated(fiber, lane);
}

export {getCurrentUpdatePriority, runWithPriority};

export {findHostInstance};

export {findHostInstanceWithWarning};

export function findHostInstanceWithNoPortals(
  fiber: Fiber,
): PublicInstance | null {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

const shouldErrorImpl = fiber => null;

export function shouldError(fiber: Fiber): ?boolean {
  return shouldErrorImpl(fiber);
}

const shouldSuspendImpl = fiber => false;

export function shouldSuspend(fiber: Fiber): boolean {
  return shouldSuspendImpl(fiber);
}

const overrideHookState = null;
const overrideHookStateDeletePath = null;
const overrideHookStateRenamePath = null;
const overrideProps = null;
const overridePropsDeletePath = null;
const overridePropsRenamePath = null;
const scheduleUpdate = null;
const setErrorHandler = null;
const setSuspenseHandler = null;

function findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | null {
  const hostFiber = findCurrentHostFiber(fiber);
  if (hostFiber === null) {
    return null;
  }
  return hostFiber.stateNode;
}

function emptyFindFiberByHostInstance(
  instance: Instance | TextInstance,
): Fiber | null {
  return null;
}

function getCurrentFiberForDevTools() {
  return ReactCurrentFiberCurrent;
}

export function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
  const {findFiberByHostInstance} = devToolsConfig;
  const {ReactCurrentDispatcher} = ReactSharedInternals;

  return injectInternals({
    bundleType: devToolsConfig.bundleType,
    version: devToolsConfig.version,
    rendererPackageName: devToolsConfig.rendererPackageName,
    rendererConfig: devToolsConfig.rendererConfig,
    overrideHookState,
    overrideHookStateDeletePath,
    overrideHookStateRenamePath,
    overrideProps,
    overridePropsDeletePath,
    overridePropsRenamePath,
    setErrorHandler,
    setSuspenseHandler,
    scheduleUpdate,
    currentDispatcherRef: ReactCurrentDispatcher,
    findHostInstanceByFiber,
    findFiberByHostInstance:
      findFiberByHostInstance || emptyFindFiberByHostInstance,
    // React 刷新
    findHostInstancesForRefresh: __DEV__ ? findHostInstancesForRefresh : null,
    scheduleRefresh: __DEV__ ? scheduleRefresh : null,
    scheduleRoot: __DEV__ ? scheduleRoot : null,
    setRefreshHandler: __DEV__ ? setRefreshHandler : null,
    // 使 DevTools 能够在开发模式下将所有者堆栈附加到错误消息。
    getCurrentFiber: __DEV__ ? getCurrentFiberForDevTools : null,
    // 使 DevTools 能够检测协调器版本而不是渲染器版本，
    // 这对于第三方渲染器可能不匹配。
    reconcilerVersion: ReactVersion,
  });
}
