const { spawn, spawnSync } = require('child_process');
const crossSpawn = require('cross-spawn');
const crossSpawnSync = crossSpawn.sync;
const cron = require('node-cron');
const puppeteer = require('puppeteer');
const moment = require('moment');
const axios = require('axios');
const fs = require('fs-extra');

let chromeLauncher = '';
let chromeLauncherFlags = [];

// FULL LIST OF chromium FLAGS
// https://peter.sh/experiments/chromium-command-line-switches/#load-extension

async function getLatestScreenshot() {
  let wsChromeEndpointUrl = '';

  if (process.platform === 'win32') {
    console.log('Running on Windows');

    crossSpawnSync('powershell', ['kill', '-n', 'chrome']);
    await sleep(1000);

    chromeLauncher = 'start';
    chromeLauncherFlags = [
      'chrome.exe',
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
    ];

    wsChromeEndpointUrl = await startChromeProcess(
      chromeLauncher,
      chromeLauncherFlags
    );
  } else if (process.platform === 'darwin') {
    console.log('Running on Mac');
    spawnSync('killall', [`Google Chrome`]);
    chromeLauncher = `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`;
    chromeLauncherFlags = [
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
      // `--user-data-dir=$(mktemp -d -t "chrome-remote_data_dir)"`,
    ];
    wsChromeEndpointUrl = await startChromeProcess(
      chromeLauncher,
      chromeLauncherFlags
    );
  }

  if (!wsChromeEndpointUrl) {
    console.log('Failed to load websocket URL. Exiting now!');
    return;
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsChromeEndpointUrl,
    defaultViewport: {
      width: 2000,
      height: 2000,
    },
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(function () {
    navigator.geolocation.getCurrentPosition = function (cb) {
      setTimeout(() => {
        cb({
          coords: {
            accuracy: 21,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: 40.7608,
            longitude: -111.891,
            speed: null,
          },
        });
      }, 1);
    };
  });

  await page.setViewport({
    width: 2000,
    height: 2000,
  });

  await page.goto('https://fire.airnow.gov/', {
    waitUntil: 'networkidle0',
  });

  console.log('Time to zoom out');
  const zoomOutButtonElement = await page.$('.leaflet-control-zoom-out');
  await zoomOutButtonElement.click();
  await sleep(1500);
  await zoomOutButtonElement.click();
  await sleep(1500);
  await zoomOutButtonElement.click();
  await sleep(1500);
  await page.keyboard.press('ArrowLeft');
  await sleep(1500);
  await page.keyboard.press('ArrowLeft');
  await sleep(1500);
  await page.keyboard.press('ArrowLeft');
  await sleep(5000);

  console.log('Time Screenshot!');
  const bodyElement = await page.$('body');
  const bodyBoundingBox = await bodyElement.boundingBox();

  const now = moment().utc().unix();
  fs.ensureDirSync('./screenshots');
  const outputFileName = `./screenshots/${now}.png`;

  console.log('Now saving: ' + outputFileName);

  await bodyElement.screenshot({
    path: outputFileName,
    clip: {
      x: bodyBoundingBox.x,
      y: bodyBoundingBox.y,
      width: Math.min(bodyBoundingBox.width, page.viewport().width),
      height: Math.min(bodyBoundingBox.height, page.viewport().height),
    },
  });

  console.log('ALL DONE!');

  if (process.platform === 'win32') {
    crossSpawnSync('powershell', ['kill', '-n', 'chrome']);
  } else if (process.platform === 'darwin') {
    crossSpawnSync('killall', [`Google Chrome`]);
  }

  return;
}

async function startChromeProcess(chromeLauncher, chromeLauncherFlags) {
  // Starts Chrome
  try {
    const chromeStartCommand = `${chromeLauncher} ${chromeLauncherFlags.join(
      ' '
    )}`;
    console.log(`Running \n${chromeStartCommand}`);

    if (process.platform === 'win32') {
      crossSpawnSync(chromeStartCommand, { stdio: 'inherit' });
    } else if (process.platform === 'darwin') {
      spawn(chromeLauncher, chromeLauncherFlags, { stdio: 'inherit' });
    }
  } catch (error) {
    // do nothing.
  }

  await sleep(1000);

  try {
    console.log('Fetching webSocket URL...');
    const response = await axios.get('http://localhost:9222/json/version');
    const data = response.data;
    return data.webSocketDebuggerUrl;
  } catch (error) {
    console.log('Request failed. Exiting now.');
    return;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

// DEV ONLY
getLatestScreenshot();

cron.schedule('0,15,30,45 * * * *', () => {
  console.log('TIME TO RUN');
  getLatestScreenshot();
});
