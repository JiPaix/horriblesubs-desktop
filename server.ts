import XDCC from 'xdccjs'
import horriblesubs from './horriblesubs'
import { Shows, Show, Params } from './interfaces'
import * as path from 'path'
import * as fs from 'fs'
import * as execa from 'execa'
import * as ass2vtt from 'ass-to-vtt'
import * as http from 'http'
import { Request, Response, NextFunction } from 'express';

const express = require('express')
const app = express()
const serv = http.createServer(app)
const io = require('socket.io')(serv)
app.set('view engine', 'pug');
app.use('/static', express.static(__dirname + '/views/js'));


export default class server extends horriblesubs {
    xdccJS: XDCC
    constructor(params: Params) {
        super(params.refreshIndex, params.keepIndex, params.path)
        this.xdccJS = new XDCC({
            host: params.host,
            nick: params.nick,
            chan: params.chan,
            path: params.path,
            port: params.port,
            verbose: params.verbose || false,
            randomizeNick: params.randomizeNick || false
        })
        this.xdccJS.on('xdcc-ready', () => {
            this.startServer()
        })
    }
    startServer() {
        app.use('/files', express.static(this.path));
        this.routes()
        serv.listen(3000)
        this.emit('http-ready')
        io.sockets.on('connection', (socket: { on?: any; emit: any }) => {
            this.IO(socket)
            this.xdccEvents(socket)
            this.ownEvents(socket)
        })


    }
    routes() {
        app.get('/', (_req: Request, res: Response) => {
            res.render('index', {
                shows: this.displayIndex(),
                follows: this.favIds(),
                towatch: this.whatToWatch()
            })
        })
        app.get('/fav', (_req: Request, res: Response) => {
            res.render('fav', {
                towatch: this.whatToWatch(),
                shows: this.whatToWatch(true),
                hasFav: this.favList() || false
            })
        })
        app.get('/shows', (_req: Request, res: Response) => {
            this.getAllshows().then(shows => {
                res.render('allshows', {
                    towatch: this.whatToWatch(),
                    shows: shows
                })
            })
        })
        app.get('/files', (_req: Request, res: Response) => {
            res.render('files', {
                towatch: this.whatToWatch(),
                files: this.showFiles(),
                path: this.path
            })
        })
        app.get('/shows/:id*', async (req: Request, res: Response) => {
                let show = await this.displayShow(req.params.id)
                let lastwatched = this.findLastWatched(show.id)
                let towatch = this.whatToWatch()
                let follows= this.isFav(show.id)
                res.render('shows', {
                    show: show,
                    lastwatched: lastwatched,
                    towatch: towatch,
                    follows: follows
                })
        })
    }
    IO(socket: { on?: any; emit: any }) {
        socket.on('delete-files', (files: string[]) => {
            this.deleteFiles(files)
        })
        socket.on('follow', (id: number) => {
            this.follow(id)
        })
        socket.on('unfollow', (id: number) => {
            this.follow(id, true)
        })
        socket.on('watch', (req: { ep: string; name: string; bot: string; pack: string|number }) => {
            const file = this.findFile(req)
            if (typeof file !== 'undefined') {
                socket.emit('watch', {
                    file: file[0]
                })
            } else {
                this.xdccJS.download(req.bot, req.pack)
            }
        })
        socket.on('watchFromIndex', (req: Shows) => {
            let file = this.findFile(req)
            if (typeof file !== 'undefined') {
                socket.emit('watch', {
                    file: file[0]
                })
            } else {
                this.xdccJS.download(req.quality.bots[0].bot, req.quality.bots[0].pack)
            }
        })
        socket.on('watched', (show: { id: string; ep: string | number }) => {
            this.markAsWatched(parseInt(show.id), show.ep)
        })
        socket.on('download all', (show: Show) => {
            this.xdccDownloadAll(show, socket)
        })
    }
    xdccEvents(socket: { on?: any; emit: any }) {
        this.xdccJS.on('downloaded', fileInfo => {
            socket.emit('downloading', 100)
            if (path.extname(fileInfo.file) === 'mkv') {
                this.mkv2vtt(fileInfo.file, () => {
                    socket.emit('watch', fileInfo)
                })
            } else {
                socket.emit('watch', fileInfo)
            }
        })
        this.xdccJS.on('downloading', (inc: any, file: any) => {
            let total = file.length
            let percentage = inc * 100 / total
            socket.emit('downloading', percentage)
        })
    }
    ownEvents(socket: { on?: any; emit: any }) {
        this.on('addIndex', todo => {
            socket.emit('addIndex', todo)
        })
        this.on('fav-update', () => {
            socket.emit('fav-update')
        })
        this.on('file-deleted', file => {
            socket.emit('deleted-file', file)
        })
    }
    private mkv2vtt(file: string, cb: () => void) {
        let normalizedEXT = path.normalize(`${this.path}/${file}`)
        let normalizedNoEXT = path.normalize(`${this.path}/${path.parse(file).name}`)
        if(process.platform === 'win32') {
            execa.sync('mkvextract.exe', ['tracks', `${normalizedEXT}`, `2:${normalizedNoEXT}.ass`])
        } else if(process.platform === 'linux') {
            execa.sync('mkvextract', ['tracks', `${normalizedEXT}`, `2:${normalizedNoEXT}.ass`])
        } else if(process.platform === 'darwin') {
            execa.sync('mkvextract-darwin', ['tracks', `${normalizedEXT}`, `2:${normalizedNoEXT}.ass`])
        }
        fs.createReadStream(path.normalize(`${normalizedNoEXT}.ass`))
            .pipe(ass2vtt())
            .pipe(fs.createWriteStream(path.normalize(`${normalizedNoEXT}.vtt`)))
        fs.unlinkSync(`${normalizedNoEXT}.ass`)
        cb()
    }
    private xdccDownloadAll(show: Show, socket: { emit: (arg0: string) => void }) {
        let bots: Array<{ name: string, pack: number[]}> = []
        show.links!.forEach(element => {
            let ep = element.ep
            for (let index = 0; index < element.bots.length; index++) {
                const bot = element.bots[index];
                let match = bots.filter((x: { name: string }) => x.name === bot.bot).length
                if (match === 0) {
                    bots.push({
                        name: bot.bot,
                        pack: [bot.pack]
                    })
                } else {
                    let i = bots.findIndex(x => x.name === bot.bot)
                    bots[i].pack = bots[i].pack.concat(bot.pack)
                }
            }
        })
        let theOne = bots.find(el => el.pack.length === show.links!.length)
        if (theOne) {
            this.xdccJS.downloadBatch(theOne.name, theOne.pack.join())
        } else {
            socket.emit('nobatch')
        }
    }
}