/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable no-var */

import {
  enableSchedulerDebugging,
  enableProfiling,
  enableIsInputPending,
  enableIsInputPendingContinuous,
  frameYieldMs,
  continuousYieldMs,
  maxYieldMs,
} from '../SchedulerFeatureFlags';

import {push, pop, peek} from '../SchedulerMinHeap';

// TODO: Use symbols?
import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
} from '../SchedulerPriorities';
import {
  markTaskRun,
  markTaskYield,
  markTaskCompleted,
  markTaskCanceled,
  markTaskErrored,
  markSchedulerSuspended,
  markSchedulerUnsuspended,
  markTaskStart,
  stopLoggingProfilingEvents,
  startLoggingProfilingEvents,
} from '../SchedulerProfiling';

let getCurrentTime;
const hasPerformanceNow =
  typeof performance === 'object' && typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;
}

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
var maxSigned31BitInt = 1073741823;

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// Tasks are stored on a min heap
var taskQueue = [];
var timerQueue = [];

// Incrementing id counter. Used to maintain insertion order.
var taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
var isSchedulerPaused = false;

var currentTask = null;
var currentPriorityLevel = NormalPriority;

// This is set while performing work, to prevent re-entrance.
var isPerformingWork = false;

var isHostCallbackScheduled = false;
var isHostTimeoutScheduled = false;

// Capture local references to native APIs, in case a polyfill overrides them.
const localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;
const localClearTimeout =
  typeof clearTimeout === 'function' ? clearTimeout : null;
const localSetImmediate =
  typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom

const isInputPending =
  typeof navigator !== 'undefined' &&
  navigator.scheduling !== undefined &&
  navigator.scheduling.isInputPending !== undefined
    ? navigator.scheduling.isInputPending.bind(navigator.scheduling)
    : null;

const continuousOptions = {includeContinuous: enableIsInputPendingContinuous};

function advanceTimers(currentTime) {
  // Check for tasks that are no longer delayed and add them to the queue.
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      // Timer was cancelled.
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      // Timer fired. Transfer to the task queue.
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      if (enableProfiling) {
        markTaskStart(timer, currentTime);
        timer.isQueued = true;
      }
    } else {
      // Remaining timers are pending.
      return;
    }
    timer = peek(timerQueue);
  }
}

function handleTimeout(currentTime) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

/**
 * flushWork
 * 在一个浏览器任务切片中冲刷（执行）调度队列中的任务。
 * - 负责协调超时回调的取消、恢复优先级、错误打点与暂停打点。
 * - 内部调用 workLoop 按时间片执行任务；返回值表示是否还有剩余工作。
 *
 * @param {boolean} hasTimeRemaining - 本次切片是否还有可用时间（由宿主环境决定）
 * @param {number} initialTime - 进入本次切片时的当前时间戳
 * @returns {boolean} 是否还有剩余任务需要继续调度
 */
function flushWork(hasTimeRemaining, initialTime) {
  // 性能分析：标记调度器从暂停状态恢复，记录恢复时间点
  if (enableProfiling) {
    markSchedulerUnsuspended(initialTime);
  }

  // 重置主机回调调度标志，因为即将开始执行工作
  // 下次有新任务时，需要重新调度主机回调
  isHostCallbackScheduled = false;
  
  // 如果之前设置了超时回调，现在开始执行工作就不需要了
  // 因为工作已经开始，超时回调是用于延迟任务的
  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout(); // 取消之前设置的超时回调
  }

  // 标记正在执行工作，防止重入
  isPerformingWork = true;
  // 保存当前优先级，因为工作循环可能会改变优先级
  const previousPriorityLevel = currentPriorityLevel;
  
  try {
    if (enableProfiling) {
      // 开发模式：包装错误处理，记录任务错误状态
      try {
        return workLoop(hasTimeRemaining, initialTime);
      } catch (error) {
        // 如果当前有任务在执行时出错，标记该任务为错误状态
        if (currentTask !== null) {
          const currentTime = getCurrentTime();
          markTaskErrored(currentTask, currentTime);
          currentTask.isQueued = false; // 从队列中移除
        }
        throw error; // 重新抛出错误
      }
    } else {
      // 生产模式：直接执行，不包装错误处理以提高性能
      return workLoop(hasTimeRemaining, initialTime);
    }
  } finally {
    // 无论成功还是失败，都要清理执行上下文
    currentTask = null; // 清空当前任务引用
    currentPriorityLevel = previousPriorityLevel; // 恢复之前的优先级
    isPerformingWork = false; // 标记工作执行完毕
    
    // 性能分析：标记调度器进入暂停状态
    if (enableProfiling) {
      const currentTime = getCurrentTime();
      markSchedulerSuspended(currentTime);
    }
  }
}

/**
 * workLoop
 * 核心执行循环：在不超过时间片/截至时间的前提下，依次从最小堆取出任务并执行。
 * - 若任务未过期且时间用尽/应当让出，则中断本次循环以便后续继续。
 * - 任务回调可返回 continuationCallback 以分段执行长任务。
 * - 返回值告知外层是否还有待处理工作，用于决定是否继续调度。
 *
 * @param {boolean} hasTimeRemaining - 是否还有可用时间
 * @param {number} initialTime - 循环开始时间
 * @returns {boolean} 是否还有剩余任务
 */
function workLoop(hasTimeRemaining, initialTime) {
  // 初始化当前时间，用于判断任务是否过期
  let currentTime = initialTime;
  
  // 推进定时器：将到期的延迟任务从 timerQueue 转移到 taskQueue
  advanceTimers(currentTime);
  
  // 从任务队列（最小堆）顶部获取优先级最高的任务
  currentTask = peek(taskQueue);
  
  // 主循环：持续执行任务直到满足退出条件
  while (
    currentTask !== null && // 还有任务需要执行
    !(enableSchedulerDebugging && isSchedulerPaused) // 调度器未被调试暂停
  ) {
    // 检查是否应该让出控制权
    if (
      currentTask.expirationTime > currentTime && // 任务还未过期
      (!hasTimeRemaining || shouldYieldToHost()) // 且（没有剩余时间 或 应该让出给宿主）
    ) {
      // 任务未过期但需要让出：中断循环，等待下一个时间切片
      break;
    }
    
    // 获取任务的回调函数
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      // 清空回调引用，防止重复执行
      currentTask.callback = null;
      
      // 切换到任务的优先级上下文，确保任务在正确的优先级下执行
      currentPriorityLevel = currentTask.priorityLevel;
      
      // 判断任务是否超时：过期时间 <= 当前时间
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      
      // 性能分析：标记任务开始运行
      if (enableProfiling) {
        markTaskRun(currentTask, currentTime);
      }
      
      // 执行任务回调，传入是否超时的信息
      // 回调可能返回一个函数（continuationCallback）用于分片执行
      const continuationCallback = callback(didUserCallbackTimeout);
      
      // 更新当前时间，因为任务执行可能消耗了时间
      currentTime = getCurrentTime();
      
      if (typeof continuationCallback === 'function') {
        // 任务返回了持续回调：说明任务需要分片执行
        // 将持续回调重新挂载到当前任务上，稍后继续执行
        currentTask.callback = continuationCallback;
        
        // 性能分析：标记任务让出（分片）
        if (enableProfiling) {
          markTaskYield(currentTask, currentTime);
        }
      } else {
        // 任务完成：没有返回持续回调
        // 性能分析：标记任务完成
        if (enableProfiling) {
          markTaskCompleted(currentTask, currentTime);
          currentTask.isQueued = false; // 从队列状态中移除
        }
        
        // 如果当前任务仍在队列顶部，将其从队列中移除
        // 注意：由于优先级可能变化，任务可能已经不在顶部
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      
      // 每次执行任务后，推进定时器队列
      // 将新到期的延迟任务转移到任务队列中
      advanceTimers(currentTime);
    } else {
      // 任务回调已被取消（callback 为 null）
      // 直接从队列中移除这个无效任务
      pop(taskQueue);
    }
    
    // 获取下一个要执行的任务
    currentTask = peek(taskQueue);
  }
  
  // 判断是否还有剩余工作
  if (currentTask !== null) {
    // 还有未完成的任务（可能是被分片的或未过期的）
    // 返回 true 通知外层继续调度
    return true;
  } else {
    // 没有立即执行的任务，检查是否有延迟任务
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      // 存在延迟任务：计算延迟时间并设置超时回调
      // 当延迟时间到达时，会触发 handleTimeout 来重新调度
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    // 没有更多工作，返回 false
    return false;
  }
}

function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_next(eventHandler) {
  var priorityLevel;
  switch (currentPriorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
      // Shift down to normal priority
      priorityLevel = NormalPriority;
      break;
    default:
      // Anything lower than normal priority should remain at the current level.
      priorityLevel = currentPriorityLevel;
      break;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_wrapCallback(callback) {
  var parentPriorityLevel = currentPriorityLevel;
  return function() {
    // This is a fork of runWithPriority, inlined for performance.
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;

    try {
      return callback.apply(this, arguments);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

// 调度任务(异步)
/**
 * 调度一个回调函数
 * 根据优先级和选项将任务添加到调度队列中
 * 
 * @param {number} priorityLevel - 任务优先级（ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority, IdlePriority）
 * @param {Function} callback - 要执行的回调函数
 * @param {Object} options - 可选的配置对象，包含 delay 属性
 * @returns {Object} 新创建的任务对象
 */
function unstable_scheduleCallback(priorityLevel, callback, options) {
  // 获取当前时间
  var currentTime = getCurrentTime();

  // 计算任务开始时间
  var startTime;
  if (typeof options === 'object' && options !== null) {
    var delay = options.delay;
    // 如果指定了延迟时间且大于0，则延迟执行
    if (typeof delay === 'number' && delay > 0) {
      startTime = currentTime + delay;
    } else {
      startTime = currentTime;
    }
  } else {
    startTime = currentTime;
  }

  // 根据优先级确定超时时间
  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;  // 立即优先级：-1ms
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;  // 用户阻塞优先级：250ms
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;  // 空闲优先级：1073741823ms（最大安全整数）
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;  // 低优先级：10000ms
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;  // 普通优先级：5000ms
      break;
  }

  // 计算任务过期时间
  var expirationTime = startTime + timeout;

  // 创建新的任务对象
  var newTask = {
    id: taskIdCounter++,        // 任务唯一标识符
    callback,                   // 要执行的回调函数
    priorityLevel,             // 任务优先级
    startTime,                 // 任务开始时间
    expirationTime,            // 任务过期时间
    sortIndex: -1,             // 排序索引，用于堆排序
  };
  
  // 如果启用了性能分析，添加队列状态标记
  if (enableProfiling) {
    newTask.isQueued = false;
  }

  // 根据任务开始时间决定如何处理任务
  if (startTime > currentTime) {
    // 这是一个延迟任务
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);  // 添加到定时器队列
    
    // 如果任务队列为空且这是定时器队列中最早的任务
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      // 所有任务都是延迟的，这是延迟最早的任务
      if (isHostTimeoutScheduled) {
        // 取消现有的超时
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      // 调度一个超时
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    // 立即执行的任务
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);  // 添加到任务队列
    
    // 如果启用了性能分析，标记任务开始
    if (enableProfiling) {
      markTaskStart(newTask, currentTime);
      newTask.isQueued = true;
    }
    
    // 如果需要，调度主机回调
    // 如果我们已经在执行工作，等待下次让出时再调度
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }

  // 返回新创建的任务对象
  return newTask;
}

function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
}

function unstable_getFirstCallbackNode() {
  return peek(taskQueue);
}

function unstable_cancelCallback(task) {
  if (enableProfiling) {
    if (task.isQueued) {
      const currentTime = getCurrentTime();
      markTaskCanceled(task, currentTime);
      task.isQueued = false;
    }
  }

  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

let isMessageLoopRunning = false;
let scheduledHostCallback = null;
let taskTimeoutID = -1;

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs;
const continuousInputInterval = continuousYieldMs;
const maxInterval = maxYieldMs;
let startTime = -1;

let needsPaint = false;

/**
 * shouldYieldToHost
 * 判断是否应将主线程控制权让给宿主环境（浏览器/Node），以便处理更高优先级的工作（如绘制与用户输入）。
 * 策略：
 * - 在极短时间窗口内（小于一帧），尽量不让出以减少切换开销。
 * - 超过短窗口后，根据是否存在绘制/输入待处理动态决定让出频率；
 * - 超过最大窗口后，无条件让出，保证系统整体响应性。
 * - 若支持 navigator.scheduling.isInputPending，则更智能地感知输入压力；否则保守让出。
 */
function shouldYieldToHost() {
  // 计算主线程被阻塞的时间长度
  const timeElapsed = getCurrentTime() - startTime;
  
  // 第一层判断：极短时间窗口（小于一帧时间）
  if (timeElapsed < frameInterval) {
    // 英文注释翻译：
    // 主线程仅被阻塞了极短时间，小于一帧的时间。暂时不让出控制权。
    // 中文详细解释：
    // 在极短时间窗口内，切换上下文的开销可能大于继续执行的好处
    // 因此选择继续执行，避免频繁的让出/恢复操作
    return false;
  }

  // 第二层判断：超过短时间窗口后的智能让出策略
  // 英文注释翻译：
  // 主线程已经被阻塞了不可忽略的时间。我们可能想要让出主线程的控制权，
  // 以便浏览器可以执行高优先级任务。主要的高优先级任务包括绘制和用户输入。
  // 如果有待处理的绘制或输入，那么我们应该让出。但如果没有这些，
  // 我们可以在保持响应性的同时减少让出频率。我们最终还是会让出，
  // 因为可能存在没有伴随 `requestPaint` 调用的待处理绘制，
  // 或其他主线程任务，如网络事件。
  
  // 中文详细解释：
  // 超过短时间窗口后，需要根据系统压力智能决定是否让出
  // 策略：优先响应绘制和用户输入，同时避免过度频繁的让出
  if (enableIsInputPending) {
    // 优先级1：绘制信号检查
    if (needsPaint) {
      // 英文注释翻译：
      // 有待处理的绘制（通过 `requestPaint` 标记）。立即让出。
      // 中文详细解释：
      // 当检测到有待处理的绘制工作时，立即让出控制权
      // 这确保了视觉更新的及时性，避免界面卡顿
      return true;
    }
    
    // 优先级2：短时间窗口的输入检查（仅检查离散输入）
    if (timeElapsed < continuousInputInterval) {
      // 英文注释翻译：
      // 我们还没有阻塞线程那么长时间。只有在有待处理的离散输入（如点击）时才让出。
      // 如果有待处理的连续输入（如鼠标悬停），这是可以接受的。
      // 中文详细解释：
      // 在较短的时间窗口内，只对离散输入（如点击、键盘按键）敏感
      // 连续输入（如鼠标移动、滚动）可以适当延后处理
      // 这样可以在保持响应性的同时减少不必要的让出
      if (isInputPending !== null) {
        return isInputPending(); // 只检查离散输入
      }
    } 
    // 优先级3：中等时间窗口的输入检查（检查所有类型输入）
    else if (timeElapsed < maxInterval) {
      // 英文注释翻译：
      // 如果有待处理的离散或连续输入，就让出。
      // 中文详细解释：
      // 进入中等时间窗口，对输入更加敏感
      // 无论是离散输入还是连续输入，都值得让出控制权
      if (isInputPending !== null) {
        return isInputPending(continuousOptions); // 检查所有类型输入
      }
    } 
    // 优先级4：长时间窗口的无条件让出
    else {
      // 英文注释翻译：
      // 我们已经阻塞线程很长时间了。即使没有待处理的输入，
      // 也可能有一些我们不知道的其他调度工作，如网络事件。立即让出。
      // 中文详细解释：
      // 超过最大时间窗口后，无论是否有输入信号，都无条件让出
      // 因为可能存在其他类型的主线程任务（网络、定时器等）
      // 长时间占用主线程会严重影响系统整体响应性
      return true;
    }
  }

  // 降级策略：不支持 isInputPending 时的保守让出
  // 英文注释翻译：
  // `isInputPending` 不可用。立即让出。
  // 中文详细解释：
  // 在不支持输入检测的环境中（如旧版浏览器），采用保守策略
  // 直接让出控制权，确保系统响应性
  return true;
}

function requestPaint() {
  if (
    enableIsInputPending &&
    navigator !== undefined &&
    navigator.scheduling !== undefined &&
    navigator.scheduling.isInputPending !== undefined
  ) {
    needsPaint = true;
  }

  // Since we yield every frame regardless, `requestPaint` has no effect.
}

function forceFrameRate(fps) {
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
        'forcing frame rates higher than 125 fps is not supported',
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    frameInterval = frameYieldMs;
  }
}

/**
 * 执行工作直到截止时间
 * 这是 MessageChannel 回调函数，在每次宏任务中执行
 * 负责在时间切片内执行 React 任务，并在时间用完后让出控制权
 */
const performWorkUntilDeadline = () => {
  // 检查是否有待执行的主机回调
  if (scheduledHostCallback !== null) {
    // 获取当前时间
    const currentTime = getCurrentTime();
    
    // 记录开始时间，以便测量主线程被阻塞的时间
    startTime = currentTime;
    
    // 标记还有剩余时间（这里总是 true，实际的时间检查在回调内部进行）
    const hasTimeRemaining = true;

    // 如果调度器任务抛出错误，退出当前浏览器任务以便观察错误
    //
    // 故意不使用 try-catch，因为这会使某些调试技术变得困难
    // 相反，如果 scheduledHostCallback 出错，hasMoreWork 将保持为 true，
    // 我们将继续工作循环
    let hasMoreWork = true;
    try {
      // 执行主机回调（通常是 flushWork 函数）
      // 返回是否还有更多工作需要处理
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        // 如果还有更多工作，在前一个消息事件结束时调度下一个消息事件
        // 这确保了连续的时间切片执行
        schedulePerformWorkUntilDeadline();
      } else {
        // 没有更多工作，停止消息循环
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    // 没有待执行的回调，停止消息循环
    isMessageLoopRunning = false;
  }
  
  // 让出控制权给浏览器，给它一个机会进行绘制
  // 所以我们可以重置这个标志
  needsPaint = false;
};

/**
 * 调度工作直到截止时间的函数
 * 根据环境选择最佳的异步调度方式
 */
let schedulePerformWorkUntilDeadline;

if (typeof localSetImmediate === 'function') {
  /**
   * 方案1：使用 setImmediate（Node.js 和旧版 IE）
   * 
   * 优先使用 setImmediate 的原因：
   * 1. 与 MessageChannel 不同，它不会阻止 Node.js 进程退出
   *    （即使在 DOM 分支的 Scheduler 中，也可能遇到 Node.js 15+ 和 jsdom 的混合环境）
   * 2. 执行时间更早，这是我们想要的语义
   * 3. 如果其他浏览器实现它，最好使用它
   * 
   * 注意：这些方案都不如原生调度好
   */
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  /**
   * 方案2：使用 MessageChannel（DOM 和 Worker 环境）
   * 
   * MessageChannel 工作原理：
   * 1. 创建一个 MessageChannel，它有两个端口（port1 和 port2）
   * 2. 在 port1 上监听消息事件，当收到消息时执行 performWorkUntilDeadline
   * 3. 通过 port2 发送消息来触发 port1 的消息事件
   * 4. 这样就实现了异步执行，避免了 setTimeout 的 4ms 限制
   * 
   * 为什么选择 MessageChannel：
   * - 避免了 setTimeout 的 4ms 最小延迟限制
   * - 提供了真正的异步执行，不会阻塞主线程
   * - 在现代浏览器中性能更好
   */
  const channel = new MessageChannel();
  const port = channel.port2;  // 用于发送消息的端口
  
  // 在 port1 上监听消息，收到消息时执行工作函数
  channel.port1.onmessage = performWorkUntilDeadline; // 异步执行
  
  // 调度函数：通过发送消息来触发异步执行
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);  // 发送空消息触发 port1 的 onmessage 事件
  };
} else {
  /**
   * 方案3：降级到 setTimeout（非浏览器环境）
   * 
   * 这应该只在非浏览器环境中作为降级方案使用
   * setTimeout 有 4ms 的最小延迟限制，性能不如前两种方案
   */
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

// 请求主机回调
/**
 * 调度主机回调
 * 将回调函数添加到调度队列中
 * 
 * @param {Function} callback - 要执行的回调函数
 */
function requestHostCallback(callback) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

function cancelHostTimeout() {
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

const unstable_requestPaint = requestPaint;

export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
  unstable_runWithPriority,
  unstable_next,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  shouldYieldToHost as unstable_shouldYield,
  unstable_requestPaint,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
  forceFrameRate as unstable_forceFrameRate,
};

export const unstable_Profiling = enableProfiling
  ? {
      startLoggingProfilingEvents,
      stopLoggingProfilingEvents,
    }
  : null;
