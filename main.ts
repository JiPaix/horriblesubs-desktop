import { app, BrowserWindow, ipcMain, session } from "electron";
import server from "./server";
import * as pug from "pug";
import { ElectronBlocker } from "@cliqz/adblocker-electron";
import fetch from "cross-fetch";
import * as needle from "needle";
import * as path from "path";
import * as low from "lowdb";
import * as FileSync from "lowdb/adapters/FileSync";
import { MainSettings } from "./interfaces";
import { Request, Response } from "express";
import * as express from "express";

const adapter = new FileSync(path.normalize(path.join(__dirname, "db.json")));

let db: low.LowdbSync<any> | null = low(adapter);
db.defaults({
  shows: [],
  index: [],
  watched: [],
  follows: [],
  settings: [],
}).write();

needle.defaults({
  open_timeout: 10000,
  user_agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36",
  follow_max: 5,
  compressed: true,
});
app.allowRendererProcessReuse = true;
const opts = {};

let win: BrowserWindow;
let winSettings: BrowserWindow;
let MAL: BrowserWindow;

try {
  let firstBoot: boolean;

  app.whenReady().then(() => {
    // adblocker and useragent :
    ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
      blocker.enableBlockingInSession(session.defaultSession);
    });

    session.defaultSession.webRequest.onBeforeSendHeaders(
      (details, callback) => {
        details.requestHeaders["User-Agent"] =
          "Mozilla/5.0 (Linux: Android 10; JSN-L21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.3987.162 Mobile Safari/537.36";
        callback({
          cancel: false,
          requestHeaders: details.requestHeaders,
        });
      }
    );
    // Main Window
    win = new BrowserWindow({
      title: "horriblesubs desktop",
      backgroundColor: "#343a40",
      width: 800,
      height: 600,
      frame: false,
      show: false,
      resizable: true,
      webPreferences: {
        webSecurity: false,
        nodeIntegration: true,
      },
    });
    // Settings Window
    winSettings = new BrowserWindow({
      title: "Settings",
      width: 500,
      height: 700,
      show: false,
      frame: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        webviewTag: true,
      },
      backgroundColor: "#343a40",
    });
    // MyAnimeList research Window
    MAL = new BrowserWindow({
      title: "MyAnimeList search",
      width: 1280,
      height: 720,
      show: false,
      frame: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        webviewTag: true,
      },
      backgroundColor: "#343a40",
    });
    // Settings
    // if no settings in db set default values
    let setup: MainSettings;
    if (!db!.get("settings").value().length) {
      let data: any = db!.get("settings");
      setup = {
        id: 0,
        nickname: "hsd",
        chan: "#horriblesubs",
        randomizeNick: true,
        keepIndex: 1,
        refreshIndex: 60000 * 15,
        startupCheck: true,
        path: path.normalize(path.resolve(__dirname, "../dl")),
        pathSize: 0,
        host: "irc.rizon.net",
        port: 6660,
        verbose: true,
      };
      data.push(setup).write();
      firstBoot = true;
    } else {
      let data: any = db!.get("settings");
      setup = data.find({ id: 0 }).value();
      firstBoot = false;
    }
    // show load spinner
    win
      .loadFile(
        path.normalize(path.resolve(__dirname, "../views", "loading.html"))
      )
      .then(() => {
        win.show();
      });
    // start xdccserver
    const serv = new server({
      host: setup.host,
      nick: setup.nickname,
      chan: setup.chan,
      path: setup.path,
      port: setup.port,
      verbose: setup.verbose,
      randomizeNick: setup.randomizeNick,
      refreshIndex: setup.refreshIndex,
      keepIndex: setup.keepIndex,
      startupCheck: setup.startupCheck,
    });
    if (firstBoot) {
      let data: any = db!.get("settings");
      data
        .find({ id: 0 })
        .assign({ startupCheck: false })
        .write();
      data = null;
    }
    db = null;
    // extending express
    serv.app.use(
      "/static",
      express.static(path.normalize(path.resolve(__dirname, "../node_modules")))
    );
    serv.app.get("/settings", (req: Request, res: Response) => {
      res.render("settings", { settings: serv.db.get("settings").value()[0] });
    });
    serv.app.get("/search", (req: Request, res: Response) => {
      needle(
        "get",
        `https://myanimelist.net/search/prefix.json?type=all&keyword=${req.query.keyword}`,
        { json: true, compressed: true }
      ).then((resp) => {
        let json = resp.body.categories.filter(
          (cat: { type: string }) => cat.type === "anime"
        )[0].items;
        const items = { items: json };
        res.render("search", { items: items.items });
      });
    });

    //
    serv.on("http-ready", () => {
      if (setup.firstBoot) {
        serv.on("fav-update", () => {
          if (setup.firstBoot) {
            win.loadURL(`http://localhost:3000`);
            setup.firstBoot = false;
          }
        });
      } else {
        win.loadURL(`http://localhost:3000`);
      }

      // ipc events
      MAL.on("close", (event) => {
        event.preventDefault();
        MAL.hide();
      });
      ipcMain.on("MAL-hide", function(event, arg) {
        MAL.hide();
      });
      ipcMain.on("quit", () => {
        app.quit();
        process.exit(0);
      });
      ipcMain.on("data-search", (_event, arg) => {
        MAL.hide();
        MAL.loadFile(`${__dirname}/views/loading.html`)
          .then(() => {
            MAL.show();
          })
          .finally(() => {
            MAL.loadURL(`http://localhost:3000/search?url=${arg.keyword}`);
          })
          .catch((e) => {
            console.log(e);
          });
      });
      ipcMain.on("settings-show", (_event, arg) => {
        winSettings
          .loadURL(`http://localhost:3000/settings`)
          .then(() => winSettings.show());
        winSettings.webContents.openDevTools();
      });
      ipcMain.on("settings-hide", () => {
        winSettings.hide();
      });
      ipcMain.on("settings-save", (_ev, settings) => {
        settings.path = path.normalize(settings.path);
        let data: any = serv.db.get("settings");
        serv.path = settings.path;
        serv.xdccJS.path = settings.path;
        data
          .find({ id: 0 })
          .assign({
            refreshIndex: settings.refresh,
            startupCheck: settings.startupCheck,
            path: settings.path,
            pathSize: settings.pathSize,
            keepIndex: settings.keepIndex,
          })
          .write();
      });
    });
  });
} catch (e) {
  console.log(e);
}
