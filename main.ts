import { app, BrowserWindow, ipcMain, session, protocol } from 'electron'
import { exec } from 'child_process'
import horriblesubs from './horriblesubs'
import * as pug from 'pug'
import { ElectronBlocker } from '@cliqz/adblocker-electron'
import fetch from 'cross-fetch'
import * as fs from 'fs'
import * as path from 'path'
import * as low from 'lowdb'
import * as FileSync from 'lowdb/adapters/FileSync'
import { MainSettings } from './interfaces'
import { Shows, Show, Params } from './interfaces'
import XDCC from 'xdccjs'
import * as ass2vtt from 'ass-to-vtt'
import * as needle from 'needle'
app.allowRendererProcessReuse = true


let db: low.LowdbSync<any> | null = low(new FileSync(path.normalize(path.join(__dirname, 'db.json'))))
db.defaults({
	shows: [],
	index: [],
	watched: [],
	follows: [],
	settings: [],
}).write()
let setup: MainSettings
let firstBoot: boolean
if (db.get('settings').value().length === 0) {
	let data: any = db!.get('settings')
	setup = {
		id: 0,
		nickname: 'hsd',
		chan: '#horriblesubs',
		randomizeNick: true,
		keepIndex: 1,
		refreshIndex: 60000 * 15,
		startupCheck: true,
		path: path.normalize(path.resolve(__dirname, '../dl')),
		pathSize: 0,
		host: 'irc.rizon.net',
		port: 6660,
		verbose: true,
	}
	data.push(setup).write()
	firstBoot = true
} else {
	let data: any = db!.get('settings')
	setup = data.find({ id: 0 }).value()
	firstBoot = false
}
if (firstBoot) {
	let data: any = db!.get('settings')
	data.find({ id: 0 })
		.assign({ startupCheck: true }) // !!!a changer en true: j'ai mis false pour eviter les requetes abusive
		.write()
	data = null
}

let data: any = db!.get('settings')
const settings = data.find({ id: 0 }).value()
data = null
db = null

class desktop extends horriblesubs {
	xdccJS: XDCC
	mkv2ttJob: string[]
	app: any
	windows!: {
		win: BrowserWindow
		winSettings: BrowserWindow
		MAL: BrowserWindow
	}
	constructor() {
		super(
			settings.refreshIndex,
			settings.keepIndex,
			settings.path,
			settings.startupCheck
		)

		this.xdccJS = new XDCC({
			host: setup.host,
			nick: setup.nickname,
			chan: setup.chan,
			path: setup.path,
			port: setup.port,
			verbose: setup.verbose || false,
			randomizeNick: setup.randomizeNick || false,
		})
		this.mkv2ttJob = []
		this.app = app
		this.start()
	}
	start() {
		app.whenReady().then(() => {
			this.registerProtocol()
			this.initSessions()
			this.windows = this.initWindows()
			this.windows.win
				.loadFile(
					path.normalize(
						path.resolve(__dirname, '../views', 'boot.html')
					)
				)
				.then(() => {
					this.windows.win.show()
				})
				.then(() => {
					this.xdccJS.on('xdcc-ready', () => {
						this.checkFirstbootAndShow()
						this.preventClose()
						this.listenIPCwindowsEvents()
						this.listenClientEvents()
						this.listenXDCCJSevents()
					})
				})
		})
	}
	listenXDCCJSevents() {
		this.xdccJS.on('downloaded', (fileInfo) => {
			this.windows.win.webContents.send('downloading', 100)
			if (path.extname(fileInfo.file) === '.mkv') {
				this.mkv2vtt(fileInfo.file, () => {
					this.mkv2ttJob = this.mkv2ttJob.filter(
						(file) => file !== fileInfo.file
					)
					this.windows.win.webContents.send('watch', fileInfo)
				})
			} else {
				this.windows.win.webContents.send('watch', fileInfo)
			}
		})
		this.xdccJS.on('downloading', (inc: number, file: any) => {
			let total = file.length
			let percentage = (inc * 100) / total
			this.windows.win.webContents.send('downloading', percentage)
		})
	}
	listenClientEvents() {
		ipcMain.on('delete-files', (_ev, files: string[]) => {
			this.deleteFiles(files)
		})
		ipcMain.on('follow', (_ev, id: number) => {
			this.follow(id)
		})
		ipcMain.on('unfollow', (_ev, id: number) => {
			this.follow(id, true)
		})
		ipcMain.on(
			'watch',
			(
				ev,
				req: {
					ep: string
					name: string
					bot: string
					pack: string | number
				}
			) => {
				const file = this.findFile(req)
				if (typeof file !== 'undefined') {
					this.windows.win.webContents.send('watch', {
						file: file[0],
					})
				} else {
					this.xdccJS.download(req.bot, req.pack)
				}
			}
		)
		ipcMain.on('watchFromIndex', (ev, req: Shows) => {
			let file = this.findFile(req)
			if (typeof file !== 'undefined') {
				this.windows.win.webContents.send('watch', {
					file: file[0],
				})
			} else {
				this.xdccJS.download(
					req.quality.bots[0].bot,
					req.quality.bots[0].pack
				)
			}
		})
		ipcMain.on(
			'watched',
			(_ev, show: { id: string; ep: string | number }) => {
				this.markAsWatched(parseInt(show.id), show.ep)
			}
		)
		ipcMain.on('download all', (ev, show: Show) => {
			this.xdccDownloadAll(show, ev)
		})
		this.on('addIndex', (todo) => {
			this.windows.win.webContents.send('addIndex', todo)
		})
		this.on('fav-update', () => {
			this.windows.win.webContents.send('fav-update')
		})
		this.on('file-deleted', (file) => {
			this.windows.win.webContents.send('deleted-file', file)
		})
		this.on('check-update', () => {
			this.windows.win.webContents.send('fav-update', this.whatToWatch())
		})
	}
	private xdccDownloadAll(show: Show, ev: Electron.IpcMainEvent) {
		let bots: Array<{ name: string; pack: number[] }> = []
		show.links!.forEach((element) => {
			let ep = element.ep
			for (let index = 0; index < element.bots.length; index++) {
				const bot = element.bots[index]
				let match = bots.filter(
					(x: { name: string }) => x.name === bot.bot
				).length
				if (match === 0) {
					bots.push({
						name: bot.bot,
						pack: [bot.pack],
					})
				} else {
					let i = bots.findIndex((x) => x.name === bot.bot)
					bots[i].pack = bots[i].pack.concat(bot.pack)
				}
			}
		})
		let theOne = bots.find((el) => el.pack.length === show.links!.length)
		if (theOne) {
			this.xdccJS.downloadBatch(theOne.name, theOne.pack.join())
		} else {
			this.windows.win.webContents.send('nobatch')
		}
	}
	private mkv2vtt(file: string, cb: () => void) {
		let filePath
		let filePathNoExt: string
		let binDir
		if (process.platform === 'win32') {
			filePath = path.win32.normalize(path.join(`${this.path}/${file}`))
			filePathNoExt = path.win32.normalize(
				path.join(`${this.path}/${path.parse(file).name}`)
			)
			binDir = path.win32.normalize(
				path.resolve(__dirname, '../bin/mkvextract.exe')
			)
		} else if (process.platform === 'linux') {
			filePath = path.normalize(path.join(`${this.path}/${file}`))
			filePathNoExt = path.normalize(
				path.join(`${this.path}/${path.parse(file).name}`)
			)
			binDir = path.normalize(
				path.resolve(__dirname, '../bin/mkvextract')
			)
		} else if (process.platform === 'darwin') {
			filePath = path.normalize(path.join(`${this.path}/${file}`))
			filePathNoExt = path.normalize(
				path.join(`${this.path}/${path.parse(file).name}`)
			)
			binDir = path.normalize(
				path.resolve(__dirname, '../bin/mkvextract-darwin')
			)
		} else {
			throw Error(`${process.platform} isn't a supported platform`)
		}
		try {
			exec(
				`${binDir} tracks "${filePath}" "2:${filePathNoExt}.ass`,
				() => {
					fs.createReadStream(`${filePathNoExt}.ass`)
						.pipe(ass2vtt())
						.pipe(fs.createWriteStream(`${filePathNoExt}.vtt`))
					cb()
				}
			)
		} catch (e) {
			throw e
		}
	}
	registerProtocol() {
		protocol.registerFileProtocol('module', (r, c) => {
			const module = r.url.replace('module://', '')
			c({ path: path.resolve(__dirname, '../', 'node_modules', module) })
		})
		protocol.registerFileProtocol('static', (r, c) => {
			const file = r.url.replace('static://', '')
			c({ path: path.resolve(__dirname, '../', 'views', 'static', file) })
		})
		protocol.registerBufferProtocol('pug', async (r, c) => {
			const page = r.url.replace('pug://', '').split('/')
			if (page[0] === 'index') {
				const content = pug.renderFile(
					path.resolve(__dirname, '../', 'views', `${page[0]}.pug`),
					{
						videoPath: String.raw`${this.path}`.replace(
							/\\/g,
							'\\\\'
						),
						shows: this.displayIndex(),
						follows: this.favIds(),
						towatch: this.whatToWatch(),
					}
				)
				c({ mimeType: 'text/html', data: Buffer.from(content) })
			} else if (page[0] === 'shows') {
				const showLink = page[1]
				const show = await this.displayShow(showLink)
				const lastwatched = this.findLastWatched(show.id)
				const towatch = this.whatToWatch()
				const follows = this.isFav(show.id)
				const content = pug.renderFile(
					path.resolve(__dirname, '../', 'views', `${page[0]}.pug`),
					{
						videoPath: String.raw`${this.path}`.replace(
							/\\/g,
							'\\\\'
						),
						show: show,
						lastwatched: lastwatched,
						towatch: towatch,
						follows: follows,
					}
				)
				c({ mimeType: 'text/html', data: Buffer.from(content) })
			} else if (page[0] === 'settings') {
				let tmp: any = this.db.get('settings')
				const settingsInDB = tmp.find({ id: 0 }).value()
				const content = pug.renderFile(
					path.resolve(__dirname, '../', 'views', `${page[0]}.pug`),
					{
						settings: settingsInDB,
					}
				)
				c({ mimeType: 'text/html', data: Buffer.from(content) })
			} else if (page[0] === 'fav') {
				const content = pug.renderFile(
					path.resolve(__dirname, '../', 'views', `${page[0]}.pug`),
					{
						towatch: this.whatToWatch(),
						shows: this.whatToWatch(true),
						hasFav: this.favList() || false,
					}
				)
				c({ mimeType: 'text/html', data: Buffer.from(content) })
			} else if (page[0] === 'files') {
				const content = pug.renderFile(
					path.resolve(__dirname, '../', 'views', `${page[0]}.pug`),
					{
						towatch: this.whatToWatch(),
						files: this.showFiles(),
						path: this.path
					}
				)
				c({ mimeType: 'text/html', data: Buffer.from(content) })
			} else if (page[0] === 'allshows') {
				this.getAllshows().then(shows => {
					c({mimeType: 'text/html', data: Buffer.from(pug.renderFile(path.resolve(__dirname, '../', 'views', `${page[0]}.pug`), {
						towatch: this.whatToWatch(),
						shows: shows
					}))})
				})
			} else if(page[0] === 'search') {
				const link = `https://myanimelist.net/search/prefix.json?type=all&keyword=${page[1]}`
				needle('get', link).then((resp)=>{
					const json = resp.body.categories.filter((cat: {type: string}) => cat.type === 'anime')[0].items
					const items = { items: json }
					c({mimeType: 'text/html', data: Buffer.from(pug.renderFile(path.resolve(__dirname, '../', 'views', `${page[0]}.pug`), {
						items: items.items
					}))})
				})
			}
		})
	}
	listenIPCwindowsEvents() {
		this.windows.win.on('close', () => {
			if(this.interval && this.fetchInterval) {
				clearInterval(this.interval)
				clearInterval(this.fetchInterval)
			}
			app.quit()
			process.exit(0)

		})
		ipcMain.on('quit', () => {
			if(this.interval && this.fetchInterval) {
				clearInterval(this.interval)
				clearInterval(this.fetchInterval)
			}
			app.quit()
			process.exit(0)
		})
		ipcMain.on('MAL-hide', () => {
			this.windows.MAL.hide()
		})
		ipcMain.on('data-search', (_ev, arg) => {
			this.windows.MAL.hide()
			this.windows.MAL.loadFile(path.resolve(__dirname, '../views', 'loading.html')).then(() => {
				this.windows.MAL.show()
			}).then(() => {
				this.windows.MAL.loadURL(`pug://search/${encodeURI(arg.keyword)}`)
			})
		})
		ipcMain.on('settings-show', (_event, arg) => {
			this.windows.winSettings
				.loadURL(`pug://settings`)
				.then(() => this.windows.winSettings.show())
			this.windows.winSettings.webContents.openDevTools()
		})
		ipcMain.on('settings-hide', () => {
			this.windows.winSettings.hide()
		})
		ipcMain.on('settings-save', (_ev, settings) => {
			settings.path = path.normalize(settings.path)
			let data: any = this.db.get('settings')
			this.path = settings.path
			this.xdccJS.path = settings.path
			this.refreshIndex = settings.refresh
			this.keepIndex = settings.keepIndex
			data.find({ id: 0 })
				.assign({
					refreshIndex: settings.refresh,
					startupCheck: settings.startupCheck,
					path: settings.path,
					pathSize: settings.pathSize,
					keepIndex: settings.keepIndex,
				})
				.write()
		})
	}
	preventClose() {
		this.windows.MAL.on('close', (event) => {
			event.preventDefault()
			this.windows.MAL.hide()
		})
		this.windows.winSettings.on('close', (event) => {
			event.preventDefault()
			this.windows.winSettings.hide()
		})
	}
	checkFirstbootAndShow() {
		if (firstBoot) {
			this.once('addIndex', () => {
				this.windows.win.loadURL('pug://index')
				setup.firstBoot = false
			})
		} else {
			this.windows.win.loadURL('pug://index')
		}
	}
	initSessions() {
		// adblocker and useragent :
		ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
			blocker.enableBlockingInSession(session.defaultSession)
		})
		session.defaultSession.webRequest.onBeforeSendHeaders(
			(details, callback) => {
				details.requestHeaders['User-Agent'] =
					'Mozilla/5.0 (Linux: Android 10; JSN-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.3987.162 Mobile Safari/537.36'
				callback({
					cancel: false,
					requestHeaders: details.requestHeaders,
				})
			}
		)
	}
	initWindows() {
		const win = new BrowserWindow({
			title: 'hs-D',
			backgroundColor: '#343a40',
			width: 800,
			height: 600,
			frame: false,
			show: false,
			resizable: true,
			webPreferences: {
				webSecurity: false,
				nodeIntegration: true,
			},
			minWidth: 680,
		})
		// Settings Window
		const winSettings = new BrowserWindow({
			title: 'Settings',
			width: 680,
			height: 700,
			show: false,
			frame: false,
			resizable: true,
			webPreferences: {
				nodeIntegration: true,
				webviewTag: true,
			},
			backgroundColor: '#343a40',
			minWidth: 680,
		})
		// MyAnimeList research Window
		const MAL = new BrowserWindow({
			title: 'MyAnimeList search',
			width: 1280,
			height: 720,
			show: false,
			frame: false,
			resizable: true,
			webPreferences: {
				nodeIntegration: true,
				webviewTag: true,
			},
			backgroundColor: '#343a40',
		})

		return { win: win, winSettings: winSettings, MAL: MAL }
	}
}

let b = new desktop()
