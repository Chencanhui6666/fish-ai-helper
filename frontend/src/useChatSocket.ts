import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageImage } from './api/images'

type Connection = 'connecting' | 'open' | 'closed'
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  images?: MessageImage[]
  createdAt: string
  status: 'streaming' | 'complete' | 'interrupted'
}

function socketUrl() {
  const configured = import.meta.env.VITE_CHAT_WS_URL
  const url = new URL(configured || '/api/ws/chat', window.location.href)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('聊天服务地址需要使用 ws 或 wss 协议。')
  return url.href
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block: unknown) => {
    if (typeof block === 'string') return block
    if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') return block.text
    return ''
  }).join('')
  return ''
}

const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

export function useChatSocket() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connection, setConnection] = useState<Connection>('connecting')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const socketRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<string | null>(null)

  const finish = useCallback((status: 'complete' | 'interrupted') => {
    const id = pendingRef.current
    pendingRef.current = null
    setIsStreaming(false)
    if (id) setMessages(current => current.map(message => message.id === id ? { ...message, status } : message))
  }, [])

  const connect = useCallback(() => {
    const previous = socketRef.current
    socketRef.current = null
    previous?.close()
    finish('interrupted')
    setError('')
    setConnection('connecting')
    let socket: WebSocket
    try {
      socket = new WebSocket(socketUrl())
    } catch {
      setConnection('closed')
      setError('无法创建聊天连接，请检查聊天服务地址。')
      return
    }
    socketRef.current = socket
    socket.onopen = () => {
      if (socketRef.current === socket) setConnection('open')
    }
    socket.onmessage = event => {
      if (socketRef.current !== socket) return
      try {
        const frame: unknown = JSON.parse(event.data)
        if (!frame || typeof frame !== 'object' || !('type' in frame)) throw new Error('Invalid event')
        const payload = 'payload' in frame && frame.payload && typeof frame.payload === 'object' ? frame.payload : {}
        if (frame.type === 'message') {
          if ('role' in payload && payload.role !== 'assistant' && payload.role !== 'ai') return
          const delta = textContent('content' in payload ? payload.content : '')
          const id = pendingRef.current
          if (id && delta) setMessages(current => current.map(message => message.id === id ? { ...message, text: message.text + delta } : message))
        } else if (frame.type === 'done') {
          finish('complete')
        } else if (frame.type === 'error') {
          setError('本次回复失败，请重试。')
          finish('interrupted')
          socket.close()
        }
      } catch {
        setError('聊天服务返回了无法识别的数据，请重新连接后重试。')
        finish('interrupted')
        socket.close()
      }
    }
    socket.onerror = () => {
      if (socketRef.current === socket) setError('聊天连接异常，请确认后端已启动，或重新连接。')
    }
    socket.onclose = () => {
      if (socketRef.current !== socket) return
      socketRef.current = null
      setConnection('closed')
      if (pendingRef.current) setError('连接已断开，本次回复未完成；已有内容已保留。')
      finish('interrupted')
    }
  }, [finish])

  useEffect(() => {
    connect()
    return () => {
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }
  }, [connect])

  function send(text: string, images: MessageImage[] = []) {
    const socket = socketRef.current
    if ((!text.trim() && images.length === 0) || pendingRef.current) return false
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('聊天尚未连接，请连接成功后发送。')
      return false
    }
    const id = crypto.randomUUID()
    // Set the ref synchronously to prevent duplicate submits in the same render.
    pendingRef.current = id
    try {
      socket.send(JSON.stringify({ message: text.trim(), ...(images.length > 0 ? { image_ids: images.map(image => image.image_id) } : {}) }))
    } catch {
      pendingRef.current = null
      setError('消息发送失败，草稿已保留，请重新连接。')
      return false
    }
    setError('')
    setIsStreaming(true)
    const createdAt = timestamp()
    setMessages(current => [...current,
      { id: crypto.randomUUID(), role: 'user', text: text.trim(), images, createdAt, status: 'complete' },
      { id, role: 'assistant', text: '', createdAt, status: 'streaming' },
    ])
    return true
  }

  function reset() {
    connect()
    setMessages([])
  }

  return { messages, connection, isStreaming, error, send, reset, reconnect: connect }
}
