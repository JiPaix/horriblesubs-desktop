import { app, BrowserWindow, ipcMain, session } from 'electron'
import server from './server'
import * as pug from 'pug'
import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch';
import * as needle from 'needle'
needle.defaults({
    open_timeout: 10000,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
    follow_max         : 5    // follow up to five redirects
})
app.allowRendererProcessReuse = true
const opts = {
    host: 'irc.rizon.net',
    nick: 'JiPaix',
    chan: '#horriblesubs',
    path: 'dl',
    port: 6660,
    verbose: true,
    randomizeNick: true,
    refreshIndex: 20,
    keepIndex: 1
}

let win: BrowserWindow
function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        title: 'horriblesubs desktop',
        backgroundColor: '#343a40',
        width: 800,
        height: 600,
        frame: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true
        }
    })
    // and load the index.html of the app.
    win.loadURL('http://localhost:3000')

    // Open the DevTools.
    // win.webContents.openDevTools()
}
try {
    const serv = new server(opts)
    let MAL: BrowserWindow
    serv.on('http-ready', () => {
        console.log('wech')
        app.whenReady().then(createWindow)
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Linux: Android 10; JSN-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.3987.162 Mobile Safari/537.36';
            callback({
                cancel: false,
                requestHeaders: details.requestHeaders
            });
        });
        ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
            blocker.enableBlockingInSession(session.defaultSession);
        });
        MAL = new BrowserWindow({
            title: 'MyAnimeList search',
            width: 500,
            height: 400,
            show: false,
            frame: false,
            resizable: true,
            webPreferences: {
                nodeIntegration: true,
                webviewTag: true
            },
            backgroundColor: '#343a40',
        })
        MAL.webContents.openDevTools()

        MAL.removeMenu()
        MAL.on('close', (event) => {
            event.preventDefault()
            MAL.hide()
        })
    })

    ipcMain.on('please-quit', () => {
        app.quit()
        process.exit(0)
    })


    ipcMain.on('please-quit-MAL', function (event, arg) {
        MAL.hide()
    })


    ipcMain.on('data-search', (_event, arg) => {
        MAL.loadFile(`${__dirname}/views/loading.html`).then(() => { MAL.show()})
        needle('get', arg.url, {open_timeout: 10000}).then(json => {
                json = json.body.categories.filter((cat: { type: string }) => cat.type === 'anime')[0].items
                const items = { items: json }
                const search = pug.renderFile(`${__dirname}/views/search.pug`, items)
                MAL.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(search)}`).catch(e => console.log(e))
        }).catch(e => {
            console.log(e)
        })


    })


} catch (e) {
    console.log(e)
}
