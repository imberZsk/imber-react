/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DOMEventName} from './DOMEventNames';
import {
  type EventSystemFlags,
  SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE,
  IS_LEGACY_FB_SUPPORT_MODE,
  SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS,
} from './EventSystemFlags';
import type {AnyNativeEvent} from './PluginModuleType';
import type {
  KnownReactSyntheticEvent,
  ReactSyntheticEvent,
} from './ReactSyntheticEventType';
import type {Fiber} from 'react-reconciler/src/ReactInternalTypes';

import {allNativeEvents} from './EventRegistry';
import {
  IS_CAPTURE_PHASE,
  IS_EVENT_HANDLE_NON_MANAGED_NODE,
  IS_NON_DELEGATED,
} from './EventSystemFlags';
import {isReplayingEvent} from './CurrentReplayingEvent';

import {
  HostRoot,
  HostPortal,
  HostComponent,
  HostText,
  ScopeComponent,
} from 'react-reconciler/src/ReactWorkTags';

import getEventTarget from './getEventTarget';
import {
  getClosestInstanceFromNode,
  getEventListenerSet,
  getEventHandlerListeners,
} from '../client/ReactDOMComponentTree';
import {COMMENT_NODE} from '../shared/HTMLNodeType';
import {batchedUpdates} from './ReactDOMUpdateBatching';
import getListener from './getListener';
import {passiveBrowserEventsSupported} from './checkPassiveEvents';

import {
  enableLegacyFBSupport,
  enableCreateEventHandleAPI,
  enableScopeAPI,
} from 'shared/ReactFeatureFlags';
import {
  invokeGuardedCallbackAndCatchFirstError,
  rethrowCaughtError,
} from 'shared/ReactErrorUtils';
import {DOCUMENT_NODE} from '../shared/HTMLNodeType';
import {createEventListenerWrapperWithPriority} from './ReactDOMEventListener';
import {
  removeEventListener,
  addEventCaptureListener,
  addEventBubbleListener,
  addEventBubbleListenerWithPassiveFlag,
  addEventCaptureListenerWithPassiveFlag,
} from './EventListener';
import * as BeforeInputEventPlugin from './plugins/BeforeInputEventPlugin';
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin';
import * as EnterLeaveEventPlugin from './plugins/EnterLeaveEventPlugin';
import * as SelectEventPlugin from './plugins/SelectEventPlugin';
import * as SimpleEventPlugin from './plugins/SimpleEventPlugin';

type DispatchListener = {|
  instance: null | Fiber,
  listener: Function,
  currentTarget: EventTarget,
|};

type DispatchEntry = {|
  event: ReactSyntheticEvent,
  listeners: Array<DispatchListener>,
|};

export type DispatchQueue = Array<DispatchEntry>;

// TODO: remove top-level side effect.
SimpleEventPlugin.registerEvents();
EnterLeaveEventPlugin.registerEvents();
ChangeEventPlugin.registerEvents();
SelectEventPlugin.registerEvents();
BeforeInputEventPlugin.registerEvents();

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
) {
  // 1. 提取简单事件（基础事件插件）
  // 处理基本的DOM事件，如click、input、change等
  // 这是事件系统的核心功能，所有其他插件本质上都是polyfill
  // TODO: 应该移除"SimpleEventPlugin"的概念，将其逻辑内联到事件系统核心中
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );

  // 2. 检查是否应该处理polyfill插件
  // 根据事件系统标志决定是否需要处理额外的polyfill事件插件
  const shouldProcessPolyfillPlugins =
    (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0;

  // 3. 处理polyfill事件插件（仅在冒泡阶段处理）
  // 我们只在事件的原生"冒泡"阶段处理这些事件，这意味着我们不在捕获阶段处理
  // 这是因为我们仍然在这里模拟捕获阶段。这是一个权衡：
  // - 理想情况下，我们不应该模拟，而是像SimpleEvent插件那样正确使用阶段
  // - 但是下面的插件要么期望模拟（EnterLeave），要么使用该插件本地化的状态（BeforeInput、Change、Select）
  // - 这些模块中的状态使事情复杂化，因为捕获阶段事件可能会改变状态，
  //   然后后续的冒泡事件进来时，由于状态现在使事件插件的启发式无效，可能不会触发任何东西
  // - 我们可以改变所有这些插件以这种方式工作，但这可能会造成我们现在无法预见的其他未知副作用
  if (shouldProcessPolyfillPlugins) {
    // 3.1 处理鼠标进入/离开事件（onMouseEnter、onMouseLeave等）
    EnterLeaveEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );

    // 3.2 处理表单变化事件（onChange等）
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );

    // 3.3 处理选择事件（onSelect等）
    SelectEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );

    // 3.4 处理输入前事件（onBeforeInput等）
    BeforeInputEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
  }
}

//需要单独附加到媒体元素的事件列表。
export const mediaEventTypes: Array<DOMEventName> = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'resize',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  'timeupdate',
  'volumechange',
  'waiting',
];

//我们不应该把这些事件委托给容器，而应该
//在实际的目标元素本身上设置它们。这主要是
//因为这些事件不会始终在DOM中冒泡。
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  'cancel',
  'close',
  'invalid',
  'load',
  'scroll',
  'toggle',
  //为了减少字节，我们插入上述媒体事件数组
  //进入这个集合。注意：“error”事件不是一个独家媒体事件，
  //也可以发生在其他元素上。而不是重复那个事件，
  //我们从媒体事件数组中获取它。
  ...mediaEventTypes,
]);

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget,
): void {
  const type = event.type || 'unknown-event';
  event.currentTarget = currentTarget;
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
  event.currentTarget = null;
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean,
): void {
  let previousInstance;
  if (inCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const {instance, currentTarget, listener} = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const {instance, currentTarget, listener} = dispatchListeners[i];
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}

export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags,
): void {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const {event, listeners} = dispatchQueue[i];
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
    //  event system doesn't use pooling.
  }
  // This would be a good time to rethrow if any of the event handlers threw.
  rethrowCaughtError();
}

function dispatchEventsForPlugins(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  // 1. 获取原生事件的目标DOM节点
  const nativeEventTarget = getEventTarget(nativeEvent);

  // 2. 创建事件分发队列，用于存储待处理的事件
  const dispatchQueue: DispatchQueue = [];

  // 3. 提取事件：从原生事件中提取React合成事件，并收集所有需要触发的监听器
  // 这个过程会遍历fiber树，找到所有匹配的事件监听器（包括捕获和冒泡阶段）
  // extractEvents 不是提取事件本身，而是提取事件监听器并创建合成事件对象，然后填充到 dispatchQueue 队列中。
  extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
  );

  // 4. 处理分发队列：按正确的顺序执行所有收集到的事件监听器
  // 先执行捕获阶段的监听器，再执行冒泡阶段的监听器
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

export function listenToNonDelegatedEvent(
  domEventName: DOMEventName,
  targetElement: Element,
): void {
  if (__DEV__) {
    if (!nonDelegatedEvents.has(domEventName)) {
      console.error(
        'Did not expect a listenToNonDelegatedEvent() call for "%s". ' +
          'This is a bug in React. Please file an issue.',
        domEventName,
      );
    }
  }
  const isCapturePhaseListener = false;
  const listenerSet = getEventListenerSet(targetElement);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener,
  );
  if (!listenerSet.has(listenerSetKey)) {
    addTrappedEventListener(
      targetElement,
      domEventName,
      IS_NON_DELEGATED,
      isCapturePhaseListener,
    );
    listenerSet.add(listenerSetKey);
  }
}

export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget,
): void {
  let eventSystemFlags = 0;
  if (isCapturePhaseListener) {
    // const IS_CAPTURE_PHASE = 1 << 2;
    // 下面｜=等价于 eventSystemFlags = eventSystemFlags | IS_CAPTURE_PHASE;
    // 添加捕获阶段标志
    eventSystemFlags |= IS_CAPTURE_PHASE;
  }
  addTrappedEventListener(
    target, // root，绑定在了root上，selectionchange是document
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener,
  );
}

// This is only used by createEventHandle when the
// target is not a DOM element. E.g. window.
export function listenToNativeEventForNonManagedEventTarget(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget,
): void {
  let eventSystemFlags = IS_EVENT_HANDLE_NON_MANAGED_NODE;
  const listenerSet = getEventListenerSet(target);
  const listenerSetKey = getListenerSetKey(
    domEventName,
    isCapturePhaseListener,
  );
  if (!listenerSet.has(listenerSetKey)) {
    if (isCapturePhaseListener) {
      eventSystemFlags |= IS_CAPTURE_PHASE;
    }
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhaseListener,
    );
    listenerSet.add(listenerSetKey);
  }
}

const listeningMarker =
  '_reactListening' +
  Math.random()
    .toString(36)
    .slice(2);

// createRoot->createContainer->listenToAllSupportedEvents（#root）
export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  if (!(rootContainerElement: any)[listeningMarker]) {
    (rootContainerElement: any)[listeningMarker] = true;
    // 所有事件便利绑定
    allNativeEvents.forEach(domEventName => {
      // selectionchange 没冒泡，要单纯处理，在 document 上
      if (domEventName !== 'selectionchange') {
        if (!nonDelegatedEvents.has(domEventName)) {
          // 这里的false 表示正常冒泡，下面的true是捕获
          listenToNativeEvent(domEventName, false, rootContainerElement);
        }
        listenToNativeEvent(domEventName, true, rootContainerElement);
      }
    });
    // rootContainerElement.nodeType = 1，不是 document,ownerDocument就是document
    const ownerDocument =
      (rootContainerElement: any).nodeType === DOCUMENT_NODE
        ? rootContainerElement
        : (rootContainerElement: any).ownerDocument;
    if (ownerDocument !== null) {
      // selectionchange事件也需要重复数据删除
      //但是它是附加到文档的。
      if (!(ownerDocument: any)[listeningMarker]) {
        (ownerDocument: any)[listeningMarker] = true;
        // 也就是说 selectionchange 要在ownerDocument上处理，这玩意编辑器会用，只能在document上监听
        listenToNativeEvent('selectionchange', false, ownerDocument);
      }
    }
  }
}

function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean,
  isDeferredListenerForLegacyFBSupport?: boolean,
) {
  // 带有优先级的事件监听器
  let listener = createEventListenerWrapperWithPriority(
    targetContainer, //#root
    domEventName, //事件名
    eventSystemFlags, //捕获阶段标识
  );
  //如果不支持被动选项，则事件将被触发主动而非被动。
  let isPassiveListener = undefined;
  if (passiveBrowserEventsSupported) {
    // 自动给这些事件加passive优化性能
    // https://github.com/facebook/react/issues/19651
    if (
      domEventName === 'touchstart' ||
      domEventName === 'touchmove' ||
      domEventName === 'wheel'
    ) {
      isPassiveListener = true;
    }
  }

  targetContainer =
    enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport
      ? (targetContainer: any).ownerDocument
      : targetContainer;

  let unsubscribeListener;

  // 兼容性代码，无关紧要。不用看
  if (enableLegacyFBSupport && isDeferredListenerForLegacyFBSupport) {
    const originalListener = listener;
    listener = function(...p) {
      removeEventListener(
        targetContainer,
        domEventName,
        unsubscribeListener,
        isCapturePhaseListener,
      );
      return originalListener.apply(this, p);
    };
  }

  // 根据 isCapturePhaseListener 参数决定在捕获阶段还是冒泡阶段监听事件
  if (isCapturePhaseListener) {
    // 捕获阶段
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventCaptureListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener,
      );
    } else {
      unsubscribeListener = addEventCaptureListener(
        targetContainer,
        domEventName,
        listener,
      );
    }
  } else {
    // 冒泡阶段 添加passive
    if (isPassiveListener !== undefined) {
      unsubscribeListener = addEventBubbleListenerWithPassiveFlag(
        targetContainer,
        domEventName,
        listener,
        isPassiveListener,
      );
    } else {
      // 冒泡阶段，没有passive
      unsubscribeListener = addEventBubbleListener(
        targetContainer,
        domEventName,
        listener,
      );
    }
  }
}

function deferClickToDocumentForLegacyFBSupport(
  domEventName: DOMEventName,
  targetContainer: EventTarget,
): void {
  // We defer all click events with legacy FB support mode on.
  // This means we add a one time event listener to trigger
  // after the FB delegated listeners fire.
  const isDeferredListenerForLegacyFBSupport = true;
  addTrappedEventListener(
    targetContainer,
    domEventName,
    IS_LEGACY_FB_SUPPORT_MODE,
    false,
    isDeferredListenerForLegacyFBSupport,
  );
}

function isMatchingRootContainer(
  grandContainer: Element,
  targetContainer: EventTarget,
): boolean {
  return (
    grandContainer === targetContainer ||
    (grandContainer.nodeType === COMMENT_NODE &&
      grandContainer.parentNode === targetContainer)
  );
}

export function dispatchEventForPluginEventSystem(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  // 1. 初始化祖先实例为事件目标实例
  let ancestorInst = targetInst;

  // 2. 检查是否需要处理事件委托和根容器匹配逻辑
  if (
    (eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
    (eventSystemFlags & IS_NON_DELEGATED) === 0
  ) {
    // 2.1 将目标容器转换为DOM节点
    const targetContainerNode = ((targetContainer: any): Node);

    // 2.2 处理Facebook遗留支持的特殊点击事件逻辑
    if (
      enableLegacyFBSupport &&
      // 如果事件标志匹配进入FB遗留模式所需的标志，且正在处理"click"事件
      // 那么我们可以将事件延迟到"document"，以支持遗留FB行为
      // 期望的行为是匹配React < 16版本的委托点击到文档的行为
      domEventName === 'click' &&
      (eventSystemFlags & SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE) === 0 &&
      !isReplayingEvent(nativeEvent)
    ) {
      // 2.2.1 将点击事件延迟到文档以支持遗留FB支持
      deferClickToDocumentForLegacyFBSupport(domEventName, targetContainer);
      return;
    }

    // 2.3 如果目标实例不为空，需要确定正确的祖先实例
    if (targetInst !== null) {
      // 下面的逻辑尝试确定是否需要将目标fiber更改为不同的祖先
      // 我们在遗留事件系统中有类似的逻辑，但两个系统之间的主要区别是
      // 现代事件系统现在在每个React Root和React Portal Root上都有事件监听器
      // 代表这些根的DOM节点是"rootContainer"
      // 为了确定应该使用哪个祖先实例，我们从目标实例向上遍历fiber树
      // 并尝试找到与当前"rootContainer"匹配的根边界
      // 如果找到该"rootContainer"，我们找到该根的父fiber子树并将其作为祖先实例
      let node = targetInst;

      // 2.3.1 主循环：向上遍历fiber树寻找正确的根容器
      mainLoop: while (true) {
        // 2.3.2 如果节点为空，直接返回
        if (node === null) {
          return;
        }

        // 2.3.3 获取节点标签
        const nodeTag = node.tag;

        // 2.3.4 检查是否是HostRoot或HostPortal
        if (nodeTag === HostRoot || nodeTag === HostPortal) {
          // 2.3.5 获取容器的容器信息
          let container = node.stateNode.containerInfo;

          // 2.3.6 检查是否匹配目标根容器
          if (isMatchingRootContainer(container, targetContainerNode)) {
            break;
          }

          // 2.3.7 处理Portal的特殊情况
          if (nodeTag === HostPortal) {
            // 目标是portal，但不是我们要找的rootContainer
            // 通常portal会处理自己的事件一直到根
            // 所以我们应该能够现在停止。但是，我们不知道这个portal
            // 是否是*我们的*根的一部分
            let grandNode = node.return;
            while (grandNode !== null) {
              const grandTag = grandNode.tag;
              if (grandTag === HostRoot || grandTag === HostPortal) {
                const grandContainer = grandNode.stateNode.containerInfo;
                if (
                  isMatchingRootContainer(grandContainer, targetContainerNode)
                ) {
                  // 这是我们正在寻找的rootContainer，我们将其作为Portal的父级找到
                  // 这意味着我们可以忽略它，因为Portal会冒泡到我们这里
                  return;
                }
              }
              grandNode = grandNode.return;
            }
          }

          // 2.3.8 现在我们需要在另一个树中找到对应的host fiber
          // 为此我们可以使用getClosestInstanceFromNode，但我们需要验证
          // fiber是host实例，否则我们需要向上遍历DOM直到找到正确的节点
          while (container !== null) {
            const parentNode = getClosestInstanceFromNode(container);
            if (parentNode === null) {
              return;
            }
            const parentTag = parentNode.tag;
            if (parentTag === HostComponent || parentTag === HostText) {
              // 2.3.9 找到匹配的host组件，更新节点和祖先实例
              node = ancestorInst = parentNode;
              continue mainLoop;
            }
            // 2.3.10 继续向上遍历DOM树
            container = container.parentNode;
          }
        }
        // 2.3.11 向上遍历fiber树
        node = node.return;
      }
    }
  }

  // 3. 在批处理更新中分发事件给插件系统
  batchedUpdates(() =>
    dispatchEventsForPlugins(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      ancestorInst,
      targetContainer,
    ),
  );
}

function createDispatchListener(
  instance: null | Fiber,
  listener: Function,
  currentTarget: EventTarget,
): DispatchListener {
  return {
    instance,
    listener,
    currentTarget,
  };
}

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent,
): Array<DispatchListener> {
  // 1. 确定React事件名称（根据是否在捕获阶段）
  const captureName = reactName !== null ? reactName + 'Capture' : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  let listeners: Array<DispatchListener> = [];

  // 2. 初始化遍历变量
  let instance = targetFiber; // 当前遍历的fiber节点
  let lastHostComponent = null; // 最后一个host组件（DOM节点）

  // 3. 从目标节点向根节点遍历，收集所有事件监听器
  while (instance !== null) {
    const {stateNode, tag} = instance;

    // 3.1 处理HostComponent上的监听器（如<div>、<button>等DOM元素）
    if (tag === HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      // 3.1.1 处理createEventHandle API创建的监听器
      if (enableCreateEventHandleAPI) {
        const eventHandlerListeners = getEventHandlerListeners(
          lastHostComponent,
        );
        if (eventHandlerListeners !== null) {
          eventHandlerListeners.forEach(entry => {
            // 检查事件类型和阶段是否匹配
            if (
              entry.type === nativeEventType &&
              entry.capture === inCapturePhase
            ) {
              listeners.push(
                createDispatchListener(
                  instance,
                  entry.callback,
                  (lastHostComponent: any),
                ),
              );
            }
          });
        }
      }

      // 3.1.2 处理标准的React事件监听器（如onClick、onClickCapture）
      if (reactEventName !== null) {
        const listener = getListener(instance, reactEventName);
        if (listener != null) {
          listeners.push(
            createDispatchListener(instance, listener, lastHostComponent),
          );
        }
      }
    } else if (
      // 3.2 处理Scope组件上的监听器
      enableCreateEventHandleAPI &&
      enableScopeAPI &&
      tag === ScopeComponent &&
      lastHostComponent !== null &&
      stateNode !== null
    ) {
      // 3.2.1 处理Scope组件的事件监听器
      const reactScopeInstance = stateNode;
      const eventHandlerListeners = getEventHandlerListeners(
        reactScopeInstance,
      );
      if (eventHandlerListeners !== null) {
        eventHandlerListeners.forEach(entry => {
          if (
            entry.type === nativeEventType &&
            entry.capture === inCapturePhase
          ) {
            listeners.push(
              createDispatchListener(
                instance,
                entry.callback,
                (lastHostComponent: any),
              ),
            );
          }
        });
      }
    }

    // 3.3 如果只需要收集目标节点的事件，则停止遍历
    if (accumulateTargetOnly) {
      break;
    }

    // 3.4 处理beforeblur事件的特殊情况
    // 如果正在处理onBeforeBlur事件，需要考虑React树的一部分可能已被隐藏或删除
    // （因为我们在commit阶段调用此事件）。我们可以通过检查事件上设置的intercept fiber
    // 是否与当前实例fiber匹配来发现这一点。在这种情况下，我们应该清除所有现有的监听器
    if (enableCreateEventHandleAPI && nativeEvent.type === 'beforeblur') {
      // $FlowFixMe: internal field
      const detachedInterceptFiber = nativeEvent._detachedInterceptFiber;
      if (
        detachedInterceptFiber !== null &&
        (detachedInterceptFiber === instance ||
          detachedInterceptFiber === instance.alternate)
      ) {
        // 3.4.1 如果检测到分离的fiber，清空所有监听器
        listeners = [];
      }
    }

    // 3.5 向上遍历到父fiber节点
    instance = instance.return;
  }

  // 4. 返回收集到的所有监听器
  return listeners;
}

// We should only use this function for:
// - BeforeInputEventPlugin
// - ChangeEventPlugin
// - SelectEventPlugin
// This is because we only process these plugins
// in the bubble phase, so we need to accumulate two
// phase event listeners (via emulation).
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string,
): Array<DispatchListener> {
  const captureName = reactName + 'Capture';
  const listeners: Array<DispatchListener> = [];
  let instance = targetFiber;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const {stateNode, tag} = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      const captureListener = getListener(instance, captureName);
      if (captureListener != null) {
        listeners.unshift(
          createDispatchListener(instance, captureListener, currentTarget),
        );
      }
      const bubbleListener = getListener(instance, reactName);
      if (bubbleListener != null) {
        listeners.push(
          createDispatchListener(instance, bubbleListener, currentTarget),
        );
      }
    }
    instance = instance.return;
  }
  return listeners;
}

function getParent(inst: Fiber | null): Fiber | null {
  if (inst === null) {
    return null;
  }
  do {
    inst = inst.return;
    // TODO: If this is a HostRoot we might want to bail out.
    // That is depending on if we want nested subtrees (layers) to bubble
    // events to their parent. We could also go through parentNode on the
    // host node but that wouldn't work for React Native and doesn't let us
    // do the portal feature.
  } while (inst && inst.tag !== HostComponent);
  if (inst) {
    return inst;
  }
  return null;
}

/**
 * Return the lowest common ancestor of A and B, or null if they are in
 * different trees.
 */
function getLowestCommonAncestor(instA: Fiber, instB: Fiber): Fiber | null {
  let nodeA = instA;
  let nodeB = instB;
  let depthA = 0;
  for (let tempA = nodeA; tempA; tempA = getParent(tempA)) {
    depthA++;
  }
  let depthB = 0;
  for (let tempB = nodeB; tempB; tempB = getParent(tempB)) {
    depthB++;
  }

  // If A is deeper, crawl up.
  while (depthA - depthB > 0) {
    nodeA = getParent(nodeA);
    depthA--;
  }

  // If B is deeper, crawl up.
  while (depthB - depthA > 0) {
    nodeB = getParent(nodeB);
    depthB--;
  }

  // Walk in lockstep until we find a match.
  let depth = depthA;
  while (depth--) {
    if (nodeA === nodeB || (nodeB !== null && nodeA === nodeB.alternate)) {
      return nodeA;
    }
    nodeA = getParent(nodeA);
    nodeB = getParent(nodeB);
  }
  return null;
}

function accumulateEnterLeaveListenersForEvent(
  dispatchQueue: DispatchQueue,
  event: KnownReactSyntheticEvent,
  target: Fiber,
  common: Fiber | null,
  inCapturePhase: boolean,
): void {
  const registrationName = event._reactName;
  const listeners: Array<DispatchListener> = [];

  let instance = target;
  while (instance !== null) {
    if (instance === common) {
      break;
    }
    const {alternate, stateNode, tag} = instance;
    if (alternate !== null && alternate === common) {
      break;
    }
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      if (inCapturePhase) {
        const captureListener = getListener(instance, registrationName);
        if (captureListener != null) {
          listeners.unshift(
            createDispatchListener(instance, captureListener, currentTarget),
          );
        }
      } else if (!inCapturePhase) {
        const bubbleListener = getListener(instance, registrationName);
        if (bubbleListener != null) {
          listeners.push(
            createDispatchListener(instance, bubbleListener, currentTarget),
          );
        }
      }
    }
    instance = instance.return;
  }
  if (listeners.length !== 0) {
    dispatchQueue.push({event, listeners});
  }
}

// We should only use this function for:
// - EnterLeaveEventPlugin
// This is because we only process this plugin
// in the bubble phase, so we need to accumulate two
// phase event listeners.
export function accumulateEnterLeaveTwoPhaseListeners(
  dispatchQueue: DispatchQueue,
  leaveEvent: KnownReactSyntheticEvent,
  enterEvent: null | KnownReactSyntheticEvent,
  from: Fiber | null,
  to: Fiber | null,
): void {
  const common = from && to ? getLowestCommonAncestor(from, to) : null;

  if (from !== null) {
    accumulateEnterLeaveListenersForEvent(
      dispatchQueue,
      leaveEvent,
      from,
      common,
      false,
    );
  }
  if (to !== null && enterEvent !== null) {
    accumulateEnterLeaveListenersForEvent(
      dispatchQueue,
      enterEvent,
      to,
      common,
      true,
    );
  }
}

export function accumulateEventHandleNonManagedNodeListeners(
  reactEventType: DOMEventName,
  currentTarget: EventTarget,
  inCapturePhase: boolean,
): Array<DispatchListener> {
  const listeners: Array<DispatchListener> = [];

  const eventListeners = getEventHandlerListeners(currentTarget);
  if (eventListeners !== null) {
    eventListeners.forEach(entry => {
      if (entry.type === reactEventType && entry.capture === inCapturePhase) {
        listeners.push(
          createDispatchListener(null, entry.callback, currentTarget),
        );
      }
    });
  }
  return listeners;
}

export function getListenerSetKey(
  domEventName: DOMEventName,
  capture: boolean,
): string {
  return `${domEventName}__${capture ? 'capture' : 'bubble'}`;
}
