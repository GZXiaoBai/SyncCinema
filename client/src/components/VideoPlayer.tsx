// @ts-nocheck
import { forwardRef, useState, useRef, useEffect, useImperativeHandle } from 'react'
import ReactPlayer from 'react-player'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'

interface ReactPlayerMethods {
    getCurrentTime: () => number
    seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => void
}

interface VideoPlayerProps {
    url: string
    isHost: boolean
    isPlaying: boolean
    syncedTime: number | null
    onPlay: () => void
    onPause: () => void
    onSeek: (time: number) => void
    onProgress: (state: { playedSeconds: number }) => void
}

const VideoPlayer = forwardRef<ReactPlayerMethods, VideoPlayerProps>(({
    url,
    isHost,
    isPlaying,
    syncedTime,
    onPlay,
    onPause,
    onSeek,
    onProgress
}, ref) => {
    const playerRef = useRef<ReactPlayerMethods | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [volume, setVolume] = useState(0.8)
    const [muted, setMuted] = useState(false)
    const [played, setPlayed] = useState(0)
    const [duration, setDuration] = useState(0)
    const [seeking, setSeeking] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showControls, setShowControls] = useState(true)
    const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        seekTo: (amount: number, type?: 'seconds' | 'fraction' | 'percentage') => {
            playerRef.current?.seekTo(amount, type)
        }
    }))

    // 同步时间更新
    useEffect(() => {
        if (syncedTime !== null && !isHost && playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime()
            if (Math.abs(currentTime - syncedTime) > 2) {
                playerRef.current.seekTo(syncedTime, 'seconds')
            }
        }
    }, [syncedTime, isHost])

    // 自动隐藏控制栏
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true)
            if (hideControlsTimer.current) {
                clearTimeout(hideControlsTimer.current)
            }
            hideControlsTimer.current = setTimeout(() => {
                if (isPlaying) setShowControls(false)
            }, 3000)
        }

        const container = containerRef.current
        container?.addEventListener('mousemove', handleMouseMove)
        return () => {
            container?.removeEventListener('mousemove', handleMouseMove)
            if (hideControlsTimer.current) {
                clearTimeout(hideControlsTimer.current)
            }
        }
    }, [isPlaying])

    const handleProgress = (state: { played: number; playedSeconds: number }) => {
        if (!seeking) {
            setPlayed(state.played)
            onProgress(state)
        }
    }

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPlayed(parseFloat(e.target.value))
    }

    const handleSeekMouseDown = () => {
        setSeeking(true)
    }

    const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
        setSeeking(false)
        const target = e.target as HTMLInputElement
        const time = parseFloat(target.value) * duration
        if (playerRef.current) {
            playerRef.current.seekTo(time, 'seconds')
        }
        if (isHost) {
            onSeek(time)
        }
    }

    const handlePlayPause = () => {
        if (isHost) {
            if (isPlaying) {
                onPause()
            } else {
                onPlay()
            }
        }
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = Math.floor(seconds % 60)
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        }
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group"
        >
            <ReactPlayer
                url={url}
                width="100%"
                height="100%"
                playing={isPlaying}
                volume={volume}
                muted={muted}
                onProgress={handleProgress}
                onDuration={setDuration}
                progressInterval={100}
                ref={playerRef}
                style={{ position: 'absolute', top: 0, left: 0 }}
            />

            {/* 控制栏 */}
            <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'
                    }`}
            >
                {/* 进度条 */}
                <div className="mb-4">
                    <input
                        type="range"
                        min={0}
                        max={0.999999}
                        step="any"
                        value={played}
                        onChange={handleSeekChange}
                        onMouseDown={handleSeekMouseDown}
                        onMouseUp={handleSeekMouseUp}
                        disabled={!isHost}
                        className={`w-full h-1 rounded-full appearance-none cursor-pointer ${isHost ? 'bg-white/30' : 'bg-white/20 cursor-not-allowed'
                            }`}
                        style={{
                            background: `linear-gradient(to right, var(--primary) ${played * 100}%, rgba(255,255,255,0.3) ${played * 100}%)`
                        }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    {/* 左侧控制 */}
                    <div className="flex items-center gap-4">
                        {/* 播放/暂停 */}
                        <button
                            onClick={handlePlayPause}
                            disabled={!isHost}
                            className={`p-2 rounded-full hover:bg-white/10 ${!isHost && 'opacity-50 cursor-not-allowed'}`}
                            title={isHost ? (isPlaying ? '暂停' : '播放') : '只有主机可以控制播放'}
                        >
                            {isPlaying ? (
                                <Pause className="w-6 h-6 text-white" />
                            ) : (
                                <Play className="w-6 h-6 text-white" />
                            )}
                        </button>

                        {/* 音量控制 - 所有人都可以调节 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMuted(!muted)}
                                className="p-2 rounded-full hover:bg-white/10"
                            >
                                {muted || volume === 0 ? (
                                    <VolumeX className="w-5 h-5 text-white" />
                                ) : (
                                    <Volume2 className="w-5 h-5 text-white" />
                                )}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="w-20 h-1 rounded-full appearance-none cursor-pointer bg-white/30"
                                style={{
                                    background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%)`
                                }}
                            />
                        </div>

                        {/* 时间显示 */}
                        <span className="text-white/80 text-sm font-mono">
                            {formatTime(played * duration)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* 右侧控制 */}
                    <div className="flex items-center gap-2">
                        {/* 全屏 */}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-full hover:bg-white/10"
                        >
                            {isFullscreen ? (
                                <Minimize className="w-5 h-5 text-white" />
                            ) : (
                                <Maximize className="w-5 h-5 text-white" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 非主机提示 */}
            {!isHost && (
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/60 text-white/70 text-xs">
                    播放控制由主机管理
                </div>
            )}
        </div>
    )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
