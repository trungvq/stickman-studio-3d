// Luồng phụ của `check`: đo sâu từng cảnh luồng chính gửi sang — xem `deepScenes` trong lib.mjs
import { parentPort, workerData } from "node:worker_threads";
import { deepWorker } from "./lib.mjs";

await deepWorker(parentPort, workerData);
