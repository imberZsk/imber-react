/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {REACT_ELEMENT_TYPE} from 'shared/ReactSymbols';
import assign from 'shared/assign';
import hasOwnProperty from 'shared/hasOwnProperty';

import ReactCurrentOwner from './ReactCurrentOwner';

const RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

function hasValidRef(config) {
  return config.ref !== undefined;
}

function hasValidKey(config) {
  return config.key !== undefined;
}

/**
 * 创建新React元素的工厂方法。这不再遵循类模式，所以不要使用new来调用它。
 * 另外，instanceof检查也不会工作。相反，测试$$typeof字段与Symbol.for('react.element')来检查
 * 某个东西是否是React元素。
 *
 * @param {*} type
 * @param {*} props
 * @param {*} key
 * @param {string|object} ref
 * @param {*} owner
 * @param {*} self 一个*临时的*辅助工具，用于检测当调用React.createElement时
 * `this`与`owner`不同的地方，这样我们可以发出警告。我们想要摆脱owner并用箭头函数
 * 替换字符串`ref`，只要`this`和owner相同，就不会有行为变化。
 * @param {*} source 注释对象（由转译器或其他方式添加）
 * 指示文件名、行号和/或其他信息。
 * @internal
 */
const ReactElement = function(type, key, ref, self, source, owner, props) {
  const element = {
    // 这个标签允许我们唯一地识别这是一个React元素
    $$typeof: REACT_ELEMENT_TYPE,

    // 属于元素的内置属性
    type: type,
    key: key,
    ref: ref,
    props: props,

    // 记录负责创建此元素的组件。
    _owner: owner,
  };

  return element;
};

/**
 * https://github.com/reactjs/rfcs/pull/107
 * @param {*} type
 * @param {object} props
 * @param {string} key
 */
export function jsx(type, config, maybeKey) {
  let propName;

  // 提取保留名称
  const props = {};

  let key = null;
  let ref = null;

  // 目前，key可以作为prop展开。如果key也被显式声明，这会导致潜在问题
  // （即<div {...props} key="Hi" />或<div key="Hi" {...props} />）。
  // 我们想要弃用key展开，但作为中间步骤，我们将对除<div {...props} key="Hi" />
  // 之外的所有内容使用jsxDEV，因为我们目前无法判断key是否被显式声明为undefined。
  if (maybeKey !== undefined) {
    // eslint-disable-next-line react-internal/safe-string-coercion
    key = '' + maybeKey;
  }

  if (hasValidKey(config)) {
    // eslint-disable-next-line react-internal/safe-string-coercion
    key = '' + config.key;
  }

  if (hasValidRef(config)) {
    ref = config.ref;
  }

  // 剩余属性被添加到新的props对象中
  for (propName in config) {
    if (
      hasOwnProperty.call(config, propName) &&
      !RESERVED_PROPS.hasOwnProperty(propName)
    ) {
      props[propName] = config[propName];
    }
  }

  // 解析默认props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return ReactElement(
    type,
    key,
    ref,
    undefined,
    undefined,
    ReactCurrentOwner.current,
    props,
  );
}

/**
 * https://github.com/reactjs/rfcs/pull/107
 * @param {*} type
 * @param {object} props
 * @param {string} key
 */
export function jsxDEV(type, config, maybeKey, source, self) {
  let propName;

  // 提取保留名称
  const props = {};

  let key = null;
  let ref = null;

  // 目前，key可以作为prop展开。如果key也被显式声明，这会导致潜在问题
  // （即<div {...props} key="Hi" />或<div key="Hi" {...props} />）。
  // 我们想要弃用key展开，但作为中间步骤，我们将对除<div {...props} key="Hi" />
  // 之外的所有内容使用jsxDEV，因为我们目前无法判断key是否被显式声明为undefined。
  if (maybeKey !== undefined) {
    // eslint-disable-next-line react-internal/safe-string-coercion
    key = '' + maybeKey;
  }

  if (hasValidKey(config)) {
    // eslint-disable-next-line react-internal/safe-string-coercion
    key = '' + config.key;
  }

  if (hasValidRef(config)) {
    ref = config.ref;
    // warnIfStringRefCannotBeAutoConverted(config); // 已注释掉的警告函数调用
  }

  // 剩余属性被添加到新的props对象中
  for (propName in config) {
    if (
      hasOwnProperty.call(config, propName) &&
      !RESERVED_PROPS.hasOwnProperty(propName)
    ) {
      props[propName] = config[propName];
    }
  }

  // 解析默认props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props,
  );
}

/**
 * 创建并返回给定类型的新ReactElement。
 * 参见 https://reactjs.org/docs/react-api.html#createelement
 */
export function createElement(type, config, children) {
  let propName;

  // 提取保留名称
  const props = {};

  let key = null;
  let ref = null;
  let self = null;
  let source = null;

  if (config != null) {
    if (hasValidRef(config)) {
      ref = config.ref;
    }
    if (hasValidKey(config)) {
      // eslint-disable-next-line react-internal/safe-string-coercion
      key = '' + config.key;
    }

    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // 剩余属性被添加到新的props对象中
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        props[propName] = config[propName];
      }
    }
  }

  // 子元素可以有多个参数，这些参数被转移到新分配的props对象上。
  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  // 解析默认props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }

  debugger;

  console.log('createElement', {
    type,
    key,
    ref,
    self,
    source,
    props,
  });

  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props,
  );
}

/**
 * 返回一个产生给定类型ReactElements的函数。
 * 参见 https://reactjs.org/docs/react-api.html#createfactory
 */
export function createFactory(type) {
  const factory = createElement.bind(null, type);
  // 在工厂和原型上暴露类型，这样可以在元素上轻松访问。
  // 例如：`<Foo />.type === Foo`。
  // 这不应该命名为`constructor`，因为这可能不是创建元素的函数，
  // 甚至可能不是构造函数。
  // 遗留钩子：删除它
  factory.type = type;
  return factory;
}

export function cloneAndReplaceKey(oldElement, newKey) {
  const newElement = ReactElement(
    oldElement.type,
    newKey,
    oldElement.ref,
    oldElement._self,
    oldElement._source,
    oldElement._owner,
    oldElement.props,
  );

  return newElement;
}

/**
 * 使用元素作为起点克隆并返回新的ReactElement。
 * 参见 https://reactjs.org/docs/react-api.html#cloneelement
 */
export function cloneElement(element, config, children) {
  if (element === null || element === undefined) {
    throw new Error(
      `React.cloneElement(...): The argument must be a React element, but you passed ${element}.`,
    );
  }

  let propName;

  // 复制原始props
  const props = assign({}, element.props);

  // 提取保留名称
  let key = element.key;
  let ref = element.ref;
  // 由于保留了owner，所以保留Self。
  const self = element._self;
  // 保留Source，因为cloneElement不太可能被转译器针对，
  // 原始source可能是真正owner的更好指示器。
  const source = element._source;

  // Owner将被保留，除非ref被覆盖
  let owner = element._owner;

  if (config != null) {
    if (hasValidRef(config)) {
      // 静默地从父级窃取ref。
      ref = config.ref;
      owner = ReactCurrentOwner.current;
    }
    if (hasValidKey(config)) {
      // eslint-disable-next-line react-internal/safe-string-coercion
      key = '' + config.key;
    }

    // 剩余属性覆盖现有props
    let defaultProps;
    if (element.type && element.type.defaultProps) {
      defaultProps = element.type.defaultProps;
    }
    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        !RESERVED_PROPS.hasOwnProperty(propName)
      ) {
        if (config[propName] === undefined && defaultProps !== undefined) {
          // 解析默认props
          props[propName] = defaultProps[propName];
        } else {
          props[propName] = config[propName];
        }
      }
    }
  }

  // 子元素可以有多个参数，这些参数被转移到新分配的props对象上。
  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return ReactElement(element.type, key, ref, self, source, owner, props);
}

/**
 * 验证对象是否为ReactElement。
 * 参见 https://reactjs.org/docs/react-api.html#isvalidelement
 * @param {?object} object
 * @return {boolean} 如果`object`是ReactElement则返回true。
 * @final
 */
export function isValidElement(object) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}
