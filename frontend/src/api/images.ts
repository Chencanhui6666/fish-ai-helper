export type UploadedImage = { image_id: string; preview_url: string }
export type MessageImage = UploadedImage & { name: string }

export async function uploadImage(file: File, signal: AbortSignal): Promise<UploadedImage> {
  const endpoint = new URL(import.meta.env.VITE_IMAGE_UPLOAD_URL || '/api/images', window.location.href)
  const body = new FormData()
  body.append('file', file)
  let response: Response
  try {
    response = await fetch(endpoint, { method: 'POST', body, signal })
  } catch {
    throw new Error(signal.aborted ? '上传已取消或超时，请重试。' : '无法连接图片服务，请检查网络或后端服务后重试。')
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 405) throw new Error('图片上传接口尚未就绪，请启动支持 POST /api/images 的后端后重试。')
    if (response.status === 413) throw new Error('图片超过服务端大小限制，请选择更小的图片。')
    if (response.status === 415) throw new Error('服务端不支持此图片格式，请选择 JPEG、PNG 或 WebP。')
    throw new Error(`图片上传失败（HTTP ${response.status}），请重试。`)
  }
  let result: unknown
  try { result = await response.json() } catch { throw new Error('上传接口未返回有效 JSON，请检查后端接口。') }
  if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'number') {
    throw new Error('上传响应缺少有效的 code，请检查后端接口。')
  }
  if (result.code !== 0) {
    const message = 'message' in result && typeof result.message === 'string' ? result.message.trim() : ''
    throw new Error(message || '图片上传失败，请重试。')
  }
  const data = 'data' in result ? result.data : undefined
  if (!data || typeof data !== 'object' || !('image_id' in data) || typeof data.image_id !== 'string' || !data.image_id.trim()
    || !('preview_url' in data) || typeof data.preview_url !== 'string' || !data.preview_url.trim()) {
    throw new Error('上传响应缺少有效的 image_id 或 preview_url，请检查后端接口。')
  }
  let preview: URL
  try { preview = new URL(data.preview_url, endpoint) } catch { throw new Error('图片预览地址无效，请检查后端接口。') }
  if (!['http:', 'https:'].includes(preview.protocol)) throw new Error('图片预览地址无效，请检查后端接口。')
  return { image_id: data.image_id, preview_url: preview.href }
}
