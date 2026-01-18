import { useEffect, useState, useCallback } from 'react'
import type { RefObject } from 'react'
// import Peer from 'peerjs' // 移除 import，改用 CDN 全局变量
// import type { DataConnection } from 'peerjs' // 类型定义可以通过 npm 安装 @types/peerjs 或自己定义

// 简单的类型补充，避免 TS 报错
declare global {
    interface Window {
        Peer: any
    }
}

// 模拟 DataConnection 类型
interface DataConnection {
    peer: string
    metadata: any
    open: boolean
    send: (data: any) => void
    on: (event: string, cb: (...args: any[]) => void) => void
    close: () => void
}

interface UseWebRTCOptions {
    roomId: string
    isHost: boolean
    playerRef: RefObject<any>
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
    const [_peer, setPeer] = useState<any>(null) // 使用 any，因为我们移除了 import
    const [connections, setConnections] = useState<DataConnection[]>([])
    const [users, setUsers] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [syncedTime, setSyncedTime] = useState<number | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
    const [myPeerId, setMyPeerId] = useState<string>('')

    // 初始化 Peer
    useEffect(() => {
        if (!enabled || !roomId) return

        // 检查 window.Peer 是否存在
        if (!(window as any).Peer) {
            console.error('PeerJS 库未加载！')
            setConnectionStatus('error')
            addSystemMessage('WebRTC 库加载失败，请检查网络连接')
            return
        }

        const peerId = isHost ? `sync-cinema-${roomId}` : undefined

        console.log('正在初始化 Peer (CDN Mode), ID:', peerId)

        // 使用 window.Peer
        const PeerClass = (window as any).Peer
        const newPeer = new PeerClass(peerId, {
            debug: 2
        })

        newPeer.on('open', (id: string) => {
            console.log('Peer 打开:', id)
            setMyPeerId(id)
            setConnectionStatus(isHost ? 'connected' : 'connecting')

            if (!isHost) {
                // Client 主动连接 Host
                connectToHost(newPeer, `sync-cinema-${roomId}`)
            }
        })

        newPeer.on('connection', (conn: any) => {
            // Host 收到连接
            if (isHost) {
                handleConnection(conn)
            } else {
                conn.close()
            }
        })

        newPeer.on('error', (err: any) => {
            console.error('Peer 错误:', err)
            setConnectionStatus('error')
            addSystemMessage(`P2P 连接错误: ${err.message}`)
        })

        newPeer.on('disconnected', () => {
            console.log('Peer 断开连接')
            setConnectionStatus('disconnected')
        })

        setPeer(newPeer)

        return () => {
            newPeer.destroy()
        }
    }, [roomId, isHost, enabled])

    // Client 连接 Host
    const connectToHost = (currentPeer: any, hostId: string) => {
        console.log('正在连接 Host:', hostId)
        const conn = currentPeer.connect(hostId, {
            metadata: { username }
        })
        handleConnection(conn)
    }

    // 处理连接
    const handleConnection = (conn: DataConnection) => {
        conn.on('open', () => {
            console.log('连接建立:', conn.peer)
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

        conn.on('data', (data: any) => {
            handleData(data, conn)
        })

        conn.on('close', () => {
            console.log('连接关闭:', conn.peer)
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
    }

    // 处理接收到的数据
    const handleData = (data: Payload, fromConn: DataConnection) => {
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
                    if (playerRef.current && Math.abs(playerRef.current.getCurrentTime() - data.timestamp) > 2) {
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
    }

    // 广播消息 (Host Only)
    const broadcast = (data: Payload, excludePeerId?: string) => {
        if (!isHost) return
        connections.forEach(conn => {
            if (conn.peer !== excludePeerId) {
                conn.send(data)
            }
        })
    }

    // 添加系统消息
    const addSystemMessage = (content: string) => {
        setMessages(prev => [...prev, {
            id: `sys-${Date.now()}`,
            userId: 'system',
            username: '系统',
            content,
            timestamp: new Date().toISOString(),
            isHost: false
        }])
    }

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
        }, 5000)

        return () => clearInterval(interval)
    }, [enabled, isHost, connections, isPlaying, playerRef, videoUrl])

    // Actions
    const handlePlay = useCallback(() => {
        if (!enabled || !isHost) return
        setIsPlaying(true)
        const timestamp = playerRef.current?.getCurrentTime() || 0
        broadcast({ type: 'sync_status', isPlaying: true, timestamp })
    }, [enabled, isHost, playerRef, connections])

    const handlePause = useCallback(() => {
        if (!enabled || !isHost) return
        setIsPlaying(false)
        const timestamp = playerRef.current?.getCurrentTime() || 0
        broadcast({ type: 'sync_status', isPlaying: false, timestamp })
    }, [enabled, isHost, playerRef, connections])

    const handleSeek = useCallback((time: number) => {
        if (!enabled || !isHost) return
        broadcast({ type: 'sync_seek', timestamp: time })
    }, [enabled, isHost, connections])

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
    }, [enabled, connections, myPeerId, username, isHost])

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
