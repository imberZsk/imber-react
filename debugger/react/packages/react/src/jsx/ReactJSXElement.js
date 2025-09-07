/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactSharedInternals from 'shared/ReactSharedInternals';
import hasOwnProperty from 'shared/hasOwnProperty';
import {REACT_ELEMENT_TYPE} from 'shared/ReactSymbols';

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

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

  debugger;

  console.log('jsx', {
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
  // DEV逻辑已移除，返回null
  return null;
}
