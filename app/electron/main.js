// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const getMenuTemplate = require('./getMenuTemplate');
const log = require('electron-log');

const unhandled = require('electron-unhandled');
unhandled();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const isDev = process.argv.indexOf('--dev') !== -1;

/**
 * Function to be run on app.on('ready')
 */
function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		title: isDev ? 'Maestro DEVELOPMENT VERSION' : 'Maestro',
		darkTheme: true,
		width: 800,
		height: 600,
		webPreferences: {
			// preload: path.join(__dirname, 'preload.js'),
			nodeIntegration: true
		},
		icon: path.join(__dirname, '../assets/images/favicon.ico')
	});

	mainWindow.maximize();

	// and load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'index.html'));

	// Open the DevTools
	if (isDev) {
		mainWindow.webContents.openDevTools();
	}

	const menu = Menu.buildFromTemplate(getMenuTemplate(mainWindow));
	Menu.setApplicationMenu(menu);

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});
}

try {

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	app.on('ready', createWindow);

	// Quit when all windows are closed.
	app.on('window-all-closed', function() {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', function() {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
		if (mainWindow === null) {
			createWindow();
		}
	});

	// In this file you can include the rest of your app's specific main process
	// code. You can also put them in separate files and require them here.

} catch (e) {
	console.log(e);
	log.warn(e);
}
