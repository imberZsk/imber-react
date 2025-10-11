## Nextjs 模拟 XSS 和 CSRF

配套文章：https://juejin.cn/post/7423706686173315106

## 前端安全

- 提一嘴经验：因为公司比较注重安全问题，也设有专门的安全部门，有安全编码规范任务，然后我们部门是由我模拟过 xss&csrf 攻击，所以对这块比较熟悉。
- 定位问题：
  - 对于 xss 来说，要全局查找是否有可输入的地方和 `dangerousSetInnerHTML` 或者 v-html 或者 innerHTML。
  - 对于 csrf 来说，需要后端查看是否有`不规范的 get 请求能改变数据的操作`，这是被攻击的核心前提，应该 google 的 sitemap 为 lax，post 这类请求已经不可以自动携带 cookie。
- 解决问题：
  - 对于 xss 来说，首先可以字符过滤转义也就是不用 dangerousSetInnerHTML，当做普通变量，react 会转成字符串，为了防止 cookie 被盗问题，可以采取一些手段来降低风险，可以服务端设置 http-only 和 secure，还可以设置 csp 指定哪些代码能执行比如 `default-src:self ; script-src 'self' 'nonce-${nonce}' 'strict-dynamic';`。
  - 对于 csrf 来说，首先是不要 get 请求改变状态，可以使用 jwt token，不会自动携带 cookie，还可以检查 refer，还可以服务端设置 cookie 的 samesite 为 strict 或者指定域名
