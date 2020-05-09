import * as cheerio from 'cheerio'
import * as needle from 'needle'
import { Shows } from './interfaces'
import * as event from 'eventemitter3'
needle.defaults({
	open_timeout: 10000,
	user_agent:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
	follow_max: 5,
	compressed: true,
})
export default class fetcher extends event {
	public homePage: string
	public API: string
	public homeFetch: string[]
	public shows: Array<Shows>
	public API_NEXTPAGE: string
	public API_MAX: 2
	constructor() {
		super()
		this.homePage = 'https://horriblesubs.info'
		this.API = 'https://horriblesubs.info/api.php'
		this.API_NEXTPAGE = '&nextid='
		this.API_MAX = 2
		this.homeFetch = []
		this.shows = []
	}
	autoFetch(ms: number) {
		setInterval(() => {
			this.fetchIndex()
		}, ms)
	}
	async fetchIndex() {
		const apiMethod: string = '?method=getlatest'
		let currentJob: string[] = []
		for (let i = -1; i < this.API_MAX + 1; i++) {
			try {
				let html: any
				if (i === -1) {
					html = await needle('get', this.API + apiMethod)
				} else {
					html = await needle(
						'get',
						this.API + apiMethod + this.API_NEXTPAGE + i
					)
				}
				const $ = cheerio.load(html.body)
				$('a').each((_i, el) => {
					const currentLink = $(el).attr('href')
					if (typeof currentLink !== 'undefined') {
						if (!this.homeFetch.includes(currentLink)) {
							currentJob.unshift(currentLink)
						}
					}
				})
			} catch (e) {
				throw e
			}
		}
		if (currentJob.length) {
			for (let [index, job] of currentJob.entries()) {
				try {
					const res = await this.fetchShow(this.homePage + job)
					if (typeof res !== 'undefined') {
						const link = await this.getShow(res.id)
						if (typeof link !== 'undefined') {
							const xdcc = await this.xdccList(link)
							if (typeof xdcc !== 'undefined') {
								let tmp = job.match(/(#\d*$)/g)
								if (tmp !== null) {
									let ep: string | number = tmp[0]
										.replace('#', '')
										.replace('-', '.')
									ep = parseFloat(ep)
									this.shows.push({
										id: res.id,
										name: res.name,
										ep: ep,
										showLink: job
											.replace(/#\d*(-\d*)*$/, '')
											.replace(/\/?shows\//g, ''),
										img: res.img,
										desc: res.desc,
										quality: xdcc,
										date: new Date(),
									})
								}
							}
						}
					}
				} catch (e) {
					throw e
				}
			}
		}
		this.homeFetch = this.homeFetch.concat(currentJob)
	}

	async xdccList(url: string) {
		url = url.replace('?search=', 'search.php?t=')
		let file = url.replace(
			'https://xdcc.horriblesubs.info/search.php?t=',
			''
		)
		try {
			let html = await needle('get', url)
			let parsed: string = html.body.replace(/(p\.k\[\d+\]\s\=\s)/gi, '')
			parsed = parsed.replace(/(;[^;$])/gi, ',')
			parsed = parsed.replace(/.$/gi, ']')
			parsed = `[${parsed}`
			const evaluated: Array<{
				f: string
				b: string
				n: number
				s: number
			}> = eval(parsed)
			if (
				typeof evaluated === 'object' &&
				typeof evaluated !== 'undefined'
			) {
				let res = evaluated.filter(bots => bots.f.includes(file)).map(({b, n}) => ({bot: b, pack: n}))
				res = res.sort((item1, item2) => {
					if (
						typeof item1 !== 'undefined' &&
						typeof item2 !== 'undefined'
					) {
						if (
							item1.bot.includes('NEW') &&
							item2.bot.includes('Sensei')
						) {
							return -1
						}
						if (
							item1.bot.includes('Sensei') &&
							item2.bot.includes('ARCHIVE')
						) {
							return -1
						}
						if (
							item1.bot.includes('NEW') &&
							item2.bot.includes('ARCHIVE')
						) {
							return -1
						}
						if (
							item1.bot.includes('HOLLAND') &&
							!item2.bot.includes('HOLLAND')
						) {
							return -1
						}
					}
					return 1
				})

				if(typeof res !== 'undefined') {
					res = res.filter((el) => typeof el !== 'undefined')
					let tmp = parsed.match(/(\[\d+p\])/g)
					if(tmp !== null) {
						const resolution = tmp[0].replace(/\[/g, '').replace(/\]/g, '')
						return {
							resolution: resolution,
							bots: res,
						}
					} else {
						throw Error(`couldn't find a match`)
					}
				} else {
					throw Error(`couldn't sort`)
				}

			} else {
				throw EvalError(`couldn't eval: '${html}' from : ${url}`)
			}
		} catch (e) {
			throw e
		}
	}
	async fetchShow(url: string) {
		url = url.replace(/#\d*(-\d*)*$/, '')
		try {
			const html = await needle('get', url)
			if (html.body.length === 0) {
				throw Error(`fetchShow: can't parse HTML`)
			}
			const $ = cheerio.load(html.body)
			let filter = $('script')
				.filter((_index, elem) => {
					return $(elem)
						.html()!
						.includes('var hs_showid')
				})
				.html()
			if (filter !== null) {
				const id = parseInt(filter.replace(/\D/g, ''))
				if (typeof id !== 'number') {
					throw Error(`fetchShow: couldn't get id`)
				}
				let findImg = $('.series-image > img').attr('src')
				if (typeof findImg !== 'undefined') {
					let img = findImg.replace(this.homePage, '')
					img = this.homePage + img
					return {
						id: id,
						name: $('h1.entry-title').text(),
						img: img,
						desc: $('.series-desc > p').text(),
					}
				}
			} else {
				throw Error(`error at fetchShow(): couldn't get 'id'`)
			}
		} catch (e) {
			console.log(`error when going ${url}`)
			console.error(e)
		}
	}
	async getShow(id: number) {
		const apiMethod: string = '?method=getshows&type=show&showid='
		try {
			const html = await needle('get', this.API + apiMethod + id)
			const $ = cheerio.load(html.body)
			const show = $('.rls-links-container')
				.first()
				.children('.rls-link')
				.children('.hs-xdcc-link')
				.children('a')
				.last()
				.prev('a')
				.attr('href')
			if (typeof show !== 'undefined') {
				return show
			} else {
				throw Error(`getShow() couldn't get 'show'`)
			}
		} catch (e) {}
	}
	async getAllshows() {
		try {
			const res = await needle('get', this.homePage + '/shows/')
			const $ = cheerio.load(res.body)
			const results: Array<{ name: string; url: string }> = []
			$('.ind-show').each((_i, el) => {
				const uri = $(el)
					.children('a')
					.attr('href')
				const name = $(el)
					.children('a')
					.text()
				if (typeof uri !== 'undefined' && name.length && uri.length) {
					results.push({
						name: name,
						url: uri,
					})
				}
			})
			return results
		} catch (e) {}
		throw Error('uncatched error at getAllshows()')
	}
}
