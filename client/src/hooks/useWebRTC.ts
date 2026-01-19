import { useEffect, useState, useCallback, useRef } from 'react'
import type { RefObject } from 'react'
// import Peer from 'peerjs' // 移除 import，改用 CDN 全局变量
// import type { DataConnection } from 'peerjs' // 类型定义可以通过 npm 安装 @types/peerjs 或自己定义

const SYNC_THRESHOLD_SECONDS = 2
const HEARTBEAT_INTERVAL_MS = 5000

// 简单的类型补充，避免 TS 报错
declare global {
    interface Window {
        Peer: {
            new (id?: string, options?: { debug?: number }): {
                id: string
                on: (event: string, callback: (...args: unknown[]) => void) => void
                connect: (peerId: string, options?: { metadata?: { username?: string } }) => DataConnection
                destroy: () => void
            }
        }
    }
}

// 模拟 DataConnection 类型
interface DataConnection {
    peer: string
    metadata?: { username?: string }
    open: boolean
    send: (data: Payload) => void
    on: (event: string, cb: (...args: unknown[]) => void) => void
    close: () => void
}

interface ReactPlayerMethods {
    getCurrentTime: () => number
    seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => void
}

interface UseWebRTCOptions {
    roomId: string
    isHost: boolean
    playerRef: RefObject<ReactPlayerMethods | null | any>
    videoUrl: string
    username: string
    enabled?: boolean
}

// ... 接口定义保持不变 ...
interface SyncState {
    type: 'sync_status'
    isPlaying: boolean
    timestamp: number
}

interface SeekState {
    type: 'sync_seek'
    timestamp: number
}

interface HeartbeatState {
    type: 'heartbeat'
    timestamp: number
    isPlaying: boolean
}

interface UserJoinedState {
    type: 'user_joined'
    userId: string
    username: string
}

interface ChatMessage {
    id: string
    userId: string
    username: string
    content: string
    timestamp: string
    isHost: boolean
}

interface ChatMessagePayload {
    type: 'chat_message'
    message: ChatMessage
}

type Payload = SyncState | SeekState | HeartbeatState | UserJoinedState | ChatMessagePayload

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useWebRTC({ roomId, isHost, playerRef, videoUrl, username, enabled = true }: UseWebRTCOptions) {
    const socketRef = useRef<Window['Peer'] | null>(null)
    const [connections, setConnections] = useState<DataConnection[]>([])
    const [users, setUsers] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [syncedTime, setSyncedTime] = useState<number | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
    const [myPeerId, setMyPeerId] = useState<string>('')

    // 添加系统消息
    const addSystemMessage = useCallback((content: string) => {
        setMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            userId: 'system',
            username: '系统',
            content,
            timestamp: new Date().toISOString(),
            isHost: false
        }])
    }, [])

    // 广播消息 (Host Only)
    const broadcast = useCallback((data: Payload, excludePeerId?: string) => {
        if (!isHost) return
        connections.forEach(conn => {
            if (conn.peer !== excludePeerId) {
                conn.send(data)
            }
        })
    }, [isHost, connections])

    // 处理接收到的数据
    const handleData = useCallback((data: Payload, fromConn: DataConnection) => {
        switch (data.type) {
            case 'sync_status':
                if (!isHost) {
                    setIsPlaying(data.isPlaying)
                    setSyncedTime(data.timestamp)
                }
                break
            case 'sync_seek':
                if (!isHost) {
                    setSyncedTime(data.timestamp)
                }
                break
            case 'heartbeat':
                if (!isHost) {
                    setIsPlaying(data.isPlaying)
                    if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - data.timestamp) > SYNC_THRESHOLD_SECONDS) {
                        setSyncedTime(data.timestamp)
                    }
                }
                break
            case 'user_joined':
                addSystemMessage(`${data.username} 加入了房间`)
                break
            case 'chat_message':
                setMessages(prev => [...prev, data.message])
                // 如果是 Host 收到消息，转发给其他人
                if (isHost) {
                    broadcast(data, fromConn.peer)
                }
                break
        }
    }, [isHost, playerRef, addSystemMessage, broadcast])

    // 处理连接
    const handleConnection = useCallback((conn: DataConnection) => {
        conn.on('open', () => {
            setConnections(prev => [...prev, conn])

            if (!isHost) {
                setConnectionStatus('connected')
                addSystemMessage(`已 P2P 连接到房间`)
            } else {
                // Host 通知其他连接有新用户
                const newUsername = conn.metadata?.username || '用户'
                addSystemMessage(`${newUsername} 通过 P2P 加入了房間`)
                broadcast({
                    type: 'user_joined',
                    userId: conn.peer,
                    username: newUsername
                }, conn.peer)

                // Host 发送当前状态
                conn.send({
                    type: 'sync_status',
                    isPlaying,
                    timestamp: playerRef.current?.getCurrentTime() || 0
                })

                setUsers(prev => prev + 1)
            }
        })

        conn.on('data', (data: unknown) => {
            handleData(data as Payload, conn)
        })

        conn.on('close', () => {
            setConnections(prev => prev.filter(c => c.peer !== conn.peer))
            if (isHost) {
                setUsers(prev => Math.max(1, prev - 1))
                const disconnectedUser = conn.metadata?.username || '用户'
                addSystemMessage(`${disconnectedUser} 离开了房间`)
            } else {
                setConnectionStatus('disconnected')
                addSystemMessage('与主机的 P2P 连接已断开')
            }
        })
    }, [isHost, isPlaying, playerRef, addSystemMessage, broadcast, handleData])

    // Client 连接 Host
    const connectToHost = useCallback((currentPeer: any, hostId: string) => {
        const conn = currentPeer.connect(hostId, {
            metadata: { username }
        })
        handleConnection(conn)
    }, [username, handleConnection])

    // 初始化 Peer
    useEffect(() => {
        if (!enabled || !roomId) return

        // 检查 window.Peer 是否存在
        if (!window.Peer) {
            console.error('PeerJS 库未加载！')
            setTimeout(() => setConnectionStatus('error'), 0)
            setTimeout(() => addSystemMessage('WebRTC 库加载失败，请检查网络连接'), 0)
            return
        }

        const peerId = isHost ? `sync-cinema-${roomId}` : undefined

        // 使用 window.Peer
        const PeerConstructor = window.Peer as any
        const newPeer = new PeerConstructor(peerId, {
            debug: 2
        })

        newPeer.on('open', (id: string) => {
            setMyPeerId(id)
            setConnectionStatus(isHost ? 'connected' : 'connecting')

            if (!isHost) {
                // Client 主动连接 Host
                connectToHost(newPeer, `sync-cinema-${roomId}`)
            }
        })

        newPeer.on('connection', (conn: DataConnection) => {
            // Host 收到连接
            if (isHost) {
                handleConnection(conn)
            } else {
                conn.close()
            }
        })

        newPeer.on('error', (err: unknown) => {
            console.error('Peer 错误:', err)
            setConnectionStatus('error')
            addSystemMessage(`P2P 连接错误: ${err instanceof Error ? err.message : 'Unknown error'}`)
        })

        newPeer.on('disconnected', () => {
            setConnectionStatus('disconnected')
        })

        socketRef.current = newPeer

        return () => {
            newPeer.destroy()
        }
    }, [roomId, isHost, enabled, connectToHost, addSystemMessage, handleConnection])

    // Host 心跳
    useEffect(() => {
        if (!enabled || !isHost || connections.length === 0 || !videoUrl) return

        const interval = setInterval(() => {
            if (playerRef.current) {
                broadcast({
                    type: 'heartbeat',
                    timestamp: playerRef.current.getCurrentTime(),
                    isPlaying
                })
            }
        }, HEARTBEAT_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [enabled, isHost, connections.length, isPlaying, playerRef, videoUrl, broadcast])

    // Actions
    const handlePlay = useCallback(() => {
        if (!enabled || !isHost) return
        setIsPlaying(true)
        const timestamp = playerRef.current?.getCurrentTime() || 0
        broadcast({ type: 'sync_status', isPlaying: true, timestamp })
    }, [enabled, isHost, playerRef, broadcast])

    const handlePause = useCallback(() => {
        if (!enabled || !isHost) return
        setIsPlaying(false)
        const timestamp = playerRef.current?.getCurrentTime() || 0
        broadcast({ type: 'sync_status', isPlaying: false, timestamp })
    }, [enabled, isHost, playerRef, broadcast])

    const handleSeek = useCallback((time: number) => {
        if (!enabled || !isHost) return
        broadcast({ type: 'sync_seek', timestamp: time })
    }, [enabled, isHost, broadcast])

    const handleProgress = useCallback((state: { playedSeconds: number }) => {
        setCurrentTime(state.playedSeconds)
    }, [])

    const sendMessage = useCallback((content: string) => {
        if (!enabled) return

        // 确保 myPeerId 存在，如果不存在使用临时 ID
        const senderId = myPeerId || `temp-${Date.now()}`

        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: senderId,
            username,
            content,
            timestamp: new Date().toISOString(),
            isHost
        }

        setMessages(prev => [...prev, message])

        const payload: ChatMessagePayload = { type: 'chat_message', message }

        if (isHost) {
            broadcast(payload)
        } else {
            // Client 发送给 Host
            connections.forEach(conn => conn.send(payload))
        }
    }, [enabled, connections, myPeerId, username, isHost, broadcast])

    return {
        users,
        isPlaying,
        syncedTime,
        currentTime,
        messages: messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
        connectionStatus,
        myPeerId,
        handlePlay,
        handlePause,
        handleSeek,
        handleProgress,
        sendMessage
    }
}
