import { BrowserView, BrowserWindow, RPCSchema, Updater } from "electrobun/bun";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Set up the log file path (Saves to C:\Users\YOUR_NAME\AppData\Local\Temp\victor_log.txt on Windows)
const logPath = path.join(os.tmpdir(), "victor_log.txt");

// Custom logging function
function debugLog(message: string) {
    // 1. Log to the normal console (for when you run 'bun run dev')
    console.log(message);
    
    // 2. Append to the text file (for when running the production .exe)
    const timestamp = new Date().toLocaleTimeString();
    try {
        fs.appendFileSync(logPath, `[${timestamp}] - ${message}\n`);
    } catch (e) {
        // Failsafe just in case there are file permission issues
        console.error("Failed to write to log file", e);
    }
}

function generateRandomTitle(length: number = 10): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Print where the log file is located right at startup
debugLog(`=== APP STARTING ===`);
debugLog(`Log file located at: ${logPath}`);

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;

type RPC = {
    bun: RPCSchema<{
        requests: {
            openDevTools: { params: {}; response: void; };
            exitVictor: { params: {}; response: void; };
        };
        messages: {};
    }>;
    webview: RPCSchema<{
        requests: {};
        messages: {
            updateStatus: {
                state: "checking" | "downloading" | "applying" | "done" | "error";
            };
        };
    }>;
};

async function getMainViewUrl(): Promise<string> {
    const channel = await Updater.localInfo.channel();
    if (channel === "dev") {
        try {
            await fetch(DEV_SERVER_URL, { method: "HEAD" });
            debugLog(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
            return DEV_SERVER_URL;
        } catch {
            debugLog("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
        }
    }
    return "views://mainview/index.html";
}

const url = await getMainViewUrl();
let mainWindow: BrowserWindow;

const RPC = BrowserView.defineRPC<RPC>({
    maxRequestTime: 10000,
    handlers: {
        requests: {
            openDevTools: () => { mainWindow.webview.openDevTools(); },
            exitVictor: () => { mainWindow.close(); }
        },
    },
});

mainWindow = new BrowserWindow({
    title: "Nu leren voor later",
    url,
    rpc: RPC,
    frame: {
        width: 900,
        height: 700,
        x: 200,
        y: 200,
    }
});

debugLog("Svelte app window created!");

async function enforceUpdatesIfOnline() {
    const channel = await Updater.localInfo.channel();
    if (channel === "dev") {
        debugLog("Skipping auto-updates because we are in DEV mode.");
        return;
    }

    try {
        debugLog("Checking for updates in the background...");
        // 1. Get the update info object
        const updateInfo = await Updater.checkForUpdate();

        // 2. Check the specific boolean inside the object
        if (updateInfo && updateInfo.updateAvailable) {
            debugLog(`Update found! Version: ${updateInfo.version}. Starting download...`);
            await Updater.downloadUpdate();

            debugLog("Download complete. Applying update and restarting...");
            await Updater.applyUpdate(); 
        } else {
            debugLog("App is already up to date. No update found.");
        }
    } catch (error) {
        debugLog(`User is offline or update check failed. Proceeding normally. Error details: ${String(error)}`);
    }
}

// Fire the update check immediately after the window loads
enforceUpdatesIfOnline();

setInterval(() => {
    if (mainWindow) {
        const newTitle = `${generateRandomTitle(12)}`;
        
        // Pas de titel van het hoofdvenster aan
        mainWindow.setTitle(newTitle);
        
        // Optioneel: loggen naar je debug bestand
        // debugLog(`Titel veranderd naar: ${newTitle}`);
    }
}, 5);