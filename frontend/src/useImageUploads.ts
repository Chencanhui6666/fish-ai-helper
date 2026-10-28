import { useEffect, useRef, useState } from 'react'
import { uploadImage } from './api/images'
import type { UploadedImage } from './api/images'

export const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
type Attachment = {
  id: string
  file: File
  url: string
  status: 'uploading' | 'ready' | 'error'
  uploaded?: UploadedImage
  error?: string
}

export function useImageUploads() {
  const [images, setImages] = useState<Attachment[]>([])
  const imagesRef = useRef<Attachment[]>([])
  const controllers = useRef(new Map<string, AbortController>())

  function publish(next: Attachment[]) {
    imagesRef.current = next
    setImages(next)
  }

  async function start(image: Attachment) {
    if (controllers.current.has(image.id)) return
    const controller = new AbortController()
    controllers.current.set(image.id, controller)
    publish(imagesRef.current.map(item => item.id === image.id ? { ...item, status: 'uploading', error: undefined } : item))
    const timeout = window.setTimeout(() => controller.abort(), 60_000)
    try {
      const uploaded = await uploadImage(image.file, controller.signal)
      if (controllers.current.get(image.id) !== controller) return
      publish(imagesRef.current.map(item => item.id === image.id ? { ...item, status: 'ready', uploaded } : item))
    } catch (error) {
      if (controllers.current.get(image.id) !== controller) return
      publish(imagesRef.current.map(item => item.id === image.id ? { ...item, status: 'error', error: error instanceof Error ? error.message : '图片上传失败，请重试。' } : item))
    } finally {
      window.clearTimeout(timeout)
      if (controllers.current.get(image.id) === controller) controllers.current.delete(image.id)
    }
  }

  function add(files: File[]) {
    const added: Attachment[] = []
    const errors: string[] = []
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type)) errors.push(`“${file.name}”格式不支持，请选择 JPEG、PNG 或 WebP。`)
      else if (file.size === 0) errors.push(`“${file.name}”是空文件。`)
      else if (file.size > MAX_IMAGE_BYTES) errors.push(`“${file.name}”超过 10 MB。`)
      else if (imagesRef.current.length + added.length >= MAX_IMAGES) errors.push('每条消息最多添加 3 张图片。')
      else added.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'uploading' })
    }
    publish([...imagesRef.current, ...added])
    added.forEach(image => { void start(image) })
    return [...new Set(errors)].join(' ')
  }

  function remove(id: string) {
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    const image = imagesRef.current.find(item => item.id === id)
    if (image) URL.revokeObjectURL(image.url)
    publish(imagesRef.current.filter(item => item.id !== id))
  }

  function clear() {
    imagesRef.current.forEach(image => remove(image.id))
  }

  useEffect(() => {
    const active = controllers.current
    return () => {
      active.forEach(controller => controller.abort())
      active.clear()
      imagesRef.current.forEach(image => URL.revokeObjectURL(image.url))
      imagesRef.current = []
    }
  }, [])

  return { images, add, remove, clear, retry: (id: string) => {
    const image = imagesRef.current.find(item => item.id === id)
    if (image?.status === 'error') void start(image)
  } }
}
