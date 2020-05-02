interface Shows {
	id: number
	name: string
	ep: number
	showLink: string
	img: string
	desc: string
	quality: {
		resolution: string
		bots: Array<{
			bot: string
			pack: number
		}>
	}
	date: Date
}

interface BasicShows {
	id: number
	name: string
	img: string
	desc: string
	links?: string[]
}

interface Show {
	id: number
	name: string
	showLink: string
	img: string
	desc: string
	links?: Array<{
		ep: number
		resolution: string
		bots: Array<{
			bot: string
			pack: number
		}>
	}>
}

interface Params {
	host: string
	nick: string
	chan: string
	path: string
	port: number
	startupCheck: boolean
	verbose?: boolean
	randomizeNick?: boolean
	refreshIndex?: number
	keepIndex?: number
}

interface MainSettings {
	id: number
	nickname: string
	chan: string
	randomizeNick?: boolean
	keepIndex?: number
	refreshIndex?: number
	startupCheck: boolean
	path: string
	pathSize: number
	host: string
	port: number
	verbose?: boolean
	firstBoot?: boolean
}
export { Shows, Show, BasicShows, Params, MainSettings }
