import { useEffect, useState, useCallback } from 'react'
import type { RefObject } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseSyncVideoOptions {
    roomId: string
    isHost: boolean
    playerRef: RefObject<any>
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
    timestamp: Date
    isHost: boolean
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useSyncVideo({ roomId, isHost, playerRef, videoUrl, username, serverAddress, enabled = true }: UseSyncVideoOptions) {
    const [socket, setSocket] = useState<Socket | null>(null)
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
        setConnectionStatus('connecting')

        console.log(`正在连接到服务器: ${serverUrl}`)

        const newSocket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        })

        newSocket.on('connect', () => {
            console.log('已连接到服务器:', serverUrl)
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
                timestamp: new Date(),
                isHost: false
            }])
        })

        newSocket.on('disconnect', (reason) => {
            console.log('断开连接:', reason)
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
                // 检查时间差，超过 2 秒则强制同步
                if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - data.timestamp) > 2) {
                    setSyncedTime(data.timestamp)
                }
            }
        })

        // 用户加入通知
        newSocket.on('user_joined', (data: { userId: string; username: string }) => {
            console.log('用户加入:', data.username)
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `${data.username} 加入了房间`,
                timestamp: new Date(),
                isHost: false
            }])
        })

        // 用户离开通知
        newSocket.on('user_left', (data: { userId: string; username: string }) => {
            console.log('用户离开:', data.username)
            setMessages(prev => [...prev, {
                id: `sys-${Date.now()}`,
                userId: 'system',
                username: '系统',
                content: `${data.username} 离开了房间`,
                timestamp: new Date(),
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
                timestamp: new Date(),
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
                timestamp: new Date(),
                isHost: false
            }])
        })

        setSocket(newSocket)

        return () => {
            newSocket.disconnect()
        }
    }, [roomId, isHost, playerRef, username, getServerUrl, enabled])

    // Host 心跳广播 (每 5 秒)
    useEffect(() => {
        if (!enabled || !isHost || !socket || !videoUrl) return

        const interval = setInterval(() => {
            if (playerRef.current) {
                socket.emit('heartbeat', {
                    roomId,
                    timestamp: playerRef.current.getCurrentTime(),
                    isPlaying
                })
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [enabled, isHost, socket, roomId, isPlaying, playerRef, videoUrl])

    // Host 播放
    const handlePlay = useCallback(() => {
        if (!enabled || !isHost || !socket) return

        setIsPlaying(true)
        const timestamp = playerRef.current?.getCurrentTime() || 0

        socket.emit('sync_status', {
            roomId,
            isPlaying: true,
            timestamp
        })
    }, [enabled, isHost, socket, roomId, playerRef])

    // Host 暂停
    const handlePause = useCallback(() => {
        if (!enabled || !isHost || !socket) return

        setIsPlaying(false)
        const timestamp = playerRef.current?.getCurrentTime() || 0

        socket.emit('sync_status', {
            roomId,
            isPlaying: false,
            timestamp
        })
    }, [enabled, isHost, socket, roomId, playerRef])

    // Host 进度跳转
    const handleSeek = useCallback((time: number) => {
        if (!enabled || !isHost || !socket) return

        socket.emit('sync_seek', {
            roomId,
            timestamp: time
        })
    }, [enabled, isHost, socket, roomId])

    // 进度更新回调
    const handleProgress = useCallback((state: { playedSeconds: number }) => {
        setCurrentTime(state.playedSeconds)
    }, [])

    // 发送聊天消息
    const sendMessage = useCallback((content: string) => {
        if (!enabled || !socket) return

        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: socket.id || '',
            username,
            content,
            timestamp: new Date(),
            isHost
        }

        // 先添加到本地
        setMessages(prev => [...prev, message])

        // 发送到服务器
        socket.emit('chat_message', {
            roomId,
            message
        })
    }, [enabled, socket, roomId, username, isHost])

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
