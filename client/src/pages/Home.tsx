import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Film, Globe, Wifi, Zap, Sparkles } from 'lucide-react'

// 获取本机 IP 地址的函数（在 Electron 环境中通过 IPC 获取）
declare global {
    interface Window {
        electronAPI?: {
            getLocalIPs: () => Promise<string[]>
            selectVideo: () => Promise<string | null>
            getAppVersion: () => Promise<string>
            platform: string
        }
    }
}

export default function Home() {
    const navigate = useNavigate()
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [roomIdInput, setRoomIdInput] = useState('')
    const [serverAddressInput, setServerAddressInput] = useState('')
    const [error, setError] = useState('')
    const [connectionMode, setConnectionMode] = useState<'local' | 'remote' | 'p2p'>('p2p')

    const handleCreateRoom = (mode: 'server' | 'p2p') => {
        // 生成随机 6 位房间号
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
        if (mode === 'p2p') {
            navigate(`/room/${roomId}?host=true&mode=p2p`)
        } else {
            navigate(`/room/${roomId}?host=true`)
        }
    }

    const handleJoinRoom = () => {
        if (roomIdInput.trim().length !== 6) {
            setError('请输入 6 位房间号')
            return
        }

        if (connectionMode === 'p2p') {
            navigate(`/room/${roomIdInput.toUpperCase()}?mode=p2p`)
        } else if (connectionMode === 'remote' && serverAddressInput.trim()) {
            const encodedServer = encodeURIComponent(serverAddressInput.trim())
            navigate(`/room/${roomIdInput.toUpperCase()}?server=${encodedServer}`)
        } else {
            navigate(`/room/${roomIdInput.toUpperCase()}`)
        }
    }

    return (
        <div className="min-h-screen gradient-bg flex flex-col items-center justify-center p-6">
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
            </div>

            {/* Logo 和标题 */}
            <div className="relative z-10 text-center mb-12 animate-fade-in">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Film className="w-12 h-12 text-[var(--primary)]" />
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
                        SyncCinema
                    </h1>
                </div>
                <p className="text-[var(--text-secondary)] text-lg">
                    与朋友一起同步观看视频，共享欢乐时光
                </p>
            </div>

            {/* 功能卡片 */}
            <div className="relative z-10 flex flex-col sm:flex-row gap-6 w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
                {/* 创建 P2P 房间 (推荐) */}
                <button
                    onClick={() => handleCreateRoom('p2p')}
                    className="group flex-1 glass rounded-2xl p-8 hover:scale-105 hover:border-[var(--primary)] cursor-pointer relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 bg-[var(--primary)] text-white text-xs px-2 py-1 rounded-bl-lg font-bold">推荐</div>
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center group-hover:animate-pulse-glow">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-semibold">创建房间 (P2P)</h2>
                        <p className="text-[var(--text-secondary)] text-sm text-center">
                            无需服务器，无需 VPN<br />直接连接，自动穿透
                        </p>
                    </div>
                </button>

                {/* 加入房间 */}
                <button
                    onClick={() => setShowJoinModal(true)}
                    className="group flex-1 glass rounded-2xl p-8 hover:scale-105 hover:border-[var(--primary)] cursor-pointer"
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] flex items-center justify-center border border-[var(--border)] group-hover:border-[var(--primary)]">
                            <Users className="w-8 h-8 text-[var(--primary)]" />
                        </div>
                        <h2 className="text-xl font-semibold">加入房间</h2>
                        <p className="text-[var(--text-secondary)] text-sm text-center">
                            输入房间号加入<br />支持 P2P 和服务器模式
                        </p>
                    </div>
                </button>
            </div>

            <div className="relative z-10 mt-6 animate-fade-in">
                <button
                    onClick={() => handleCreateRoom('server')}
                    className="text-sm text-[var(--text-secondary)] hover:text-white underline decoration-dotted"
                >
                    使用传统局域网/服务器模式创建
                </button>
            </div>

            {/* 特性列表 */}
            <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-6 text-[var(--text-secondary)] text-sm animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                    <span>WebRTC 直连</span>
                </div>
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                    <span>无需配置 IP</span>
                </div>
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                    <span>自动 NAT 穿透</span>
                </div>
            </div>

            {/* 加入房间弹窗 */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="glass rounded-2xl p-8 w-full max-w-md mx-4 animate-fade-in">
                        <h3 className="text-2xl font-semibold mb-6 text-center">加入房间</h3>

                        {/* 连接模式切换 */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setConnectionMode('p2p')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${connectionMode === 'p2p'
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                    : 'border-[var(--border)] text-[var(--text-secondary)]'
                                    }`}
                            >
                                <Zap className="w-4 h-4" />
                                <span>P2P</span>
                            </button>
                            <button
                                onClick={() => setConnectionMode('local')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${connectionMode === 'local'
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                    : 'border-[var(--border)] text-[var(--text-secondary)]'
                                    }`}
                            >
                                <Wifi className="w-4 h-4" />
                                <span>局域网</span>
                            </button>
                            <button
                                onClick={() => setConnectionMode('remote')}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${connectionMode === 'remote'
                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                                    : 'border-[var(--border)] text-[var(--text-secondary)]'
                                    }`}
                            >
                                <Globe className="w-4 h-4" />
                                <span>服务器</span>
                            </button>
                        </div>

                        {/* 远程模式：服务器地址输入 */}
                        {connectionMode === 'remote' && (
                            <div className="mb-4">
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    主机地址
                                </label>
                                <input
                                    type="text"
                                    value={serverAddressInput}
                                    onChange={(e) => setServerAddressInput(e.target.value)}
                                    placeholder="例如: 192.168.1.100:3001"
                                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none font-mono text-sm"
                                />
                            </div>
                        )}

                        {/* 房间号输入 */}
                        <div className="mb-4">
                            <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                {connectionMode === 'p2p' ? '连接码 (房间号)' : '房间号'}
                            </label>
                            <input
                                type="text"
                                value={roomIdInput}
                                onChange={(e) => {
                                    setRoomIdInput(e.target.value.toUpperCase())
                                    setError('')
                                }}
                                placeholder="请输入 6 位字符"
                                maxLength={6}
                                className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-center text-2xl tracking-widest font-mono placeholder:text-base placeholder:tracking-normal"
                            />
                        </div>

                        {connectionMode === 'p2p' && (
                            <p className="text-xs text-[var(--text-secondary)] mb-4 text-center">
                                P2P 模式使用 WebRTC 直连，无需 VPN 或配置 IP 即可连接
                            </p>
                        )}

                        {error && (
                            <p className="text-[var(--error)] text-sm mt-2 text-center">{error}</p>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowJoinModal(false)
                                    setRoomIdInput('')
                                    setServerAddressInput('')
                                    setError('')
                                }}
                                className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-hover)]"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleJoinRoom}
                                className="flex-1 px-4 py-3 rounded-xl gradient-primary text-white font-medium hover:opacity-90"
                            >
                                加入
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
