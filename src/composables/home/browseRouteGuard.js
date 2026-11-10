export function handleBrowseRouteLeave(to, browse) {
  // 不同系列复用 Home 实例；切系列只保存位置，真正离开列表才停止监听。
  if (['Home', 'Desktop', 'Mobile', 'Avatar', 'Bing', 'Video'].includes(to.name))
    browse.savePosition()
  else
    browse.leave()
}
