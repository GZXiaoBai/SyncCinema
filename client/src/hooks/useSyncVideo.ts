import { useEffect, useState, useCallback } from 'react'
import type { RefObject } from 'react'
import { io, Socket } from 'socket.io-client'

const SYNC_THRESHOLD_SECONDS = 2
const HEARTBEAT_INTERVAL_MS = 5000
const RECONNECTION_ATTEMPTS = 5
const RECONNECTION_DELAY_MS = 1000
const SOCKET_TIMEOUT_MS = 10000

interface ReactPlayerMethods {
    getCurrentTime: () => number
    seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => void
}

interface UseSyncVideoOptions {
    roomId: string
    isHost: boolean
    playerRef: RefObject<ReactPlayerMethods>
    videoUrl: string
    username: string
    serverAddress?: string // 可选的服务器地址
    enabled?: boolean // 控制 Hook 是否激活
}

interface SyncState {
    isPlaying: boolean
    timestamp: number
}

interface ChatMessage {
    id: string
    userId: string
    username: string
    content: string
    timestamp: string
    isHost: boolean
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useSyncVideo({ roomId, isHost, playerRef, videoUrl, username, serverAddress, enabled = true }: UseSyncVideoOptions) {
    const socketRef = useRef<Socket | null>(null)
    const [users, setUsers] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [syncedTime, setSyncedTime] = useState<number | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

    // 确定服务器地址
    const getServerUrl = useCallback(() => {
        if (serverAddress) {
            // 如果提供了服务器地址，使用它
            const address = serverAddress.replace(' (Tailscale)', '').replace(' (ZeroTier)', '')
            if (address.startsWith('http://') || address.startsWith('https://')) {
                return address
            }
            return `http://${address}`
        }
        // 默认使用 localhost
        return 'http://localhost:3001'
    }, [serverAddress])

    // 初始化 Socket 连接
    useEffect(() => {
        if (!enabled) return

        const serverUrl = getServerUrl()

        const newSocket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: RECONNECTION_ATTEMPTS,
            reconnectionDelay: RECONNECTION_DELAY_MS,
            timeout: SOCKET_TIMEOUT_MS
        })

        newSocket.on('connect', () => {
            setConnectionStatus('connected')

            // 加入或创建房间
            if (isHost) {
                newSocket.emit('create_room', { roomId, username })
            } else {
                newSocket.emit('join_room', { roomId, username })
            }
        })

        newSocket.on('connect_error', (error) => {
            console.error('连接错误:', error.message)
            setConnectionStatus('error')

            // 添加系统消息提示连接失败
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `连接失败: ${error.message}。请检查服务器地址是否正确。`,
                timestamp: new Date().toISOString(),
                isHost: false
            }])
        })

        newSocket.on('disconnect', () => {
            setConnectionStatus('disconnected')
        })

        // 房间信息更新
        newSocket.on('room_info', (data: { users: number }) => {
            setUsers(data.users)
        })

        // 收到状态同步
        newSocket.on('sync_status', (data: SyncState) => {
            if (!isHost) {
                setIsPlaying(data.isPlaying)
                setSyncedTime(data.timestamp)
            }
        })

        // 收到进度同步
        newSocket.on('sync_seek', (data: { timestamp: number }) => {
            if (!isHost) {
                setSyncedTime(data.timestamp)
            }
        })

        // 心跳校准
        newSocket.on('heartbeat', (data: { timestamp: number; isPlaying: boolean }) => {
            if (!isHost) {
                setIsPlaying(data.isPlaying)
                // 检查时间差，超过阈值则强制同步
                if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - data.timestamp) > SYNC_THRESHOLD_SECONDS) {
                    setSyncedTime(data.timestamp)
                }
            }
        })

        // 用户加入通知
        newSocket.on('user_joined', (data: { userId: string; username: string }) => {
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `${data.username} 加入了房间`,
                timestamp: new Date().toISOString(),
                isHost: false
            }])
        })

        // 用户离开通知
        newSocket.on('user_left', (data: { userId: string; username: string }) => {
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `${data.username} 离开了房间`,
                timestamp: new Date().toISOString(),
                isHost: false
            }])
        })

        // 收到聊天消息
        newSocket.on('chat_message', (data: ChatMessage) => {
            setMessages(prev => [...prev, data])
        })

        // 房间关闭
        newSocket.on('room_closed', (data: { message: string }) => {
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: data.message,
                timestamp: new Date().toISOString(),
                isHost: false
            }])
            setConnectionStatus('disconnected')
        })

        // 错误处理
        newSocket.on('error', (data: { message: string }) => {
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `错误: ${data.message}`,
                timestamp: new Date().toISOString(),
                isHost: false
            }])
        })

        socketRef.current = newSocket

        return () => {
            newSocket.disconnect()
        }
    }, [roomId, isHost, playerRef, username, getServerUrl, enabled])

    // Host 心跳广播
    useEffect(() => {
        if (!enabled || !isHost || !socketRef.current || !videoUrl) return

        const interval = setInterval(() => {
            if (playerRef.current) {
                socketRef.current.emit('heartbeat', {
                    roomId,
                    timestamp: playerRef.current.getCurrentTime(),
                    isPlaying
                })
            }
        }, HEARTBEAT_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [enabled, isHost, roomId, isPlaying, playerRef, videoUrl])

    // Host 播放
    const handlePlay = useCallback(() => {
        if (!enabled || !isHost || !socketRef.current) return

        setIsPlaying(true)
        const timestamp = playerRef.current?.getCurrentTime() || 0

        socketRef.current.emit('sync_status', {
            roomId,
            isPlaying: true,
            timestamp
        })
    }, [enabled, isHost, roomId, playerRef])

    // Host 暂停
    const handlePause = useCallback(() => {
        if (!enabled || !isHost || !socketRef.current) return

        setIsPlaying(false)
        const timestamp = playerRef.current?.getCurrentTime() || 0

        socketRef.current.emit('sync_status', {
            roomId,
            isPlaying: false,
            timestamp
        })
    }, [enabled, isHost, roomId, playerRef])

    // Host 进度跳转
    const handleSeek = useCallback((time: number) => {
        if (!enabled || !isHost || !socketRef.current) return

        socketRef.current.emit('sync_seek', {
            roomId,
            timestamp: time
        })
    }, [enabled, isHost, roomId])

    // 进度更新回调
    const handleProgress = useCallback((state: { playedSeconds: number }) => {
        setCurrentTime(state.playedSeconds)
    }, [])

    // 发送聊天消息
    const sendMessage = useCallback((content: string) => {
        if (!enabled || !socketRef.current) return

        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: socketRef.current.id || '',
            username,
            content,
            timestamp: new Date().toISOString(),
            isHost
        }

        // 先添加到本地
        setMessages(prev => [...prev, message])

        // 发送到服务器
        socketRef.current.emit('chat_message', {
            roomId,
            message
        })
    }, [enabled, roomId, username, isHost])

    return {
        users,
        isPlaying,
        syncedTime,
        currentTime,
        messages,
        connectionStatus,
        handlePlay,
        handlePause,
        handleSeek,
        handleProgress,
        sendMessage
    }
}
