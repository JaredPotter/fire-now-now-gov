const { spawn, spawnSync } = require('child_process');
const cron = require('node-cron');
const puppeteer = require('puppeteer');
const moment = require('moment');

let chromeLauncher = '';
let chromeLauncherFlags = [];

async function getLatestScreenshot() {
  if (process.platform === 'win32') {
    console.log('Running on Windows');
    chromeLauncher = 'start';
    chromeLauncherFlags = ['chrome.exe', '–remote-debugging-port=9222'];
  } else if (process.platform === 'darwin') {
    console.log('Running on Mac');
    await spawnSync('killall', [`Google Chrome`]);
    chromeLauncher = `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome`;
    chromeLauncherFlags = [
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=$(mktemp -d -t "chrome-remote_data_dir"`,
    ];
  }

  if (!chromeLauncher || chromeLauncherFlags.length === 0) {
    console.log('platform not supported!');
    return;
  }

  const webSocketUrl = await startChromeProcess(
    chromeLauncher,
    chromeLauncherFlags
  );

  const wsChromeEndpointUrl = webSocketUrl;
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
      }, 1000);
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
  await sleep(1000);
  await zoomOutButtonElement.click();
  await sleep(1000);
  await zoomOutButtonElement.click();
  await sleep(1000);
  await page.keyboard.press('ArrowLeft');
  await sleep(1000);
  await page.keyboard.press('ArrowLeft');
  await sleep(1000);
  await page.keyboard.press('ArrowLeft');
  await sleep(5000);

  console.log('Time Screenshot!');
  const bodyElement = await page.$('body');
  const bodyBoundingBox = await bodyElement.boundingBox();

  const now = moment().utc().unix();

  await bodyElement.screenshot({
    path: `./screenshots/${now}.png`,
    clip: {
      x: bodyBoundingBox.x,
      y: bodyBoundingBox.y,
      width: Math.min(bodyBoundingBox.width, page.viewport().width),
      height: Math.min(bodyBoundingBox.height, page.viewport().height),
    },
  });
}

async function startChromeProcess(chromeLauncher, chromeLauncherFlags) {
  console.log(`Running \n${chromeLauncher} ${chromeLauncherFlags.join(' ')}`);

  let chromeProcess = spawn(chromeLauncher, chromeLauncherFlags);

  return new Promise((resolve) => {
    chromeProcess.stderr.on('data', (data) => {
      const outputString = data.toString().trim();
      console.log(outputString);

      if (
        outputString.includes(
          'DevTools listening on ws://127.0.0.1:9222/devtools/browser/'
        )
      ) {
        console.log(outputString);
        const stringSplit = outputString.split(' ');
        const webSocketUrl = stringSplit[3];

        console.log('webSocketUrl: ' + webSocketUrl);

        resolve(webSocketUrl);
      }
    });
  });
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

cron.schedule('0,15,30,45 * * * *', () => {
  console.log('TIME TO RUN');
  getLatestScreenshot();
});
