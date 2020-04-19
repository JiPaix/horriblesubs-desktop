import * as cheerio from "cheerio";
import * as rp from 'request-promise-native'
import { BasicShows, Shows } from './interfaces'
import * as event from 'eventemitter3'
export default class fetcher extends event {
    public homePage: string;
    public API: string
    public homeFetch: string[]
    public shows: Array<Shows>
    constructor() {
        super()
        this.homePage = 'https://horriblesubs.info'
        this.API = 'https://horriblesubs.info/api.php'
        this.homeFetch = []
        this.shows = []
    }
    autoFetch(ms: number) {
        this.fetchIndex()
        setInterval(() => {
            this.fetchIndex()
        }, ms)
    }
    async fetchIndex() {
        const apiMethod: string = '?method=getlatest'
        let currentJob: string[] = []
        const html = await rp(this.API + apiMethod)
        const $ = cheerio.load(html)
        $('a').each((i, el) => {
            const currentLink = $(el).attr('href');
            if (!this.homeFetch.includes(currentLink)) {
                currentJob.push(currentLink);
            }
        })
        if (currentJob.length > 0) {
            this.homeFetch.concat(currentJob)
            for (let job of currentJob) {
                const res = await this.fetchShow(this.homePage + job)
                const link = await this.getShow(res.id)
                const xdcc = await this.xdccList(link)
                this.shows.push({
                    id: res.id,
                    name: res.name,
                    ep: job.match(/(#\d*$)/g)[0].replace('#', '').replace('-', '.'),
                    showLink: job.replace(/#\d*(-\d*)*$/, ''),
                    img: res.img,
                    desc: res.desc,
                    quality: xdcc,
                    date: new Date()
                })
            }
        }
    }
    async xdccList(url: string): Promise<Shows["quality"]> {
        url = url.replace('?search=', 'search.php?t=')
        let file = url.replace('https://xdcc.horriblesubs.info/search.php?t=', '')
        try {
            let html = await rp(url, { timeout: 10000 })
            html = html.replace(/(p\.k\[\d+\]\s\=\s)/gi, '')
            html = html.replace(/(;[^;$])/gi, ',')
            html = html.replace(/.$/gi, ']')
            html = `[${html}`
            if (typeof eval(html) === 'object') {
                let res: Shows["quality"]["bots"] = eval(html).map((bots: { f: string; b: string; n: number; s: number }) => {
                    if (bots.f.includes(file)) {
                        return { bot: bots.b, pack: bots.n }
                    }
                })
                res = res.sort((item1, item2) => {
                    if (item1.bot.includes('NEW') && item2.bot.includes('Sensei')) { return -1 }
                    if (item1.bot.includes('Sensei') && item2.bot.includes('ARCHIVE')) { return -1 }
                    if (item1.bot.includes('NEW') && item2.bot.includes('ARCHIVE')) { return -1 }
                    if (item1.bot.includes('HOLLAND') && !item2.bot.includes('HOLLAND')) { return -1 }
                    return 1
                })
                res = res.filter(el => typeof el !== 'undefined')
                return {
                    resolution: html.match(/(\[\d+p\])/g)[0].replace(/\[/g, '').replace(/\]/g, ''),
                    bots: res
                }
            } else {
                throw EvalError(`couldn't eval: '${html}' from : ${url}`)
            }
        } catch (e) {
            if (e instanceof EvalError) {
                console.log(e)

            } else {
                console.log(e)

            }
        }
    }
    async fetchShow(url: string): Promise<BasicShows> {
        try {
            const html = await rp(url, { timeout: 10000 })
            const $ = cheerio.load(html)
            let show: { id: number, name: string, img: string, desc: string }
            const id = parseInt($('script').filter((i, elem) => {
                return $(elem).html().includes('var hs_showid')
            }).html().replace(/\D/g, ''))
            let img = $('.series-image > img').attr('src').replace(this.homePage, '')
            img = this.homePage + img
            return {
                id: id,
                name: $('h1.entry-title').text(),
                img: img,
                desc: $('.series-desc > p').text()
            }
        } catch (e) {

        }
    }
    async getShow(id: number): Promise<string> {
        const apiMethod: string = '?method=getshows&type=show&showid='
        try {
            const html = await rp(this.API + apiMethod + id, { timeout: 10000 })
            const $ = cheerio.load(html)
            return $('.rls-links-container').first().children('.rls-link').children('.hs-xdcc-link').children('a').last().prev('a').attr('href')

        } catch (e) {

        }
    }
    async getAllshows() {
        try {
            const res = await rp(this.homePage + '/shows/')
            const $ = cheerio.load(res)
            const results: Array<{ name: string, url: string }> = []
            $('.ind-show').each((i, el) => {
                results.push({
                    name: $(el).children('a').text(),
                    url: $(el).children('a').attr('href')
                })
            })
            return results
        } catch (e) {

        }
    }
}