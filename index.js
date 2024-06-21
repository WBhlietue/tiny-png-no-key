// How to use:
// Change image path and output path in index.js
// Install "request" module:
//                   npm i request
// Run command:
//                   node index.js

const fs = require("fs");
const request = require("request");
const path = require("path");

const paths = "./image/"; // images folder
const supportedTypes = ["png", "jpg", "jpeg", "webp"]; // supported image types
const outputFolder = "./output/"; // output folder
const iterationCount = 100; // how many times to compress
const detailedLog = true; // log detailed information or not
const timeStep = 10; //delay between each compression

const getRandomNumber = (min, max) => {
  return parseInt(Math.random() * (max - min) + min);
};
function generateIp() {
  let seg = [];
  for (let i = 0; i < 4; i++) {
    seg.push(getRandomNumber(0, 255));
  }
  return seg.join(".");
}

function CheckSupport(ext) {
  return supportedTypes.includes(ext.toLowerCase());
}

CompressInFolder(paths);

async function StartCompress(file) {
  const stats = await GetFileStats(file);
  CompressFile(file, iterationCount, stats.size, true);
}

function CompressInFolder(folder) {
  return new Promise(async (resolve, reject) => {
    let res = await FsReadDir(folder);

    Recursive(res, 0, folder);
    resolve();
  });
}

async function Recursive(list, index, folder) {
  if (index >= list.length) {
    return;
  }
  if (CheckSupport(list[index].split(".").pop())) {
    let stats = await GetFileStats(path.join(folder, list[index]));
    await Compress(
      path.join(folder, list[index]),
      iterationCount,
      stats.size,
      stats.size,
      stats.size,
      true
    );
  }
  Recursive(list, index + 1, folder);
}

function RequestTo(data) {
  return new Promise((res, rej) => {
    request(
      {
        url: "https://tinypng.com/backend/opt/shrink",
        method: "post",
        headers: {
          "x-forwarded-for": generateIp(),
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
        body: data,
      },
      function (error, response, body) {
        if (!error) {
          res(body);
        } else {
          rej(error);
        }
      }
    );
  });
}

function FsReadDir(url) {
  return new Promise((res, rej) => {
    fs.readdir(url, (err, data) => {
      res(data);
    });
  });
}

function GetFileStats(file) {
  return new Promise((res, rej) => {
    fs.stat(file, (err, stats) => {
      res(stats);
    });
  });
}

function ReadFile(file) {
  return new Promise((res, rej) => {
    fs.readFile(file, function (err, data) {
      if (err) {
        rej(err);
      } else {
        res(data);
      }
    });
  });
}

function RequestGet(url) {
  return new Promise((res, rej) => {
    request.get(
      {
        url: url,
        encoding: null,
      },
      (err, r, body) => {
        if (err) {
          rej(err);
        } else {
          res(body.toString("base64"));
        }
      }
    );
  });
}

function WriteFile(file, data) {
  return new Promise((res, rej) => {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    fs.writeFile(file, data, "base64", (err) => {
      res();
    });
  });
}

async function Pause(time) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res();
    }, time);
  });
}

async function Compress(
  file,
  iterationCount,
  preSize1,
  preSize2,
  initSize,
  isFirst = false
) {
  async function LoadAgain() {
    console.log("                  retrying " + file);
    await Compress(file, iterationCount, preSize1, preSize2, initSize, isFirst);
  }
  async function Next(outSize, path) {
    await Compress(
      path,
      iterationCount - 1,
      preSize2,
      outSize,
      initSize,
      false
    );
  }
  await Pause(timeStep);
  const data = await ReadFile(file);
  const res = await RequestTo(data);
  let result;
  try {
    result = JSON.parse(res);
  } catch {
    await LoadAgain();
    return;
  }
  if (result.output && result.output.url) {
    const base64 = await RequestGet(result.output.url);
    const fileName = path.basename(file);
    await WriteFile(path.join(outputFolder, fileName), base64);

    if (detailedLog) {
      console.log(
        "complete: " +
          fileName +
          " -> " +
          (iterationCount - 1) +
          " more times -> " +
          "old size: " +
          result.input.size +
          " bytes, new size: " +
          result.output.size +
          " bytes, saved: " +
          (result.input.size - result.output.size) +
          " bytes"
      );
    }
    if (result.input.size == result.output.size) {
      const stats = await GetFileStats(file);
      console.log(
        " >>>> " +
          file +
          " -> " +
          initSize +
          " bytes" +
          " -> " +
          stats.size +
          " bytes, saved: " +
          (initSize - stats.size) +
          " bytes, " +
          "Rate: " +
          (((initSize - stats.size) / initSize) * 100).toFixed(2) +
          "%"
      );
      return;
    }
    if (iterationCount > 1)
      await Next(result.output.size, path.join(outputFolder, fileName));
  } else {
    await LoadAgain();
  }
}
