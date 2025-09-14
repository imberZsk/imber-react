/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

/* eslint valid-typeof: 0 */

import assign from 'shared/assign';
import getEventCharCode from './getEventCharCode';

type EventInterfaceType = {
  [propName: string]: 0 | ((event: {[propName: string]: mixed}) => mixed),
};

function functionThatReturnsTrue() {
  return true;
}

function functionThatReturnsFalse() {
  return false;
}

// 这是一个工厂函数，故意返回不同的构造函数
// 如果我们只有一个构造函数，它会是多态的，引擎会去优化
function createSyntheticEvent(Interface: EventInterfaceType) {
  /**
   * 合成事件由事件插件分发，通常响应顶级事件委托处理器
   * 这些系统通常应该使用对象池来减少垃圾收集的频率
   * 系统应该检查 `isPersistent` 来确定事件在分发后是否应该释放回池中
   * 需要持久化事件的用户应该调用 `persist`
   * 合成事件（及其子类）通过标准化浏览器差异来实现DOM Level 3 Events API
   * 子类不一定必须实现DOM接口；自定义应用程序特定事件也可以继承此类
   */
  function SyntheticBaseEvent(
    reactName: string | null, // React事件名称（如onClick）
    reactEventType: string, // React事件类型（如click）
    targetInst: Fiber, // 目标fiber实例
    nativeEvent: {[propName: string]: mixed}, // 原生事件对象
    nativeEventTarget: null | EventTarget, // 原生事件目标
  ) {
    // 1. 设置基本属性
    this._reactName = reactName; // 存储React事件名称
    this._targetInst = targetInst; // 存储目标fiber实例
    this.type = reactEventType; // 设置事件类型
    this.nativeEvent = nativeEvent; // 存储原生事件对象
    this.target = nativeEventTarget; // 设置事件目标
    this.currentTarget = null; // 当前目标（稍后设置）

    // 2. 根据接口定义标准化事件属性
    for (const propName in Interface) {
      if (!Interface.hasOwnProperty(propName)) {
        continue;
      }
      const normalize = Interface[propName];
      if (normalize) {
        // 2.1 如果有标准化函数，使用它来处理属性
        this[propName] = normalize(nativeEvent);
      } else {
        // 2.2 否则直接复制原生事件属性
        this[propName] = nativeEvent[propName];
      }
    }

    // 3. 处理默认行为阻止状态
    const defaultPrevented =
      nativeEvent.defaultPrevented != null
        ? nativeEvent.defaultPrevented
        : nativeEvent.returnValue === false;
    if (defaultPrevented) {
      // 3.1 如果默认行为已被阻止，设置相应的函数
      this.isDefaultPrevented = functionThatReturnsTrue;
    } else {
      // 3.2 否则设置为返回false的函数
      this.isDefaultPrevented = functionThatReturnsFalse;
    }

    // 4. 初始化事件传播状态
    this.isPropagationStopped = functionThatReturnsFalse;
    return this;
  }

  // 5. 为合成事件原型添加方法
  assign(SyntheticBaseEvent.prototype, {
    // 5.1 阻止默认行为
    preventDefault: function() {
      this.defaultPrevented = true;
      const event = this.nativeEvent;
      if (!event) {
        return;
      }

      // 5.1.1 调用原生事件的preventDefault方法
      if (event.preventDefault) {
        event.preventDefault();
        // $FlowFixMe - flow is not aware of `unknown` in IE
      } else if (typeof event.returnValue !== 'unknown') {
        // 5.1.2 兼容IE：设置returnValue为false
        event.returnValue = false;
      }
      // 5.1.3 更新阻止状态
      this.isDefaultPrevented = functionThatReturnsTrue;
    },

    // 5.2 停止事件传播
    stopPropagation: function() {
      const event = this.nativeEvent;
      if (!event) {
        return;
      }

      // 5.2.1 调用原生事件的stopPropagation方法
      if (event.stopPropagation) {
        event.stopPropagation();
        // $FlowFixMe - flow is not aware of `unknown` in IE
      } else if (typeof event.cancelBubble !== 'unknown') {
        // 5.2.2 兼容IE：设置cancelBubble为true
        // ChangeEventPlugin为IE注册"propertychange"事件
        // 此事件不支持冒泡或取消，任何对cancelBubble的引用都会抛出"Member not found"
        // typeof检查"unknown"可以避免此问题（这也是IE特定的）
        event.cancelBubble = true;
      }

      // 5.2.3 更新传播停止状态
      this.isPropagationStopped = functionThatReturnsTrue;
    },

    /**
     * 5.3 持久化事件
     * 我们在每个事件循环后释放所有已分发的`SyntheticEvent`，将它们添加回池中
     * 这提供了一种方式来保持引用，而不会将其添加回池中
     */
    persist: function() {
      // 现代事件系统不使用对象池
    },

    /**
     * 5.4 检查事件是否应该释放回池中
     * @return {boolean} 如果不应释放则返回true，否则返回false
     */
    isPersistent: functionThatReturnsTrue,
  });

  // 6. 返回构造好的合成事件构造函数
  return SyntheticBaseEvent;
}

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const EventInterface = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function(event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: 0,
  isTrusted: 0,
};
export const SyntheticEvent = createSyntheticEvent(EventInterface);

const UIEventInterface: EventInterfaceType = {
  ...EventInterface,
  view: 0,
  detail: 0,
};
export const SyntheticUIEvent = createSyntheticEvent(UIEventInterface);

let lastMovementX;
let lastMovementY;
let lastMouseEvent;

function updateMouseMovementPolyfillState(event) {
  if (event !== lastMouseEvent) {
    if (lastMouseEvent && event.type === 'mousemove') {
      lastMovementX = event.screenX - lastMouseEvent.screenX;
      lastMovementY = event.screenY - lastMouseEvent.screenY;
    } else {
      lastMovementX = 0;
      lastMovementY = 0;
    }
    lastMouseEvent = event;
  }
}

/**
 * @interface MouseEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const MouseEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  pageX: 0,
  pageY: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  getModifierState: getEventModifierState,
  button: 0,
  buttons: 0,
  relatedTarget: function(event) {
    if (event.relatedTarget === undefined)
      return event.fromElement === event.srcElement
        ? event.toElement
        : event.fromElement;

    return event.relatedTarget;
  },
  movementX: function(event) {
    if ('movementX' in event) {
      return event.movementX;
    }
    updateMouseMovementPolyfillState(event);
    return lastMovementX;
  },
  movementY: function(event) {
    if ('movementY' in event) {
      return event.movementY;
    }
    // Don't need to call updateMouseMovementPolyfillState() here
    // because it's guaranteed to have already run when movementX
    // was copied.
    return lastMovementY;
  },
};
export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);

/**
 * @interface DragEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const DragEventInterface: EventInterfaceType = {
  ...MouseEventInterface,
  dataTransfer: 0,
};
export const SyntheticDragEvent = createSyntheticEvent(DragEventInterface);

/**
 * @interface FocusEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const FocusEventInterface: EventInterfaceType = {
  ...UIEventInterface,
  relatedTarget: 0,
};
export const SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);

/**
 * @interface Event
 * @see http://www.w3.org/TR/css3-animations/#AnimationEvent-interface
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AnimationEvent
 */
const AnimationEventInterface: EventInterfaceType = {
  ...EventInterface,
  animationName: 0,
  elapsedTime: 0,
  pseudoElement: 0,
};
export const SyntheticAnimationEvent = createSyntheticEvent(
  AnimationEventInterface,
);

/**
 * @interface Event
 * @see http://www.w3.org/TR/clipboard-apis/
 */
const ClipboardEventInterface: EventInterfaceType = {
  ...EventInterface,
  clipboardData: function(event) {
    return 'clipboardData' in event
      ? event.clipboardData
      : window.clipboardData;
  },
};
export const SyntheticClipboardEvent = createSyntheticEvent(
  ClipboardEventInterface,
);

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#events-compositionevents
 */
const CompositionEventInterface: EventInterfaceType = {
  ...EventInterface,
  data: 0,
};
export const SyntheticCompositionEvent = createSyntheticEvent(
  CompositionEventInterface,
);

/**
 * @interface Event
 * @see http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105
 *      /#events-inputevents
 */
// Happens to share the same list for now.
export const SyntheticInputEvent = SyntheticCompositionEvent;

/**
 * Normalization of deprecated HTML5 `key` values
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
const normalizeKey = {
  Esc: 'Escape',
  Spacebar: ' ',
  Left: 'ArrowLeft',
  Up: 'ArrowUp',
  Right: 'ArrowRight',
  Down: 'ArrowDown',
  Del: 'Delete',
  Win: 'OS',
  Menu: 'ContextMenu',
  Apps: 'ContextMenu',
  Scroll: 'ScrollLock',
  MozPrintableKey: 'Unidentified',
};

/**
 * Translation from legacy `keyCode` to HTML5 `key`
 * Only special keys supported, all others depend on keyboard layout or browser
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
const translateToKey = {
  '8': 'Backspace',
  '9': 'Tab',
  '12': 'Clear',
  '13': 'Enter',
  '16': 'Shift',
  '17': 'Control',
  '18': 'Alt',
  '19': 'Pause',
  '20': 'CapsLock',
  '27': 'Escape',
  '32': ' ',
  '33': 'PageUp',
  '34': 'PageDown',
  '35': 'End',
  '36': 'Home',
  '37': 'ArrowLeft',
  '38': 'ArrowUp',
  '39': 'ArrowRight',
  '40': 'ArrowDown',
  '45': 'Insert',
  '46': 'Delete',
  '112': 'F1',
  '113': 'F2',
  '114': 'F3',
  '115': 'F4',
  '116': 'F5',
  '117': 'F6',
  '118': 'F7',
  '119': 'F8',
  '120': 'F9',
  '121': 'F10',
  '122': 'F11',
  '123': 'F12',
  '144': 'NumLock',
  '145': 'ScrollLock',
  '224': 'Meta',
};

/**
 * @param {object} nativeEvent Native browser event.
 * @return {string} Normalized `key` property.
 */
function getEventKey(nativeEvent) {
  if (nativeEvent.key) {
    // Normalize inconsistent values reported by browsers due to
    // implementations of a working draft specification.

    // FireFox implements `key` but returns `MozPrintableKey` for all
    // printable characters (normalized to `Unidentified`), ignore it.
    const key = normalizeKey[nativeEvent.key] || nativeEvent.key;
    if (key !== 'Unidentified') {
      return key;
    }
  }

  // Browser does not implement `key`, polyfill as much of it as we can.
  if (nativeEvent.type === 'keypress') {
    const charCode = getEventCharCode(nativeEvent);

    // The enter-key is technically both printable and non-printable and can
    // thus be captured by `keypress`, no other non-printable key should.
    return charCode === 13 ? 'Enter' : String.fromCharCode(charCode);
  }
  if (nativeEvent.type === 'keydown' || nativeEvent.type === 'keyup') {
    // While user keyboard layout determines the actual meaning of each
    // `keyCode` value, almost all function keys have a universal value.
    return translateToKey[nativeEvent.keyCode] || 'Unidentified';
  }
  return '';
}

/**
 * Translation from modifier key to the associated property in the event.
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#keys-Modifiers
 */
const modifierKeyToProp = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
};

// Older browsers (Safari <= 10, iOS Safari <= 10.2) do not support
// getModifierState. If getModifierState is not supported, we map it to a set of
// modifier keys exposed by the event. In this case, Lock-keys are not supported.
function modifierStateGetter(keyArg) {
  const syntheticEvent = this;
  const nativeEvent = syntheticEvent.nativeEvent;
  if (nativeEvent.getModifierState) {
    return nativeEvent.getModifierState(keyArg);
  }
  const keyProp = modifierKeyToProp[keyArg];
  return keyProp ? !!nativeEvent[keyProp] : false;
}

function getEventModifierState(nativeEvent) {
  return modifierStateGetter;
}

/**
 * @interface KeyboardEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const KeyboardEventInterface = {
  ...UIEventInterface,
  key: getEventKey,
  code: 0,
  location: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0,
  metaKey: 0,
  repeat: 0,
  locale: 0,
  getModifierState: getEventModifierState,
  // Legacy Interface
  charCode: function(event) {
    // `charCode` is the result of a KeyPress event and represents the value of
    // the actual printable character.

    // KeyPress is deprecated, but its replacement is not yet final and not
    // implemented in any major browser. Only KeyPress has charCode.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    return 0;
  },
  keyCode: function(event) {
    // `keyCode` is the result of a KeyDown/Up event and represents the value of
    // physical keyboard key.

    // The actual meaning of the value depends on the users' keyboard layout
    // which cannot be detected. Assuming that it is a US keyboard layout
    // provides a surprisingly accurate mapping for US and European users.
    // Due to this, it is left to the user to implement at this time.
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  },
  which: function(event) {
    // `which` is an alias for either `keyCode` or `charCode` depending on the
    // type of the event.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  },
};
export const SyntheticKeyboardEvent = createSyntheticEvent(
  KeyboardEventInterface,
);

/**
 * @interface PointerEvent
 * @see http://www.w3.org/TR/pointerevents/
 */
const PointerEventInterface = {
  ...MouseEventInterface,
  pointerId: 0,
  width: 0,
  height: 0,
  pressure: 0,
  tangentialPressure: 0,
  tiltX: 0,
  tiltY: 0,
  twist: 0,
  pointerType: 0,
  isPrimary: 0,
};
export const SyntheticPointerEvent = createSyntheticEvent(
  PointerEventInterface,
);

/**
 * @interface TouchEvent
 * @see http://www.w3.org/TR/touch-events/
 */
const TouchEventInterface = {
  ...UIEventInterface,
  touches: 0,
  targetTouches: 0,
  changedTouches: 0,
  altKey: 0,
  metaKey: 0,
  ctrlKey: 0,
  shiftKey: 0,
  getModifierState: getEventModifierState,
};
export const SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);

/**
 * @interface Event
 * @see http://www.w3.org/TR/2009/WD-css3-transitions-20090320/#transition-events-
 * @see https://developer.mozilla.org/en-US/docs/Web/API/TransitionEvent
 */
const TransitionEventInterface = {
  ...EventInterface,
  propertyName: 0,
  elapsedTime: 0,
  pseudoElement: 0,
};
export const SyntheticTransitionEvent = createSyntheticEvent(
  TransitionEventInterface,
);

/**
 * @interface WheelEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
const WheelEventInterface = {
  ...MouseEventInterface,
  deltaX(event) {
    return 'deltaX' in event
      ? event.deltaX
      : // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
      'wheelDeltaX' in event
      ? -event.wheelDeltaX
      : 0;
  },
  deltaY(event) {
    return 'deltaY' in event
      ? event.deltaY
      : // Fallback to `wheelDeltaY` for Webkit and normalize (down is positive).
      'wheelDeltaY' in event
      ? -event.wheelDeltaY
      : // Fallback to `wheelDelta` for IE<9 and normalize (down is positive).
      'wheelDelta' in event
      ? -event.wheelDelta
      : 0;
  },
  deltaZ: 0,

  // Browsers without "deltaMode" is reporting in raw wheel delta where one
  // notch on the scroll is always +/- 120, roughly equivalent to pixels.
  // A good approximation of DOM_DELTA_LINE (1) is 5% of viewport size or
  // ~40 pixels, for DOM_DELTA_SCREEN (2) it is 87.5% of viewport size.
  deltaMode: 0,
};
export const SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);
