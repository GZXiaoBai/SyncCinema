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
    console.log(`用户连接: ${socket.id}`)

    // 创建房间
    socket.on('create_room', ({ roomId, username }: { roomId: string; username: string }) => {
        roomManager.createRoom(roomId, socket.id)
        socket.join(roomId)
        usernames.set(socket.id, username || '主机')

        console.log(`房间创建: ${roomId}, 主机: ${username}`)

        // 发送房间信息
        io.to(roomId).emit('room_info', {
            users: roomManager.getRoomUserCount(roomId)
        })
    })

    // 加入房间
    socket.on('join_room', ({ roomId, username }: { roomId: string; username: string }) => {
        const room = roomManager.getRoom(roomId)

        if (!room) {
            socket.emit('error', { message: '房间不存在' })
            return
        }

        roomManager.joinRoom(roomId, socket.id)
        socket.join(roomId)
        usernames.set(socket.id, username || '访客')

        console.log(`用户 ${username} 加入房间 ${roomId}`)

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
    })

    // 同步状态 (播放/暂停)
    socket.on('sync_status', ({ roomId, isPlaying, timestamp }: {
        roomId: string
        isPlaying: boolean
        timestamp: number
    }) => {
        const room = roomManager.getRoom(roomId)

        if (room && room.hostId === socket.id) {
            roomManager.updateRoomState(roomId, isPlaying, timestamp)

            // 广播给房间内除发送者外的所有人
            socket.to(roomId).emit('sync_status', { isPlaying, timestamp })

            console.log(`同步状态: 房间 ${roomId}, 播放: ${isPlaying}, 时间: ${timestamp.toFixed(2)}s`)
        }
    })

    // 同步进度
    socket.on('sync_seek', ({ roomId, timestamp }: {
        roomId: string
        timestamp: number
    }) => {
        const room = roomManager.getRoom(roomId)

        if (room && room.hostId === socket.id) {
            roomManager.updateRoomState(roomId, room.isPlaying, timestamp)

            socket.to(roomId).emit('sync_seek', { timestamp })

            console.log(`同步进度: 房间 ${roomId}, 跳转到 ${timestamp.toFixed(2)}s`)
        }
    })

    // 心跳
    socket.on('heartbeat', ({ roomId, timestamp, isPlaying }: {
        roomId: string
        timestamp: number
        isPlaying: boolean
    }) => {
        const room = roomManager.getRoom(roomId)

        if (room && room.hostId === socket.id) {
            roomManager.updateRoomState(roomId, isPlaying, timestamp)

            socket.to(roomId).emit('heartbeat', { timestamp, isPlaying })
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
            timestamp: Date
            isHost: boolean
        }
    }) => {
        // 广播给房间内除发送者外的所有人
        socket.to(roomId).emit('chat_message', message)

        console.log(`聊天消息: 房间 ${roomId}, ${message.username}: ${message.content}`)
    })

    // 断开连接
    socket.on('disconnect', () => {
        const username = usernames.get(socket.id) || '用户'
        console.log(`用户断开: ${username}`)

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
