import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, X, ChevronDown } from 'lucide-react'

interface Message {
    id: string
    userId: string
    username: string
    content: string
    timestamp: string | Date
    isHost: boolean
}

interface ChatBoxProps {
    messages: Message[]
    onSendMessage: (content: string) => void
    username: string
    isHost: boolean
}

export default function ChatBox({ messages, onSendMessage, username }: ChatBoxProps) {
    const [isOpen, setIsOpen] = useState(true)
    const [inputValue, setInputValue] = useState('')
    const [isMinimized, setIsMinimized] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // 自动滚动到最新消息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim())
            setInputValue('')
            inputRef.current?.focus()
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatTime = (date: string | Date) => {
        return new Date(date).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 rounded-full gradient-primary shadow-lg hover:scale-105 transition-transform z-50"
            >
                <MessageCircle className="w-6 h-6 text-white" />
                {messages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                        {messages.length > 99 ? '99+' : messages.length}
                    </span>
                )}
            </button>
        )
    }

    return (
        <div
            className={`fixed bottom-6 right-6 w-80 glass rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ${isMinimized ? 'h-14' : 'h-96'
                }`}
        >
            {/* 头部 */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-[var(--primary)]" />
                    <span className="font-medium">聊天室</span>
                    <span className="text-xs text-[var(--text-secondary)]">({messages.length})</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsMinimized(!isMinimized)
                        }}
                        className="p-1 hover:bg-[var(--surface-hover)] rounded"
                    >
                        <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsOpen(false)
                        }}
                        className="p-1 hover:bg-[var(--surface-hover)] rounded"
                    >
                        <X className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* 消息列表 */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                                <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
                                <p>还没有消息</p>
                                <p className="text-xs">发送第一条消息开始聊天吧</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'}`}
                                >
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className={`text-xs ${msg.isHost ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]'}`}>
                                            {msg.username}
                                            {msg.isHost && <span className="ml-1 text-[10px]">👑</span>}
                                        </span>
                                        <span className="text-xs text-[var(--text-secondary)] opacity-60">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <div
                                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${msg.username === username
                                            ? 'gradient-primary text-white rounded-br-sm'
                                            : 'bg-[var(--surface)] text-white rounded-bl-sm'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 输入框 */}
                    <div className="p-3 border-t border-[var(--border)]">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="发送消息..."
                                className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className="p-2 rounded-xl gradient-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
