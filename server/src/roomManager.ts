interface Room {
    id: string
    hostId: string
    users: Set<string>
    isPlaying: boolean
    timestamp: number
    createdAt: Date
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map()
    private userToRoom: Map<string, string> = new Map()

    createRoom(roomId: string, hostId: string): Room {
        const room: Room = {
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

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId)
    }

    joinRoom(roomId: string, userId: string): boolean {
        const room = this.rooms.get(roomId)

        if (!room) return false

        room.users.add(userId)
        this.userToRoom.set(userId, roomId)

        return true
    }

    leaveRoom(roomId: string, userId: string): void {
        const room = this.rooms.get(roomId)

        if (room) {
            room.users.delete(userId)
            this.userToRoom.delete(userId)
        }
    }

    deleteRoom(roomId: string): void {
        const room = this.rooms.get(roomId)

        if (room) {
            room.users.forEach(userId => {
                this.userToRoom.delete(userId)
            })
            this.rooms.delete(roomId)
        }
    }

    updateRoomState(roomId: string, isPlaying: boolean, timestamp: number): void {
        const room = this.rooms.get(roomId)

        if (room) {
            room.isPlaying = isPlaying
            room.timestamp = timestamp
        }
    }

    getUserRoom(userId: string): string | undefined {
        return this.userToRoom.get(userId)
    }

    getRoomUserCount(roomId: string): number {
        return this.rooms.get(roomId)?.users.size || 0
    }

    getRoomCount(): number {
        return this.rooms.size
    }
}
