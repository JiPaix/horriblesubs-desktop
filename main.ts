import { app, BrowserWindow, ipcMain, session } from 'electron'
import server from './server'
import * as path from 'path'
import * as pug from 'pug'
import * as fs from 'fs'
import * as rp from 'request-promise-native'
import { ElectronBlocker } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch';

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
            width: 400,
            height: 400,
            show: false,
            backgroundColor: '#343a40',
        })
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


    ipcMain.on('MAL', function (event, arg) {
        console.log(arg)
        MAL.loadURL(arg)
    })


    ipcMain.on('data-search', async function (event, arg) {
        MAL.loadURL(`file://${__dirname}/views/loading.html`).then(() => {
            MAL.show()
        })
        try {
            let json = await rp(arg.url)
            json = JSON.parse(json)
            json = json.categories.filter((cat: { type: string }) => cat.type === 'anime')[0].items
            const search = pug.renderFile(`${__dirname}/views/search.pug`, {
                items: json
            })
            fs.writeFileSync(`${__dirname}/views/search.html`, search)
            MAL.loadURL(`file://${__dirname}/views/search.html`)
        } catch (e) {
            MAL.hide()
        }
    })


} catch (e) {
    console.log(e)
}
