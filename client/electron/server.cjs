const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

// 房间管理器
class RoomManager {
    constructor() {
        this.rooms = new Map()
        this.userToRoom = new Map()
    }

    createRoom(roomId, hostId) {
        const room = {
            id: roomId,
            hostId,
            users: new Set([hostId]),
            isPlaying: false,
            timestamp: 0,
            createdAt: new Date()
        }
        this.rooms.set(roomId, room)
        this.userToRoom.set(hostId, roomId)
        return room
    }

    getRoom(roomId) {
        return this.rooms.get(roomId)
    }

    joinRoom(roomId, userId) {
        const room = this.rooms.get(roomId)
        if (!room) return false
        room.users.add(userId)
        this.userToRoom.set(userId, roomId)
        return true
    }

    leaveRoom(roomId, userId) {
        const room = this.rooms.get(roomId)
        if (room) {
            room.users.delete(userId)
            this.userToRoom.delete(userId)
        }
    }

    deleteRoom(roomId) {
        const room = this.rooms.get(roomId)
        if (room) {
            room.users.forEach(userId => {
                this.userToRoom.delete(userId)
            })
            this.rooms.delete(roomId)
        }
    }

    updateRoomState(roomId, isPlaying, timestamp) {
        const room = this.rooms.get(roomId)
        if (room) {
            room.isPlaying = isPlaying
            room.timestamp = timestamp
        }
    }

    getUserRoom(userId) {
        return this.userToRoom.get(userId)
    }

    getRoomUserCount(roomId) {
        return this.rooms.get(roomId)?.users.size || 0
    }

    getRoomCount() {
        return this.rooms.size
    }
}

let httpServer = null

function startServer(port = 3001) {
    return new Promise((resolve, reject) => {
        const app = express()
        httpServer = createServer(app)

        app.use(cors({
            origin: '*',
            methods: ['GET', 'POST']
        }))

        const io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        })

        const roomManager = new RoomManager()
        const usernames = new Map()

        io.on('connection', (socket) => {
            console.log(`用户连接: ${socket.id}`)

            socket.on('create_room', ({ roomId, username }) => {
                roomManager.createRoom(roomId, socket.id)
                socket.join(roomId)
                usernames.set(socket.id, username || '主机')
                io.to(roomId).emit('room_info', { users: roomManager.getRoomUserCount(roomId) })
            })

            socket.on('join_room', ({ roomId, username }) => {
                const room = roomManager.getRoom(roomId)
                if (!room) {
                    socket.emit('error', { message: '房间不存在' })
                    return
                }

                roomManager.joinRoom(roomId, socket.id)
                socket.join(roomId)
                usernames.set(socket.id, username || '访客')

                io.to(roomId).emit('room_info', { users: roomManager.getRoomUserCount(roomId) })
                socket.to(roomId).emit('user_joined', { userId: socket.id, username: username || '访客' })
                socket.emit('sync_status', { isPlaying: room.isPlaying, timestamp: room.timestamp })
            })

            socket.on('sync_status', ({ roomId, isPlaying, timestamp }) => {
                const room = roomManager.getRoom(roomId)
                if (room && room.hostId === socket.id) {
                    roomManager.updateRoomState(roomId, isPlaying, timestamp)
                    socket.to(roomId).emit('sync_status', { isPlaying, timestamp })
                }
            })

            socket.on('sync_seek', ({ roomId, timestamp }) => {
                const room = roomManager.getRoom(roomId)
                if (room && room.hostId === socket.id) {
                    roomManager.updateRoomState(roomId, room.isPlaying, timestamp)
                    socket.to(roomId).emit('sync_seek', { timestamp })
                }
            })

            socket.on('heartbeat', ({ roomId, timestamp, isPlaying }) => {
                const room = roomManager.getRoom(roomId)
                if (room && room.hostId === socket.id) {
                    roomManager.updateRoomState(roomId, isPlaying, timestamp)
                    socket.to(roomId).emit('heartbeat', { timestamp, isPlaying })
                }
            })

            socket.on('chat_message', ({ roomId, message }) => {
                socket.to(roomId).emit('chat_message', message)
            })

            socket.on('disconnect', () => {
                const username = usernames.get(socket.id) || '用户'
                const roomId = roomManager.getUserRoom(socket.id)

                if (roomId) {
                    const room = roomManager.getRoom(roomId)
                    roomManager.leaveRoom(roomId, socket.id)

                    if (room && room.hostId === socket.id) {
                        io.to(roomId).emit('room_closed', { message: '主机已离开，房间已关闭' })
                        roomManager.deleteRoom(roomId)
                    } else {
                        io.to(roomId).emit('room_info', { users: roomManager.getRoomUserCount(roomId) })
                        io.to(roomId).emit('user_left', { userId: socket.id, username })
                    }
                }
                usernames.delete(socket.id)
            })
        })

        app.get('/health', (req, res) => {
            res.json({ status: 'ok', rooms: roomManager.getRoomCount() })
        })

        httpServer.listen(port, () => {
            console.log(`🎬 SyncCinema 内嵌服务器运行在端口 ${port}`)
            resolve(httpServer)
        })

        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`端口 ${port} 被占用，尝试 ${port + 1}`)
                resolve(startServer(port + 1))
            } else {
                reject(err)
            }
        })
    })
}

function stopServer(server) {
    if (server) {
        server.close()
    }
}

module.exports = { startServer, stopServer }
