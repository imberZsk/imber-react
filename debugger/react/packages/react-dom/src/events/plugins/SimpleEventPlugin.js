/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DOMEventName} from '../../events/DOMEventNames';
import type {Fiber} from 'react-reconciler/src/ReactInternalTypes';
import type {AnyNativeEvent} from '../../events/PluginModuleType';
import type {DispatchQueue} from '../DOMPluginEventSystem';
import type {EventSystemFlags} from '../EventSystemFlags';

import {
  SyntheticEvent,
  SyntheticKeyboardEvent,
  SyntheticFocusEvent,
  SyntheticMouseEvent,
  SyntheticDragEvent,
  SyntheticTouchEvent,
  SyntheticAnimationEvent,
  SyntheticTransitionEvent,
  SyntheticUIEvent,
  SyntheticWheelEvent,
  SyntheticClipboardEvent,
  SyntheticPointerEvent,
} from '../../events/SyntheticEvent';

import {
  ANIMATION_END,
  ANIMATION_ITERATION,
  ANIMATION_START,
  TRANSITION_END,
} from '../DOMEventNames';
import {
  topLevelEventsToReactNames,
  registerSimpleEvents,
} from '../DOMEventProperties';
import {
  accumulateSinglePhaseListeners,
  accumulateEventHandleNonManagedNodeListeners,
} from '../DOMPluginEventSystem';
import {IS_EVENT_HANDLE_NON_MANAGED_NODE} from '../EventSystemFlags';

import getEventCharCode from '../getEventCharCode';
import {IS_CAPTURE_PHASE} from '../EventSystemFlags';

import {enableCreateEventHandleAPI} from 'shared/ReactFeatureFlags';

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget,
): void {
  // 1. 获取对应的React事件名称（如click -> onClick）
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return; // 如果不是React支持的事件，直接返回
  }

  // 2. 初始化合成事件构造函数和事件类型
  let SyntheticEventCtor = SyntheticEvent; // 默认使用基础合成事件
  let reactEventType: string = domEventName; // 默认事件类型与DOM事件名相同

  // 3. 根据DOM事件名称确定对应的合成事件类型和构造函数
  switch (domEventName) {
    //region
    case 'keypress':
      // 3.1 键盘事件特殊处理：Firefox会为功能键也创建keypress事件
      // 这里移除不需要的keypress事件。Enter键既是可打印的也是不可打印的
      // 人们可能期望Tab键也是如此（但实际上不是）
      if (getEventCharCode(((nativeEvent: any): KeyboardEvent)) === 0) {
        return; // 如果是功能键，不处理keypress事件
      }
    /* falls through */
    case 'keydown':
    case 'keyup':
      SyntheticEventCtor = SyntheticKeyboardEvent; // 键盘事件
      break;

    case 'focusin':
      reactEventType = 'focus'; // focusin -> focus
      SyntheticEventCtor = SyntheticFocusEvent;
      break;
    case 'focusout':
      reactEventType = 'blur'; // focusout -> blur
      SyntheticEventCtor = SyntheticFocusEvent;
      break;
    case 'beforeblur':
    case 'afterblur':
      SyntheticEventCtor = SyntheticFocusEvent; // 焦点相关事件
      break;
    //endregion
    case 'click':
      // 3.2 鼠标点击事件特殊处理：Firefox在右键点击时也会创建click事件
      // 这里移除不需要的右键点击事件
      if (nativeEvent.button === 2) {
        return; // 如果是右键点击，不处理
      }
    /* falls through */
    case 'auxclick':
    case 'dblclick':
    case 'mousedown':
    case 'mousemove':
    case 'mouseup':
    // TODO: 禁用的元素不应该响应鼠标事件
    /* falls through */
    case 'mouseout':
    case 'mouseover':
    case 'contextmenu':
      SyntheticEventCtor = SyntheticMouseEvent; // 鼠标事件
      break;

    case 'drag':
    case 'dragend':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'dragstart':
    case 'drop':
      SyntheticEventCtor = SyntheticDragEvent; // 拖拽事件
      break;

    case 'touchcancel':
    case 'touchend':
    case 'touchmove':
    case 'touchstart':
      SyntheticEventCtor = SyntheticTouchEvent; // 触摸事件
      break;

    case ANIMATION_END:
    case ANIMATION_ITERATION:
    case ANIMATION_START:
      SyntheticEventCtor = SyntheticAnimationEvent; // 动画事件
      break;

    case TRANSITION_END:
      SyntheticEventCtor = SyntheticTransitionEvent; // 过渡事件
      break;

    case 'scroll':
      SyntheticEventCtor = SyntheticUIEvent; // UI事件
      break;

    case 'wheel':
      SyntheticEventCtor = SyntheticWheelEvent; // 滚轮事件
      break;

    case 'copy':
    case 'cut':
    case 'paste':
      SyntheticEventCtor = SyntheticClipboardEvent; // 剪贴板事件
      break;

    case 'gotpointercapture':
    case 'lostpointercapture':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'pointerup':
      SyntheticEventCtor = SyntheticPointerEvent; // 指针事件
      break;

    default:
      // 3.3 未知事件。这用于createEventHandle API
      break;
  }

  // 4. 检查是否在捕获阶段
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  // 5. 处理createEventHandle API创建的非托管节点事件
  if (
    enableCreateEventHandleAPI &&
    eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE
  ) {
    // 5.1 收集非托管节点的事件监听器
    const listeners = accumulateEventHandleNonManagedNodeListeners(
      // TODO: 对于像"focus"这样React监听"focusin"的事件，这个转换可能没有意义
      ((reactEventType: any): DOMEventName),
      targetContainer,
      inCapturePhase,
    );

    if (listeners.length > 0) {
      // 5.2 懒创建合成事件对象
      const event = new SyntheticEventCtor(
        reactName, // onClick
        reactEventType, // click
        null, // currentTarget
        nativeEvent, // 原生事件
        nativeEventTarget, // 原生事件目标
      );
      // 5.3 将事件和监听器推入分发队列
      dispatchQueue.push({event, listeners});
    }
  } else {
    // 6. 处理标准的React事件监听器

    // 6.1 确定是否只收集目标节点的事件
    // 某些事件在浏览器中不会冒泡
    // 过去，React总是让它们冒泡，但这可能令人惊讶
    // 我们将尝试通过不让它们在React中冒泡来更接近浏览器行为
    // 我们从不让onScroll冒泡开始，然后扩展
    const accumulateTargetOnly =
      !inCapturePhase &&
      // TODO: 理想情况下，我们最终会添加DOMPluginEventSystem中nonDelegatedEvents列表的所有事件
      // 然后我们可以移除这个特殊列表
      // 这是一个可以等到React 18的破坏性更改
      domEventName === 'scroll';

    // 6.2 收集单阶段事件监听器（捕获或冒泡）
    const listeners = accumulateSinglePhaseListeners(
      targetInst, // 目标fiber节点
      reactName, // React事件名称（如onClick）
      nativeEvent.type, // 原生事件类型（如click）
      inCapturePhase, // 是否在捕获阶段
      accumulateTargetOnly, // 是否只收集目标节点
      nativeEvent, // 原生事件对象
    );

    if (listeners.length > 0) {
      // 6.3 懒创建合成事件对象，就是event.target的e
      const event = new SyntheticEventCtor(
        reactName, // onClick
        reactEventType, // click
        null, // currentTarget
        nativeEvent, // 原生事件
        nativeEventTarget, // 原生事件目标
      );
      // 6.4 将事件和监听器推入分发队列
      dispatchQueue.push({event, listeners});
    }
  }
}

export {registerSimpleEvents as registerEvents, extractEvents};
