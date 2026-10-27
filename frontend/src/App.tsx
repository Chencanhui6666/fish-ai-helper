import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { ArrowUp, Fish, ImagePlus, MessageCircle, Plus, Waves, X } from 'lucide-react'
import { useChatSocket } from './useChatSocket'

type Attachment = { id: string; name: string; url: string }

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const STARTERS = ['帮我看看这片水域怎么选钓位', '想钓鲫鱼，该怎么搭配饵料？', '台钓新手出发前要准备什么？']

export default function App() {
  const { messages, connection, isStreaming, error: socketError, send, reset, reconnect } = useChatSocket()
  const [text, setText] = useState('')
  const [images, setImages] = useState<Attachment[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const urlsRef = useRef(new Set<string>())
  const composingRef = useRef(false)
  const canSend = text.trim().length > 0 && connection === 'open' && !isStreaming && images.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [text])

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const added: Attachment[] = []
    const errors: string[] = []

    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type)) {
        errors.push(`“${file.name}”不是支持的图片格式。`)
      } else if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`“${file.name}”超过 10 MB。`)
      } else if (images.length + added.length >= MAX_IMAGES) {
        errors.push('每条消息最多添加 3 张图片。')
        break
      } else {
        const url = URL.createObjectURL(file)
        urlsRef.current.add(url)
        added.push({ id: crypto.randomUUID(), name: file.name, url })
      }
    }

    setImages((current) => [...current, ...added])
    setError([...new Set(errors)].join(' '))
    textareaRef.current?.focus()
  }

  function removeImage(image: Attachment) {
    URL.revokeObjectURL(image.url)
    urlsRef.current.delete(image.url)
    setImages((current) => current.filter((item) => item.id !== image.id))
    setError('')
  }

  function sendMessage() {
    if (images.length > 0) {
      setError('当前聊天仅支持文字，请移除图片后发送。')
      return
    }
    if (!canSend || !send(text)) return
    setText('')
    setError('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composingRef.current && event.keyCode !== 229) {
      event.preventDefault()
      sendMessage()
    }
  }

  function newChat() {
    if ((messages.length > 0 || text.trim() || images.length > 0) && !window.confirm('开始新对话将清空当前消息和草稿，是否继续？')) return
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current.clear()
    reset()
    setText('')
    setImages([])
    setError('')
    textareaRef.current?.focus()
  }

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./" aria-label="钓鱼 AI 助手首页">
          <span className="brand-mark"><Fish size={23} strokeWidth={1.8} /></span>
          <span>钓鱼 AI 助手<span className="brand-caption">FISH AI HELPER</span></span>
        </a>
        <button className="new-chat" onClick={newChat}><Plus size={17} /><span>新对话</span></button>
      </header>

      <main className={`main ${messages.length ? 'has-messages' : ''}`}>
        {messages.length === 0 ? (
          <section className="welcome" aria-labelledby="welcome-title">
            <div className="welcome-icon"><Waves size={36} strokeWidth={1.5} /></div>
            <div className="eyebrow">每次出钓，从这里开始</div>
            <h1 id="welcome-title">拍下水边，<br className="mobile-break" />聊聊今天怎么钓。</h1>
            <p className="welcome-description">上传一张水域照片，或说说你的作钓计划。</p>
            <div className="starters" aria-label="试试这样问">
              {STARTERS.map((starter, index) => (
                <button className="starter" key={starter} onClick={() => { setText(starter); textareaRef.current?.focus() }}>
                  {index === 0 ? <ImagePlus size={19} /> : index === 1 ? <Fish size={19} /> : <MessageCircle size={19} />}
                  <span>{starter}</span><span className="starter-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="conversation" aria-label="聊天消息" role="log" aria-live="polite" aria-relevant="additions">
            <div className="conversation-start"><span>本次对话</span></div>
            {messages.map((message) => (
              <article className={`message message-${message.role}`} key={message.id} aria-label={message.role === 'user' ? '你发送的消息' : 'AI 助手的回复'}>
                <div className="message-meta">{message.role === 'user' ? '你' : '钓鱼 AI 助手'} <time>{message.createdAt}</time></div>
                <div className="message-bubble">
                  <p>{message.text || (message.status === 'streaming' ? '正在思考…' : message.status === 'interrupted' ? '回复已中断' : '未收到回复内容')}</p>
                  {message.role === 'assistant' && message.status === 'streaming' && <span className="reply-status">正在回复…</span>}
                  {message.status === 'interrupted' && message.text && <span className="reply-status">回复已中断</span>}
                </div>
              </article>
            ))}

            <div ref={bottomRef} />
          </section>
        )}

        <div className="composer-area">
          <div className={`demo-label connection-${connection}`} role="status">
            <span className="status-dot" />
            {connection === 'connecting' ? '正在连接聊天服务…' : connection === 'open' ? isStreaming ? 'AI 正在回复…' : '聊天已连接' : '聊天连接已断开'}
            {connection === 'closed' && <button type="button" className="reconnect-button" onClick={reconnect}>重新连接</button>}
          </div>
          <form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
            {images.length > 0 && (
              <div className="attachments" aria-label="待发送图片">
                {images.map((image) => (
                  <div className="attachment" key={image.id}>
                    <img src={image.url} alt={`待发送：${image.name}`} />
                    <button type="button" className="remove-image" aria-label={`移除图片：${image.name}`} onClick={() => removeImage(image)}><X size={13} /></button>
                    <span className="attachment-name">{image.name}</span>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              aria-label="聊天内容"
              placeholder="说说你的作钓问题…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => { composingRef.current = false }}
              rows={2}
            />
            <div className="composer-toolbar">
              <input ref={inputRef} type="file" className="file-input" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={selectImages} aria-label="选择上传图片" />
              <button className="upload-button" type="button" onClick={() => inputRef.current?.click()} disabled={images.length >= MAX_IMAGES}><ImagePlus size={18} /><span>添加图片</span></button>
              <span className="keyboard-hint">Enter 发送 · Shift + Enter 换行</span>
              <button className="send-button" type="submit" disabled={!canSend} aria-label="发送消息"><ArrowUp size={21} /></button>
            </div>
          </form>
          {(error || socketError) && <p className="error" role="alert">{error || socketError}</p>}
          {images.length > 0 && <p className="error" role="alert">当前聊天仅支持文字，图片仅供本地预览。请移除图片后发送。</p>}
          <p className="composer-note">当前支持文字聊天，消息仅保留在当前页面；每次请求独立处理。图片仅供本地预览，暂不发送至 AI。</p>
        </div>
      </main>
      <footer className="footer"><Waves size={14} /><span>去水边，发现更多可能。</span></footer>
    </div>
  )
}
