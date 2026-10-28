import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { ArrowUp, Fish, ImagePlus, MessageCircle, Plus, Waves, X } from 'lucide-react'
import { useChatSocket } from './useChatSocket'
import { MAX_IMAGES, useImageUploads } from './useImageUploads'

const STARTERS = ['帮我看看这片水域怎么选钓位', '想钓鲫鱼，该怎么搭配饵料？', '台钓新手出发前要准备什么？']

export default function App() {
  const { messages, connection, isStreaming, error: socketError, send, reset, reconnect } = useChatSocket()
  const [text, setText] = useState('')
  const { images, add, remove, clear, retry } = useImageUploads()
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)
  const canSend = (text.trim().length > 0 || images.length > 0) && connection === 'open' && !isStreaming && images.every(image => image.status === 'ready')

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

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    setError(add(files))
    textareaRef.current?.focus()
  }

  function sendMessage() {
    if (!canSend) return
    const uploaded = images.flatMap(image => image.uploaded ? [{ ...image.uploaded, name: image.file.name }] : [])
    if (!send(text, uploaded)) return
    clear()
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
    clear()
    reset()
    setText('')
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
                  {message.images && message.images.length > 0 && <div className="message-images">
                    {message.images.map(image => <a key={image.image_id} href={image.preview_url} target="_blank" rel="noreferrer">
                      <img src={image.preview_url} alt={image.name} onLoad={() => bottomRef.current?.scrollIntoView({ block: 'end' })} />
                    </a>)}
                  </div>}
                  {(message.text || message.role === 'assistant') && <p>{message.text || (message.status === 'streaming' ? '正在思考…' : message.status === 'interrupted' ? '回复已中断' : '未收到回复内容')}</p>}
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
                    <img src={image.url} alt={`待发送：${image.file.name}`} />
                    <button type="button" className="remove-image" aria-label={`移除图片：${image.file.name}`} onClick={() => { remove(image.id); setError('') }}><X size={13} /></button>
                    <span className="attachment-name" title={image.file.name}>{image.file.name}</span>
                    <span className={`attachment-status status-${image.status}`} role="status">{image.status === 'uploading' ? '上传中…' : image.status === 'ready' ? '已上传' : '上传失败'}</span>
                    {image.status === 'error' && <button type="button" className="retry-image" onClick={() => retry(image.id)} aria-label={`重试上传：${image.file.name}`}>重试</button>}
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
              <input ref={inputRef} type="file" className="file-input" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} aria-label="选择上传图片" />
              <button className="upload-button" type="button" onClick={() => inputRef.current?.click()} disabled={images.length >= MAX_IMAGES}><ImagePlus size={18} /><span>添加图片</span></button>
              <span className="keyboard-hint">Enter 发送 · Shift + Enter 换行</span>
              <button className="send-button" type="submit" disabled={!canSend} aria-label="发送消息"><ArrowUp size={21} /></button>
            </div>
          </form>
          {(error || socketError) && <p className="error" role="alert">{error || socketError}</p>}
          {images.filter(image => image.status === 'error').map(image => <p className="error" role="alert" key={image.id}>{image.file.name}：{image.error}</p>)}
          <p className="composer-note">支持 JPEG、PNG、WebP，每张不超过 10 MB，最多 3 张；选择后即上传，上传完成后可发送。消息仅保留在当前页面，每次请求独立处理。</p>
        </div>
      </main>
      <footer className="footer"><Waves size={14} /><span>去水边，发现更多可能。</span></footer>
    </div>
  )
}
