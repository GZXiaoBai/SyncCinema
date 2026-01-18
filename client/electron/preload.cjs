const { contextBridge, ipcRenderer } = require('electron')
const os = require('os')

// 获取本机所有 IPv4 地址
function getLocalIPs() {
    const interfaces = os.networkInterfaces()
    const ips = []

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 只获取 IPv4 地址，排除内部地址
            if (iface.family === 'IPv4' && !iface.internal) {
                // 优先显示以太网和 WiFi
                if (name.toLowerCase().includes('en') ||
                    name.toLowerCase().includes('eth') ||
                    name.toLowerCase().includes('wi-fi') ||
                    name.toLowerCase().includes('wlan')) {
                    ips.unshift(iface.address)
                } else {
                    ips.push(iface.address)
                }
            }
        }
    }

    // 检测 Tailscale 网络 (100.x.x.x)
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && iface.address.startsWith('100.')) {
                if (!ips.includes(iface.address)) {
                    ips.push(iface.address + ' (Tailscale)')
                }
            }
        }
    }

    // 检测 ZeroTier 网络 (通常是 10.x.x.x 或自定义范围)
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('zt')) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4') {
                    if (!ips.includes(iface.address)) {
                        ips.push(iface.address + ' (ZeroTier)')
                    }
                }
            }
        }
    }

    return ips.length > 0 ? ips : ['localhost']
}

contextBridge.exposeInMainWorld('electronAPI', {
    selectVideo: () => ipcRenderer.invoke('select-video'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getLocalIPs: () => Promise.resolve(getLocalIPs()),
    platform: process.platform
})
