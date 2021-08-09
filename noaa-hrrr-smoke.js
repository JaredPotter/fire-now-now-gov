const moment = require("moment");
const fs = require("fs-extra");

const NOAA_HRRR_SMOKE_URL = "https://hwp-viz.gsd.esrl.noaa.gov/smoke/#";

const SCREENSHOT_DIRECTORY = "./noaa-hrrr-smoke-screenshots";

const getNoaaHrrrSmokeScreenshots = async function (
  page,
  types = [],
  selectors = []
) {
  await page.goto(NOAA_HRRR_SMOKE_URL, {
    waitUntil: "networkidle0",
  });

  await sleep(1000);

  (await page.$("#map")).click();

  await sleep(250);

  await page.keyboard.press("ArrowLeft");
  await sleep(2000);
  await page.keyboard.press("ArrowLeft");
  await sleep(2000);
  await page.keyboard.press("ArrowLeft");
  await sleep(2000);
  await page.keyboard.press("ArrowLeft");
  await sleep(2000);
  await page.keyboard.press("ArrowUp");
  await sleep(2000);
  await page.keyboard.press("ArrowUp");
  await sleep(2000);
  await page.keyboard.press("+");
  await sleep(2000);
  await page.keyboard.press("+");
  await sleep(2000);

  // Turn on Fire Detections
  (await page.$("#hrrr_fire_detections-eye")).click();
  await sleep(1000);

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const selector = selectors[i];

    console.log("Fetching type " + type);

    (await page.$(selector)).click();

    await sleep(1000);

    let forecastDateTime = await page.evaluate(() => {
      const forecastDateTimeElements = document.querySelectorAll(
        "#modelrunselect option"
      );
      const lastForecastDateTimeElement =
        forecastDateTimeElements[forecastDateTimeElements.length - 1];

      const forecastDateTime = lastForecastDateTimeElement.text;

      return forecastDateTime;
    });

    forecastDateTime = forecastDateTime.replaceAll(":", "_");

    await sleep(10000);

    console.log("Time Screenshot!");
    const bodyElement = await page.$("body");
    const bodyBoundingBox = await bodyElement.boundingBox();

    const now = moment().utc().unix();

    const outputDirectory = `${SCREENSHOT_DIRECTORY}/${type}`;
    fs.ensureDirSync(outputDirectory);

    const outputFileName = `${outputDirectory}/${now}-${forecastDateTime}.png`;

    console.log("Now saving: " + outputFileName);

    await bodyElement.screenshot({
      path: outputFileName,
      clip: {
        x: bodyBoundingBox.x,
        y: bodyBoundingBox.y,
        width: Math.min(bodyBoundingBox.width, page.viewport().width),
        height: Math.min(bodyBoundingBox.height, page.viewport().height),
      },
    });

    // Toggle off.
    (await page.$(selector)).click();
    await sleep(1000);
  }
  console.log("NOAA HRRR SMOKE - DONE");

  return;
};

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

module.exports = {
  getNoaaHrrrSmokeScreenshots,
};
