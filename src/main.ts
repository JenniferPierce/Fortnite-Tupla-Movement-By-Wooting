import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  session,
  shell,
  Tray,
} from "electron";
import { start_service, stop_service } from "./native";
import ElectronStore from "electron-store";
import { AppSettings } from "./common";
import path from "path";
import install, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";

app.allowRendererProcessReuse = false;

declare var __dirname: any, process: any;

let mainWindow: Electron.BrowserWindow | null;

function isDev() {
  return process.mainModule.filename.indexOf("app.asar") === -1;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    transparent: true,
    frame: false,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadURL(`file://${__dirname}/../public/index.html`);

  // All new windows opened from the app are links, so open them
  // externally
  mainWindow.webContents.on("new-window", function (event, url) {
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("will-navigate", function (event, url) {
    event.preventDefault();
    shell.openExternal(url);
  });

  if (isDev()) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("ready-to-show", () => {
    if (!mainWindow) return;

    mainWindow.show();
  });

  ipcMain.on("windowClose", () => mainWindow && mainWindow.close());

  ipcMain.on("windowMinimize", () => mainWindow && mainWindow.hide());

  ipcMain.handle("getVersion", () => app.getVersion());

  mainWindow.on("closed", () => {
    app.removeAllListeners("browser-window-focus");
    app.removeAllListeners("browser-window-blur");
    mainWindow = null;
  });
}

const isSingleInstance = app.requestSingleInstanceLock();

if (isSingleInstance) {
  app.on("second-instance", () => mainWindow && mainWindow.show());
} else {
  app.quit();
}

app.on("ready", () => {
  serviceManager.init();
  createMainWindow();
  create_tray();
  if (isDev()) {
    install(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: { allowFileAccess: true },
    })
      .then((name: string) => console.log(`Added Extension:  ${name}`))
      .catch((err: string) => console.log("An error occurred: ", err));

    // installExtension(REDUX_DEVTOOLS)
    //   .then((name: string) => console.log(`Added Extension:  ${name}`))
    //   .catch((err: string) => console.log("An error occurred: ", err));
  }
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  serviceManager.deinit();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

let tray: Tray | null = null;
const contextMenu = Menu.buildFromTemplate([
  {
    label: "Show Window",
    click: () => mainWindow?.show(),
  },
  {
    label: "Toggle Double Movement",
    type: "checkbox",
    //We can tell from the ServiceState whether the service is enabled or not
    checked: false,
    click: ({ checked }) => serviceManager.set_double_movement_enabled(checked),
  },
  { type: "separator" },
  {
    label: "Quit",
    click: () => app.quit(),
  },
]);

function create_tray() {
  if (!tray) {
    tray = new Tray(`${__dirname}/../build/icon.ico`);
    tray.setToolTip("Wooting Double Movement");
    tray.on("double-click", () => {
      mainWindow?.show();
    });
    tray.on("click", () => {
      if (tray) {
        tray.popUpContextMenu();
      }
    });
  }

  contextMenu.items[1].checked = serviceManager.doubleMovementEnabled();
  tray.setContextMenu(contextMenu);
}

class ServiceManager {
  running: boolean = false;
  store = new ElectronStore<AppSettings>({
    defaults: { doubleMovementEnabled: false },
  });

  init() {
    if (this.store.get("doubleMovementEnabled")) {
      this.start();
    }

    ipcMain.handle("store_get", (_, name: string) => {
      return this.store.get(name);
    });

    ipcMain.on("store_set", (_, name: string, value) => {
      this.store.set(name, value);
      this.update_state();
    });

    const ret = globalShortcut.register("CommandOrControl+Shift+X", () => {
      console.debug("CommandOrControl+Shift+X is pressed");
      this.set_double_movement_enabled(!this.doubleMovementEnabled());
    });

    if (!ret) {
      console.error("Failed to register globalShortcut");
    }
  }

  store_set<Key extends keyof AppSettings>(name: Key, value: AppSettings[Key]) {
    mainWindow?.webContents.send("store_changed", name, value);
    this.store.set(name, value);
  }

  doubleMovementEnabled(): boolean {
    return this.store.get("doubleMovementEnabled");
  }

  set_double_movement_enabled(value: boolean) {
    this.store_set("doubleMovementEnabled", value);
    this.update_state();
  }

  update_state() {
    create_tray();

    if (this.doubleMovementEnabled()) {
      this.start();
    } else {
      this.stop();
    }
  }

  deinit() {
    if (this.running) {
      this.stop();
    }
  }

  onError = (error: Error) => {
    console.error(error);
    dialog.showErrorBox(
      "Wooting Double Movement errored",
      `An unexpected error occurred in the service, it's going to be disabled, please try again.\n\n${error}`
    );
    this.set_double_movement_enabled(false);
  };

  start() {
    if (!this.running) {
      try {
        start_service(this.onError);
      } catch (e) {
        this.onError(e);
      }
      this.running = true;
    }
  }

  stop() {
    if (this.running) {
      stop_service();
      this.running = false;
    }
  }
}
const serviceManager = new ServiceManager();