## DONE

- revalidatePath 来验证路由，重新刷新静态页面

## 注意只定义 revalidate 有时候不合理问题

比如一个项目早期需要比较快的更新，后期基本不更新，如果一个短的时间，则会频繁判断更新浪费服务器资源

### 解决方案

请求里一个比较长的 revalidate 兜底，然后设置 revalidateTag

写一个 API 接口，接口里 revalidateTag 验证，这个入口暴露出去，方便每次手动更新
