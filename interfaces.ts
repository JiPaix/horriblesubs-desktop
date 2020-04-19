interface Shows {
    id: number;
    name: string;
    ep: string;
    showLink: string;
    img: string;
    desc: string;
    quality: {
        resolution: string;
        bots: Array<{
            bot: string;
            pack: number;
        }>
    }
    date: Date;
}

interface BasicShows {
    id: number;
    name: string;
    img: string;
    desc: string;
    links?: string[];
}

interface Show {
    id: number;
    name: string;
    showLink: string;
    img: string;
    desc: string;
    links?: Array<{
        ep: string;
        resolution: string;
        bots: Array<{
            bot: string;
            pack: number;
        }>
    }>
}

interface Params {
    host: string,
    nick: string,
    chan: string,
    path: string,
    port: number,
    verbose?: boolean,
    randomizeNick?: boolean
    refreshIndex?: number
    keepIndex?: number
}

export {
    Shows,
    Show,
    BasicShows,
    Params
}