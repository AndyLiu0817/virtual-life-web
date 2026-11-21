const {
  app,
  BrowserWindow,
  Menu,
  net,
  protocol,
  screen,
  session,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const title = "未來人生・進行曲";
const origin = "life-game://local";
const minimum = { width: 960, height: 600 };
const profile =
  process.env.FUTURE_LIFE_SMOKE_PROFILE ||
  path.join(app.getPath("appData"), "FutureLifeMarch");
fs.mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
const windowStatePath = path.join(profile, "window.json");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "life-game",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function serveGame(request) {
  const url = new URL(request.url);
  if (url.host !== "local") return new Response(null, { status: 404 });
  if (["/shell.html", "/shell.js"].includes(url.pathname)) {
    return net.fetch(
      pathToFileURL(path.join(__dirname, url.pathname.slice(1))).href,
    );
  }
  const game = path.join(__dirname, "dist", "game");
  const file = path.resolve(game, "." + decodeURIComponent(url.pathname));
  if (!file.startsWith(game + path.sep))
    return new Response(null, { status: 404 });
  return net.fetch(pathToFileURL(file).href);
}

function defaultBounds() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const fit = Math.min(width / 1280, height / 800) * 0.85;
  const windowWidth = Math.max(minimum.width, Math.round(1280 * fit));
  const windowHeight = Math.max(minimum.height, Math.round(800 * fit));
  return {
    x: display.workArea.x + Math.max(0, Math.round((width - windowWidth) / 2)),
    y:
      display.workArea.y + Math.max(0, Math.round((height - windowHeight) / 2)),
    width: windowWidth,
    height: windowHeight,
  };
}

function readWindowState() {
  try {
    const { bounds, maximized } = JSON.parse(
      fs.readFileSync(windowStatePath, "utf8"),
    );
    const { x, y, width, height } = bounds;
    if (
      ![x, y, width, height].every(Number.isSafeInteger) ||
      width < minimum.width ||
      height < minimum.height
    )
      return {};

    // Restore only if the left part of the title bar can be reached.
    const visible = screen
      .getAllDisplays()
      .some(
        ({ workArea: area }) =>
          y >= area.y &&
          y + 30 <= area.y + area.height &&
          x <= area.x + area.width - 100 &&
          x + width >= area.x + 100,
      );
    return visible ? { bounds, maximized: maximized === true } : {};
  } catch {
    return {};
  }
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) {
    void shell.openExternal(url).catch(console.error);
  }
}

function createWindow() {
  const previous = readWindowState();
  const window = new BrowserWindow({
    ...(previous.bounds ?? defaultBounds()),
    minWidth: minimum.width,
    minHeight: minimum.height,
    backgroundColor: "#193941",
    title,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-frame-navigate", (event) => {
    if (event.url.startsWith(origin + "/")) return;
    event.preventDefault();
    openExternal(event.url);
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (
      input.key === "F11" ||
      (input.key === "Escape" && window.isFullScreen())
    ) {
      event.preventDefault();
      if (!input.isAutoRepeat) window.setFullScreen(!window.isFullScreen());
    }
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.on("close", () => {
    try {
      fs.writeFileSync(
        windowStatePath + ".tmp",
        JSON.stringify({
          bounds: window.getNormalBounds(),
          maximized: !window.isFullScreen() && window.isMaximized(),
        }),
      );
      fs.renameSync(windowStatePath + ".tmp", windowStatePath);
    } catch (error) {
      console.error("Could not save window position", error);
    }
  });
  window.once("ready-to-show", () => {
    if (previous.maximized) window.maximize();
    window.show();
  });
  void window.loadURL(origin + "/shell.html").catch(console.error);
}

if (app.requestSingleInstanceLock()) {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle("life-game", serveGame);
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
} else {
  app.quit();
}
