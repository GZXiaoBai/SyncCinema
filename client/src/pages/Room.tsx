import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Copy, Check, Users, ArrowLeft, Upload, Zap, Wifi } from 'lucide-react'
import VideoPlayer from '../components/VideoPlayer'
import ChatBox from '../components/ChatBox'
import { useRoomSync } from '../hooks/useRoomSync'

interface ReactPlayerMethods {
    getCurrentTime: () => number
    seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => void
}

// 生成随机用户名
const generateUsername = () => {
    const adjectives = [
        '快乐的', '可爱的', '酷酷的', '神秘的', '闪亮的', '聪明的',
        '勇敢的', '温柔的', '活泼的', '安静的', '热情的', '冷静的',
        '幽默的', '严肃的', '自由的', '勤奋的', '优雅的', '俏皮的'
    ]
    const nouns = [
        '小猫', '小狗', '熊猫', '兔子', '狐狸', '企鹅',
        '老虎', '狮子', '大象', '长颈鹿', '考拉', '袋鼠',
        '海豚', '鲸鱼', '海鸥', '蝴蝶', '蜜蜂', '蚂蚁'
    ]
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const number = Math.floor(Math.random() * 100)
    return `${adj}${noun}${number}`
}

export default function Room() {
    const { roomId } = useParams<{ roomId: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const isHost = searchParams.get('host') === 'true'
    const serverAddress = searchParams.get('server') || ''
    const mode = searchParams.get('mode') === 'p2p' ? 'p2p' : 'server'

    const [videoUrl, setVideoUrl] = useState<string>('')
    const [copied, setCopied] = useState(false)
    const playerRef = useRef<ReactPlayerMethods | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const videoUrlRef = useRef<string | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 生成稳定的用户名
    const username = useMemo(() => isHost ? '主机' : generateUsername(), [isHost])

    // 统一同步 Hook
    const {
        users,
        isPlaying,
        syncedTime,
        messages,
        connectionStatus,
        handlePlay,
        handlePause,
        handleSeek,
        handleProgress,
        sendMessage
    } = useRoomSync({
        mode,
        roomId: roomId || '',
        isHost,
        playerRef,
        videoUrl,
        username,
        serverAddress
    })

    // Hook 可能返回空 connectionStatus，如果还没初始化
    const status = connectionStatus || 'connecting'

    // 清理资源
    useEffect(() => {
        return () => {
            if (videoUrlRef.current) {
                URL.revokeObjectURL(videoUrlRef.current)
                videoUrlRef.current = null
            }
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [])

    const handleCopyRoomId = async () => {
        if (roomId) {
            await navigator.clipboard.writeText(roomId)
            setCopied(true)
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            timerRef.current = setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (videoUrlRef.current) {
                URL.revokeObjectURL(videoUrlRef.current)
            }
            const url = URL.createObjectURL(file)
            videoUrlRef.current = url
            setVideoUrl(url)
        }
    }, [])

    return (
        <div className="min-h-screen gradient-bg flex flex-col">
            {/* 顶部工具栏 */}
            <header className="glass border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>返回</span>
                    </button>

                    {/* 连接模式标识 */}
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                        {mode === 'p2p' ? (
                            <Zap className="w-3 h-3 text-[var(--primary)]" />
                        ) : (
                            <Wifi className="w-3 h-3 text-[var(--secondary)]" />
                        )}
                        <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                            {mode === 'p2p' ? 'WebRTC P2P' : 'SOCKET SERVER'}
                        </span>
                    </div>

                    {/* 连接状态 */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border font-medium ${status === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                            status === 'connecting' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                                'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' :
                                status === 'connecting' ? 'bg-yellow-500 animate-ping' :
                                    'bg-red-500'
                            }`} />
                        <span>
                            {status === 'connected' ? '已连接' :
                                status === 'connecting' ? '连接中...' :
                                    status === 'error' ? '连接错误' : '已断开'}
                        </span>
                        {serverAddress && mode === 'server' && status === 'connected' && (
                            <span className="text-[10px] opacity-60 ml-1 font-mono">
                                ({serverAddress})
                            </span>
                        )}
                        {mode === 'p2p' && status === 'connected' && !isHost && (
                            <span className="text-[10px] opacity-60 ml-1 font-mono">
                                (已穿透)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* 房间号 / 连接码 */}
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--text-secondary)] text-sm">
                            {mode === 'p2p' ? '连接码:' : '房间号:'}
                        </span>
                        <button
                            onClick={handleCopyRoomId}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] font-mono text-lg"
                        >
                            {roomId}
                            {copied ? (
                                <Check className="w-4 h-4 text-[var(--success)]" />
                            ) : (
                                <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                            )}
                        </button>
                    </div>

                    {/* 在线人数 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                        <Users className="w-4 h-4 text-[var(--primary)]" />
                        <span className="text-sm">{users} 人在线</span>
                    </div>

                    {/* 角色标识 */}
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${isHost
                        ? 'gradient-primary text-white'
                        : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]'
                        }`}>
                        {isHost ? '主机' : '观众'}
                    </div>
                </div>
            </header>

            {/* 主要内容区域 */}
            <main className="flex-1 flex flex-col p-4 gap-4">
                {/* 视频播放区域 */}
                <div className="flex-1 glass rounded-2xl overflow-hidden flex items-center justify-center">
                    {videoUrl ? (
                        <VideoPlayer
                            ref={playerRef}
                            url={videoUrl}
                            isHost={isHost}
                            isPlaying={isPlaying}
                            syncedTime={syncedTime}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onSeek={handleSeek}
                            onProgress={handleProgress}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-6 p-8">
                            <div className="w-24 h-24 rounded-full bg-[var(--surface)] border-2 border-dashed border-[var(--border)] flex items-center justify-center">
                                <Upload className="w-10 h-10 text-[var(--text-secondary)]" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-semibold mb-2">选择视频文件</h3>
                                <p className="text-[var(--text-secondary)] text-sm mb-4">
                                    {isHost
                                        ? '选择要播放的视频，开始同步观看'
                                        : '请选择与主机相同的视频文件'
                                    }
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90"
                                >
                                    选择视频
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* 聊天框 */}
            <ChatBox
                messages={messages}
                onSendMessage={sendMessage}
                username={username}
                isHost={isHost}
            />
        </div>
    )
}
