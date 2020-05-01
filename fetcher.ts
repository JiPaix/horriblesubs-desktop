import * as cheerio from "cheerio";
import * as needle from 'needle'
import { Shows } from './interfaces'
import * as event from 'eventemitter3'
needle.defaults({
    open_timeout: 10000,
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
    follow_max         : 5
})
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
        setInterval(() => {
            this.fetchIndex()
        }, ms)
    }
    async fetchIndex() {
        const apiMethod: string = '?method=getlatest'
        let currentJob: string[] = []
        try {
            const html = await needle('get',this.API + apiMethod)
            const $ = cheerio.load(html.body)

            $('a').each((_i, el) => {
                const currentLink = $(el).attr('href');
                if(typeof currentLink !== 'undefined') {
                    if (!this.homeFetch.includes(currentLink)) {
                        currentJob.push(currentLink);

                    }
                }
            })
            if (currentJob.length) {
                this.homeFetch.concat(currentJob)
                for (let job of currentJob) {
                    if(job !== null) {
                        console.log('fetchshow')
                        const res = await this.fetchShow(this.homePage + job)
                        if(typeof res !== 'undefined') {
                            console.log('getshow')
                            const link = await this.getShow(res.id)
                            if(typeof link !== 'undefined') {
                                console.log('xdcclist')
                                const xdcc = await this.xdccList(link)
                                if(typeof xdcc !== 'undefined') {
                                    console.log('match')
                                    let tmp = job.match(/(#\d*$)/g)
                                    if(tmp !== null) {
                                        console.log('tmp')
                                        let ep:string | number = tmp[0].replace('#', '').replace('-', '.')
                                        ep = parseFloat(ep)
                                        if (typeof ep === 'number') {
                                            console.log('iftypenumber')
                                            this.shows.push({
                                                id: res.id,
                                                name: res.name,
                                                ep: ep,
                                                showLink: job.replace(/#\d*(-\d*)*$/, '').replace(/\/?shows\//g, ''),
                                                img: res.img,
                                                desc: res.desc,
                                                quality: xdcc,
                                                date: new Date()
                                            })
                                            console.log('we have '+this.shows.length+' shows')
                                        }
                                    }
                                }
                            }
                        }
                    }
    
                }
            }
        }catch(e) {
            console.log(e.message)
            console.log('THIS KIND OF')

        }

    }
    async xdccList(url: string) {
        url = url.replace('?search=', 'search.php?t=')
        let file = url.replace('https://xdcc.horriblesubs.info/search.php?t=', '')
        try {
            let html = await needle('get', url)
            let parsed = html.body.replace(/(p\.k\[\d+\]\s\=\s)/gi, '')
            parsed = parsed.replace(/(;[^;$])/gi, ',')
            parsed = parsed.replace(/.$/gi, ']')
            parsed = `[${parsed}`
            if (typeof eval(parsed) === 'object') {
                let res: Shows["quality"]["bots"] = eval(parsed).map((bots: { f: string; b: string; n: number; s: number }) => {
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
                    resolution: parsed.match(/(\[\d+p\])/g)[0].replace(/\[/g, '').replace(/\]/g, ''),
                    bots: res
                }
            } else {
                throw EvalError(`couldn't eval: '${html}' from : ${url}`)
            }
        } catch (e) {

        }
    }
    async fetchShow(url: string) {
        try {
            const html = await needle('get', url)
            if(html.body.length === 0) {throw Error(`fetchShow: can't parse HTML`)}
            const $ = cheerio.load(html.body)
            let filter = $('script').filter((_index, elem) => {
                return $(elem).html()!.includes('var hs_showid')
            }).html()
            if(filter !== null) {
                const id = parseInt(filter.replace(/\D/g, ''))
                if(typeof id !== 'number') {
                    throw Error(`fetchShow: couldn't get id`)
                }
                let findImg = $('.series-image > img').attr('src')
                if(typeof findImg !== 'undefined') {
                    let img = findImg.replace(this.homePage, '')
                    img = this.homePage+img
                    return {
                        id: id,
                        name: $('h1.entry-title').text(),
                        img: img,
                        desc: $('.series-desc > p').text()
                    }
                }
            } else {
                throw Error(`error at fetchShow(): couldn't get 'id'`)
            }
        } catch (e) {
            console.log(`error when going ${url}`)
        }
    }
    async getShow(id: number) {
        const apiMethod: string = '?method=getshows&type=show&showid='
        try {
            const html = await needle('get', this.API + apiMethod + id)
            const $ = cheerio.load(html.body)
            const show = $('.rls-links-container').first().children('.rls-link').children('.hs-xdcc-link').children('a').last().prev('a').attr('href')
            if(typeof show !== 'undefined') {
                return show
            } else {
                throw Error(`getShow() couldn't get 'show'`)
            }
            
        } catch (e) {
            
        }
    }
    async getAllshows() {
        try {
            const res = await needle('get', this.homePage + '/shows/')
            const $ = cheerio.load(res.body)
            const results: Array<{ name: string, url: string }> = []
            $('.ind-show').each((_i, el) => {
                const uri = $(el).children('a').attr('href')
                const name = $(el).children('a').text()
                if(typeof uri !== 'undefined' && name.length && uri.length) {
                    results.push({
                        name: name,
                        url: uri
                    })
                }
            })
            return results
        } catch (e) {

        }
        throw Error("uncatched error at getAllshows()");
    }

    
}