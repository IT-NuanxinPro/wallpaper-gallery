/**
 * GET /admin - 管理后台入口
 * 直接读取并返回 admin/index.html
 */

export async function onRequest(context) {
  // CF Pages 静态文件可以通过 ASSETS 访问
  // 这里直接重定向到 admin 静态文件
  return context.env.ASSETS.fetch(new Request(
    new URL('/admin/index.html', context.request.url)
  ))
}
