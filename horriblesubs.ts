import searcher from './searcher'
import { Shows, Show } from './interfaces'
import * as low from 'lowdb'
import * as FileSync from 'lowdb/adapters/FileSync'
import * as _ from 'lodash'
import * as fs from 'fs'
import * as Path from 'path'
import * as filesize from 'filesize'

const adapter = new FileSync(Path.normalize(Path.join(__dirname, 'db.json')))

export default class horriblesubs extends searcher {
	refreshIndex: number
	keepIndex: number
	path: string
	db: low.LowdbSync<any>
	/**
	 * @param refreshIndex - Minutes between each refresh of index
	 * @param keepIndex - Month before index entries are removed from database
	 * @param path - path where files are stored
	 */
	constructor(
		refreshIndex: number = 10,
		keepIndex: number = 1,
		path: string,
		checkStartup: boolean
	) {
		super()
		this.db = low(adapter)
		this.db
			.defaults({
				shows: [],
				index: [],
				watched: [],
				follows: [],
				settings: [],
			})
			.write()
		this.path = path
		this.keepIndex = keepIndex
		this.refreshIndex = refreshIndex
		this.autoFetch(this.refreshIndex)
		if (checkStartup) {
			this.fetchIndex()
		}
		this.autoUpdateDB()
	}
	autoUpdateDB() {
		setInterval(() => {
			this.updateIndex()
		}, 5000)
	}
	updateIndex() {
		let follow: any = this.db.get('follows')
		let data: any = this.db.get('index')
		for (let i = 0; i < this.shows.length; i++) {
			const current = this.shows[i]
			const searchInDB = data
				.find({ id: current.id, ep: current.ep })
				.value()
			if (typeof searchInDB === 'undefined') {
				this.emit('addIndex', current)
				data.push(current).write()
				if (typeof follow !== 'undefined') {
					follow = follow.find({ id: current.id }).value()
					if (typeof follow !== 'undefined') {
						this.displayShow(current.showLink)
						this.emit('fav-update')
					}
				}
			} else {
				let lastMonth = new Date()
				lastMonth.setMonth(lastMonth.getMonth() - this.keepIndex)
				let dateOfShow = new Date(searchInDB.date)
				const isOld = lastMonth.getTime() > dateOfShow.getTime()
				if (isOld) {
					data.remove(current).write()
				}
			}
		}
	}
	displayIndex() {
		this.updateIndex()
		return this.db
			.get('index')
			.value()
			.sort((a: { date: string }, b: { date: string }) => {
				if (new Date(a.date) > new Date(b.date)) {
					return -1
				}
				if (new Date(a.date) < new Date(b.date)) {
					return 1
				}
			})
	}
	async displayShow(show: Show['showLink']) {
		show = '/shows/' + show
		let data: any = this.db.get('shows')
		let dbShow = data.find({ showLink: show })
		let res: Show = dbShow.value()
		if (typeof res !== 'undefined') {
			let tmp = _.maxBy(res.links, (res) => res.ep)
			if (typeof tmp !== 'undefined') {
				const lastShowInDB = tmp.ep
				let update = await this.showUpdate(show, lastShowInDB)
				if (typeof update !== 'undefined') {
					let links = dbShow.value().links
					let updated = update.links!.filter(
						(link) => link.ep > lastShowInDB
					)
					updated = _.sortBy(links.concat(updated), ['ep'])
					dbShow.assign({ links: updated }).write()
					return dbShow.value()
				} else {
					return dbShow.value()
				}
			}
		} else {
			return await this.showUpdate(show).then((getRes) => {
				if (typeof getRes !== 'undefined') {
					getRes.links = _.sortBy(getRes.links, ['ep'])
					data.push(getRes).write()
					return dbShow.value()
				} else {
					throw Error('displayShow : cant showupdate NEW SHOW')
				}
			})
		}
	}
	markAsWatched(id: number, ep: string | number): void {
		let data: any = this.db.get('watched')
		let find = data.find({ id: id })
		let res = find.value()
		if (typeof res === 'undefined') {
			data.push({
				id: id,
				ep: [ep],
			}).write()
		} else {
			if (!res.ep.includes(ep)) {
				res.ep.push(ep)
				find.assign({ ep: res.ep }).write()
			}
		}
	}
	findLastWatched(id: number): number | string {
		let data: any = this.db.get('watched')
		let find = data.find({ id: id })
		let res = find.value()
		if (typeof res === 'undefined') {
			return -999
		} else {
			return res.ep
		}
	}
	follow(showID: Show['id'], unfollow?: true) {
		let data: any = this.db.get('follows')
		if (typeof showID !== 'number') {
			showID = parseInt(showID)
		}
		if (typeof unfollow === 'boolean') {
			data.remove({ id: showID }).write()
		} else {
			data.push({ id: showID }).write()
		}
	}

	whatToWatch(displayall = false) {
		const f: any = this.db.get('follows').value()
		const shows: Show[] = []
		for (let index = 0; index < f.length; index++) {
			const el: Show = f[index]
			let s: any = this.db.get('shows')
			s = s.find({ id: el.id }).value()
			if (typeof s !== 'undefined') {
				let w: any = this.db.get('watched')
				w = w.find({ id: el.id }).value()
				const lastreleased = Math.max.apply(
					Math,
					s.links.map(function(o: { ep: any }) {
						return o.ep
					})
				)
				let lastwatched: number = 0
				if (typeof w !== 'undefined') {
					lastwatched = Math.max.apply(null, w.ep)
				}
				if (lastreleased > lastwatched) {
					s.lastwatched = lastwatched
					s.lastreleased = lastreleased
					shows.push(s)
				} else {
					if (displayall) {
						s.lastwatched = lastwatched
						s.lastreleased = lastreleased
						shows.push(s)
					}
				}
			}
		}
		if (shows.length) {
			return _.sortBy(shows, 'name')
		}
	}
	// Favorites DISPLAY
	isFav(showID: Show['id']): boolean {
		let data: any = this.db.get('follows')
		data = data.find({ id: showID }).value()
		if (typeof data === 'undefined') {
			return false
		} else {
			return true
		}
	}
	favIds(): number[] | [] {
		let data: any = this.db.get('follows').value()
		return data.map((a: { id: number }) => a.id)
	}
	favList() {
		const data: Array<{ id: number }> = this.db.get('follows').value()
		const shows: any = this.db.get('shows')
		const results: Show[] = []
		for (let i = 0; i < data.length; i++) {
			const element = data[i]
			const show: Show = shows.find({ id: element.id }).value()
			if (typeof show !== 'undefined') {
				results.push(show)
			}
		}
		if (results.length) {
			return results
		}
	}
	// files
	showFiles() {
		const res: Array<{
			filename: String
			ext: String
			sizeH: string
			size: number
		}> = []
		const files = fs.readdirSync(this.path)
		let fullsize = 0
		for (let file of files) {
			if (!file.includes('.srt') && !file.includes('.vtt') && file.includes('.mkv')) {
				const ext = Path.extname(file)
				const fileSize = fs.statSync(`${this.path}/${file}`).size
				file = file.replace(ext, '')
				fullsize += fileSize
				res.push({
					filename: file,
					ext: ext,
					sizeH: filesize(fileSize),
					size: fileSize,
				})
			}
		}
		return { total: filesize(fullsize), list: res }
	}
	findFiles(show: Show) {
		try {
			let b = fs
				.readdirSync(this.path)
				.filter((file) =>
					file
						.replace(/[^a-zA-Z ]/g, '')
						.includes(show.name.replace(/[^a-zA-Z ]/g, ''))
				)
			let c = b
				.filter((file) => !file.includes('.vtt'))
				.filter((file) => !file.includes('.srt'))
			return c
		} catch (e) {
			console.log(e.message)
		}
	}
	findFile(
		show:
			| Shows
			| { ep: string; name: string; bot: string; pack: string | number }
	) {
		console.log('looking for files')
		let b = fs
			.readdirSync(this.path)
			.filter((file) =>
				file
					.replace(/[^a-zA-Z ]/g, '')
					.includes(show.name.replace(/[^a-zA-Z ]/g, ''))
			)
		let c = b
			.filter((file) => !file.includes('.vtt'))
			.filter((file) => !file.includes('.srt'))
		let d = c.filter((file) =>
			file.includes(` ${show.ep.toString().padStart(2, '0')} `)
		)
		if (d.length) {
			return c.filter((file) =>
				file.includes(` ${show.ep.toString().padStart(2, '0')} `)
			)
		}
	}
	deleteFiles(files: string[]) {
		try {
			let directory = fs.readdirSync(this.path)
			for (let file of files) {
				if (directory.some((res) => res.includes(file))) {
					let foundFiles = directory.filter((dir) =>
						Path.basename(dir).includes(file)
					)
					for (let foundFile of foundFiles) {
						fs.unlinkSync(Path.join(this.path, foundFile))
						this.emit('file-deleted', file)
					}
				}
			}
		} catch (e) {
			console.log(e.message)
		}
	}
}
