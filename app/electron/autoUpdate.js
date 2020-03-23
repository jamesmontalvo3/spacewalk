'use strict';

const { ipcRenderer } = require('electron');

const notification = document.getElementById('notification');
const message = document.getElementById('message');
const restartButton = document.getElementById('restart-button');

ipcRenderer.on('update_available', () => {
	console.log('ipcRenderer --> update_available');
	ipcRenderer.removeAllListeners('update_available');
	message.innerText = 'A new update is available. Downloading now...';
	notification.classList.remove('hidden');
});

ipcRenderer.on('update_downloaded', () => {
	console.log('ipcRenderer --> update_downloaded');
	ipcRenderer.removeAllListeners('update_downloaded');
	message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
	restartButton.classList.remove('hidden');
	notification.classList.remove('hidden');
});

/**
 * FIXME: both this and next function used in notification HTML in electron index.html
 */
function closeNotification() { // eslint-disable-line no-unused-vars
	notification.classList.add('hidden');
}

/**
 *
 */
function restartApp() { // eslint-disable-line no-unused-vars
	ipcRenderer.send('restart_app');
}
