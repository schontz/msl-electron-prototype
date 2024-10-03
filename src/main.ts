import { app, BrowserWindow, ipcMain, MessageChannelMain } from 'electron';
import path from 'path';

const CUSTOM_URL_ARG = process.argv.indexOf('--url');
const USE_CUSTOM_URL = CUSTOM_URL_ARG > -1;
const CUSTOM_URL = USE_CUSTOM_URL ? process.argv[CUSTOM_URL_ARG+1] : '';

if (isUrl(CUSTOM_URL) && new URL(CUSTOM_URL).protocol === 'https:') {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !USE_CUSTOM_URL,
    },
  });

  mainWindow.loadURL(isUrl(CUSTOM_URL) ? CUSTOM_URL : 'http://127.0.0.1:8080/');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  return mainWindow;
};



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  const win = createWindow()

  const transformer = new Transformer();
  
  const SHOULD_TRANSFORM = true;
  const USE_PORT = false;

  ipcMain.handle('transform-frame', async (_event, operation, frame) => {
    return SHOULD_TRANSFORM ? transformer.handleFrameData(operation, frame) : frame;
  });

  win.webContents.on('did-finish-load', async () => {
    if (!USE_PORT) return;

    console.log('finished loading... sending port!');
    const { port1: rendererPort, port2: mainPort } = new MessageChannelMain();

    mainPort.start();
    mainPort.addListener('message', (event) => {
      const payload = event.data;
      // console.log('port payload:', payload);
      // no-op for now
      mainPort.postMessage(payload);
    });
    win.webContents.postMessage('message-port', null, [rendererPort]);
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

class Transformer {
  private currentCryptoKey: string;
  private useCryptoOffset: boolean = false;
  private currentKeyIdentifier: number = 0;

  private readonly frameTypeToCryptoOffset = {
    key: 10,
    delta: 3,
    undefined: 1,
  };

  private encodeFunction(encodedFrame: any, controller: any): void {
    this.currentCryptoKey = '1';
    if (this.currentCryptoKey) {
      // console.log('*** encodeFunction::this.currentCryptoKey:', this.currentCryptoKey);
      const view = new DataView(encodedFrame.data);
      // Any length that is needed can be used for the new buffer.
      const newData = new ArrayBuffer(encodedFrame.data.byteLength + 5);
      const newView = new DataView(newData);
      const frameTypeToCryptoOffset = this.frameTypeToCryptoOffset;

      const cryptoOffset = this.useCryptoOffset
        ? frameTypeToCryptoOffset[encodedFrame.type as keyof typeof frameTypeToCryptoOffset]
        : 0;
      for (let i = 0; i < cryptoOffset && i < encodedFrame.data.byteLength; ++i) {
        newView.setInt8(i, view.getInt8(i));
      }
      // This is a bitwise xor of the key with the payload. This is not strong encryption, just a demo.
      for (let i = cryptoOffset; i < encodedFrame.data.byteLength; ++i) {
        const keyByte = this.currentCryptoKey.charCodeAt(i % this.currentCryptoKey.length);
        newView.setInt8(i, view.getInt8(i) ^ keyByte);
      }
      // Append keyIdentifier.
      newView.setUint8(encodedFrame.data.byteLength, this.currentKeyIdentifier % 0xff);
      // Append checksum
      newView.setUint32(encodedFrame.data.byteLength + 1, 0xdeadbeef);

      encodedFrame.data = newData;
    }
    controller.enqueue(encodedFrame);
  }

  private decodeFunction(encodedFrame: any, controller: any) {
    const view = new DataView(encodedFrame.data);
    const checksum =
      encodedFrame.data.byteLength > 4 ? view.getUint32(encodedFrame.data.byteLength - 4) : false;

    // For testing the bad scenior of showing green screen or random noise on the receiver side,
    // set this.currentCryptoKey = '2
    this.currentCryptoKey = '1';
    if (this.currentCryptoKey) {
      // console.log('*** decodeFunction::this.currentCryptoKey:', this.currentCryptoKey);
      if (checksum !== 0xdeadbeef) {
        // console.log('Corrupted frame received, checksum ' + checksum.toString(16));
        return; // This can happen when the key is set and there is an unencrypted frame in-flight.
      }
      const keyIdentifier = view.getUint8(encodedFrame.data.byteLength - 5);
      if (keyIdentifier !== this.currentKeyIdentifier) {
        console.log(
          `Key identifier mismatch, got ${keyIdentifier} expected ${this.currentKeyIdentifier}.`
        );
        return;
      }

      const newData = new ArrayBuffer(encodedFrame.data.byteLength - 5);
      const newView = new DataView(newData);
      const frameTypeToCryptoOffset = this.frameTypeToCryptoOffset;
      const cryptoOffset = this.useCryptoOffset
        ? frameTypeToCryptoOffset[encodedFrame.type as keyof typeof frameTypeToCryptoOffset]
        : 0;

      for (let i = 0; i < cryptoOffset; ++i) {
        newView.setInt8(i, view.getInt8(i));
      }
      for (let i = cryptoOffset; i < encodedFrame.data.byteLength - 5; ++i) {
        const keyByte = this.currentCryptoKey.charCodeAt(i % this.currentCryptoKey.length);
        newView.setInt8(i, view.getInt8(i) ^ keyByte);
      }
      encodedFrame.data = newData;
      // console.log('*** decodeFunction::newData:', newData);
    } else if (checksum === 0xdeadbeef) {
      return; // encrypted in-flight frame but we already forgot about the key.
    }
    controller.enqueue(encodedFrame);
  }

  handleFrameData(operation: string, data: any) {
    const header = data.slice(0, 30);
    const rest = data.slice(30);
    let frame = { data: rest };
    const controller = { enqueue(newFrame: any) { frame = newFrame; } };
    if (operation === 'encode') {
      this.encodeFunction(frame, controller);
    } else if (operation === 'decode') {
      this.decodeFunction(frame, controller);
    }
    return concatBuffers(header, frame.data);
  }
}

function concatBuffers(buffer1: any, buffer2: any) {
  var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
};
