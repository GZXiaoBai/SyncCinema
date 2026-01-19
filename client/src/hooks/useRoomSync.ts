import { } from 'react'
import type { RefObject } from 'react'
import { useSyncVideo } from './useSyncVideo'
import { useWebRTC } from './useWebRTC'

interface ReactPlayerMethods {
    getCurrentTime: () => number
    seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => void
}

interface UseRoomSyncOptions {
    mode: 'p2p' | 'server'
    roomId: string
    isHost: boolean
    playerRef: RefObject<ReactPlayerMethods | null | any>
    videoUrl: string
    username: string
    serverAddress?: string
}

export function useRoomSync({ mode, roomId, isHost, playerRef, videoUrl, username, serverAddress }: UseRoomSyncOptions) {
    // P2P 模式
    // 注意：Hooks 必须无条件调用，我们通过条件判断只使用其中一个的返回值
    // 实际上为了性能和避免副作用，最好是分开组件，或者根据 state 有条件地挂载 Hook 内部逻辑
    // 但简单起见，且两个 Hooks 都在 useEffect 中处理逻辑，我们可以通过传递一个 dummy flag 来禁用其中一个

    // 这里我们必须创建两个 Hook 实例，但我们会通过参数控制它们是否激活
    // 由于 Hooks 内部有副作用 (socket 连接 / peer 创建)，我们需要传递一个 enabled 参数或类似机制
    // 目前我们的 Hooks 没有 enabled 参数，这会导致两个都会尝试连接

    // 最佳实践是修改 Hooks 接受 enabled 参数
    // 让我们假设我们修改了 Hooks，或者简单粗暴地：如果 mode 不匹配，传递无效参数让 Hook 内部短路 (不太好)

    // 更好的方案：直接在组件里判断，不要封装成一个 Hook，或者修改 Hooks 增加 enabled 参数
    // 鉴于时间，我将在组件内可以根据 if (mode === 'p2p') return <P2PRoom ... /> else return <ServerRoom ... />
    // 但为了复用 UI，我们可以在 useRoomSync 内部进行判断吗？
    // 不行，React Hooks 规则禁止在条件中使用 Hook

    // 方案修正：修改 useSyncVideo 和 useWebRTC，都接受一个 `enabled` 参数

    const isP2P = mode === 'p2p'

    const p2pState = useWebRTC({
        roomId: isP2P ? roomId : '', // 传递空 ID 防止连接，需由于 Hook 内部逻辑优化
        isHost,
        playerRef,
        videoUrl,
        username,
        enabled: isP2P
    })

    const serverState = useSyncVideo({
        roomId: !isP2P ? roomId : '',
        isHost,
        playerRef,
        videoUrl,
        username,
        serverAddress,
        enabled: !isP2P
    })

    const activeState = isP2P ? p2pState : serverState

    return {
        ...activeState,
        mode
    }
}
