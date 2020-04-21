import * as cheerio from "cheerio";
import * as rp from 'request-promise-native'
import fetcher from './fetcher'
import { Show } from './interfaces'

export default class searcher extends fetcher {
    delay: number
    constructor() {
        super()
        this.delay = 2000
    }
    async showUpdate(url: string, stopAt?: number | boolean): Promise<Show|undefined> {
            const show = await this.fetchShow(this.homePage + url)
            if(typeof show !== 'undefined') {
                const findEpisodes = await this.findEpisodes(show.id, stopAt)
                if(typeof findEpisodes !== 'undefined') {
                    let templinks = []
                    for (let xdccLinks of findEpisodes) {
                        const xdcc = await this.xdccList(xdccLinks.link).catch((e) => console.log(e))
                        if(typeof xdcc !== 'undefined') {
                            templinks.push({ ep: xdccLinks.ep, resolution: xdcc.resolution, bots: xdcc.bots })
                        } else {
                            throw Error(`showUpdate: can't xdccList`)
                        }
                    }
                    if(templinks.length) {
                        return {
                            id: show.id,
                            name: show.name,
                            showLink: url,
                            img: show.img,
                            desc: show.desc,
                            links: templinks
                        }
                    }
                } else {
                    return undefined
                }
            } else {
                throw Error(`showUpdate: can't fetchShow`)
            }
    }
    async findEpisodes(id: number, all?: boolean | number): Promise<Array<{ ep: number, link: string }> | undefined> {
        let page: number
        if (typeof all === 'undefined') {
            all = true
        }
        if (all === true || typeof all === 'number') {
            page = 999
        } else {
            page = 1
        }
        const apiMethod = (id: number, current: number) => {
            return '?method=getshows&type=show&showid=' + id + '&nextid=' + current
        }
            let final:any[] = []
            for (let i = 0; i < page; i++) {
                let request = await rp(this.API + apiMethod(id, i), { timeout: 10000 }).catch((e) => console.log(e))
                const $ = cheerio.load(request)
                let res: Array<{ ep: number, link: string }> = []
                $('.rls-links-container').each((i, el) => {
                    let ep = $(el).parent().children('a').children('strong').text()
                    let link = $(el).children('.rls-link').children('.hs-xdcc-link').children('a').last().prev('a').attr('href')
                    if (typeof ep !== 'undefined' && typeof link !== 'undefined') {
                        res.push({ ep: parseFloat(ep.replace(/-|/g, '.')), link: link })
                    }
                })
                if (!res.length) {
                    break
                } else {
                    if (typeof all === 'number') {
                        if (res.filter(ep => ep.ep == all)) {
                            final = final.concat(res.filter(ep => ep.ep > all!))
                            break
                        }
                    } else if (typeof all === 'boolean') {
                        if (all === false) {
                            throw TypeError(`'all' can't be false, expected true or string`)
                        }
                    } else {
                        throw TypeError(`'all' expected true or string`)
                    }
                    final = final.concat(res)
                }
            }
            return Promise.all(final).then(res => {
                if(res.length) {
                    return res
                } else {
                    return undefined
                }
                
            })
    }
}