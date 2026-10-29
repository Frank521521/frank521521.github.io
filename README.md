# 山水与岁月 · 家人入口

这个公开仓库只包含通用入口页面和私密后台的公开地址。正文、人物资料、聊天、照片、影音、用户账号配置和任何凭据均不进入此仓库。

页面通过普通顶层链接进入私密后台的登录页，不使用 iframe，不在 GitHub Pages 收集密码，不跨域读取私密资料。

私密后台部署并通过匿名访问检查后，将 `entry-config.json` 的 `backendOrigin` 设置为实际 HTTPS `onrender.com` 源地址。未配置时入口保持不可点击。

本仓库名为 `frank521521.github.io`。在 Settings → Pages 选择 Deploy from a branch，分支选择实际默认分支，目录选择 `/ (root)`。公开入口只需要根目录中的六个网页文件及 `.nojekyll`。

后台必须保持独立的私有仓库和服务端鉴权；`robots.txt` 与 `noindex` 只表达索引偏好，不承担访问保护。
