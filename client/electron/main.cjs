const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

// 启动内嵌的 Socket.io 服务器
const { startServer, stopServer } = require('./server.cjs')

let mainWindow = null
let serverInstance = null

function createWindow() {
    const iconPath = path.join(__dirname, '../public/icon.png')
    const fs = require('fs')
    const iconExists = fs.existsSync(iconPath)

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        title: 'SyncCinema - 同步影院',
        icon: iconExists ? iconPath : undefined,
        backgroundColor: '#0f0f23',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    })

    // 开发模式 vs 生产模式
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

    if (isDev) {
        // 开发模式：连接到 Vite 开发服务器
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        // 生产模式：加载打包后的文件
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

// 启动服务器
async function initServer() {
    try {
        serverInstance = await startServer()
        console.log('内嵌服务器已启动')
    } catch (error) {
        console.error('服务器启动失败:', error)
    }
}

app.whenReady().then(async () => {
    await initServer()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    if (serverInstance) {
        stopServer(serverInstance)
    }
})

// IPC 处理器
ipcMain.handle('select-video', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'] }
        ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0]
    }
    return null
})

ipcMain.handle('get-app-version', () => {
    return app.getVersion()
})
