import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { RoomManager } from './roomManager'

const app = express()
const httpServer = createServer(app)

// CORS 配置
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST']
}))

// Socket.io 服务器
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST']
    }
})

// 房间管理器
const roomManager = new RoomManager()

// 用户名映射
const usernames = new Map<string, string>()

// Socket 连接处理
io.on('connection', (socket) => {
    // 创建房间
    socket.on('create_room', ({ roomId, username }: { roomId: string; username: string }) => {
        try {
            roomManager.createRoom(roomId, socket.id)
            socket.join(roomId)
            usernames.set(socket.id, username || '主机')

            // 发送房间信息
            io.to(roomId).emit('room_info', {
                users: roomManager.getRoomUserCount(roomId)
            })
        } catch (error) {
            console.error('创建房间错误:', error)
            socket.emit('error', { message: '创建房间失败' })
        }
    })

    // 加入房间
    socket.on('join_room', ({ roomId, username }: { roomId: string; username: string }) => {
        try {
            const room = roomManager.getRoom(roomId)

            if (!room) {
                socket.emit('error', { message: '房间不存在' })
                return
            }

            roomManager.joinRoom(roomId, socket.id)
            socket.join(roomId)
            usernames.set(socket.id, username || '访客')

            // 通知房间内所有人
            io.to(roomId).emit('room_info', {
                users: roomManager.getRoomUserCount(roomId)
            })

            // 通知主机和其他人有新用户加入
            socket.to(roomId).emit('user_joined', {
                userId: socket.id,
                username: username || '访客'
            })

            // 发送当前播放状态给新加入的用户
            socket.emit('sync_status', {
                isPlaying: room.isPlaying,
                timestamp: room.timestamp
            })
        } catch (error) {
            console.error('加入房间错误:', error)
            socket.emit('error', { message: '加入房间失败' })
        }
    })

    // 同步状态 (播放/暂停)
    socket.on('sync_status', ({ roomId, isPlaying, timestamp }: {
        roomId: string
        isPlaying: boolean
        timestamp: number
    }) => {
        try {
            const room = roomManager.getRoom(roomId)

            if (room && room.hostId === socket.id) {
            roomManager.updateRoomState(roomId, isPlaying, timestamp)

            // 广播给房间内除发送者外的所有人
            socket.to(roomId).emit('sync_status', { isPlaying, timestamp })
        }
        } catch (error) {
            console.error('同步状态错误:', error)
        }
    })

    // 同步进度
    socket.on('sync_seek', ({ roomId, timestamp }: {
        roomId: string
        timestamp: number
    }) => {
        try {
            const room = roomManager.getRoom(roomId)

            if (room && room.hostId === socket.id) {
            roomManager.updateRoomState(roomId, room.isPlaying, timestamp)

            socket.to(roomId).emit('sync_seek', { timestamp })
        }
        } catch (error) {
            console.error('同步进度错误:', error)
        }
    })

    // 心跳
    socket.on('heartbeat', ({ roomId, timestamp, isPlaying }: {
        roomId: string
        timestamp: number
        isPlaying: boolean
    }) => {
        try {
            const room = roomManager.getRoom(roomId)

            if (room && room.hostId === socket.id) {
                roomManager.updateRoomState(roomId, isPlaying, timestamp)

                socket.to(roomId).emit('heartbeat', { timestamp, isPlaying })
            }
        } catch (error) {
            console.error('心跳错误:', error)
        }
    })

    // 聊天消息
    socket.on('chat_message', ({ roomId, message }: {
        roomId: string
        message: {
            id: string
            userId: string
            username: string
            content: string
            timestamp: string
            isHost: boolean
        }
    }) => {
        try {
            // 广播给房间内除发送者外的所有人
            socket.to(roomId).emit('chat_message', message)
        } catch (error) {
            console.error('发送聊天消息错误:', error)
        }
    })

    // 断开连接
    socket.on('disconnect', () => {
        try {
            const username = usernames.get(socket.id) || '用户'

            const roomId = roomManager.getUserRoom(socket.id)

            if (roomId) {
                const room = roomManager.getRoom(roomId)
                roomManager.leaveRoom(roomId, socket.id)

                // 如果是主机离开，解散房间
                if (room && room.hostId === socket.id) {
                    io.to(roomId).emit('room_closed', { message: '主机已离开，房间已关闭' })
                    roomManager.deleteRoom(roomId)
                } else {
                    // 通知其他人
                    io.to(roomId).emit('room_info', {
                        users: roomManager.getRoomUserCount(roomId)
                    })

                    // 通知用户离开
                    io.to(roomId).emit('user_left', {
                        userId: socket.id,
                        username
                    })
                }
            }

            usernames.delete(socket.id)
        } catch (error) {
            console.error('断开连接错误:', error)
        }
    })
})

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', rooms: roomManager.getRoomCount() })
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
    console.log(`🎬 SyncCinema 服务器运行在端口 ${PORT}`)
})
