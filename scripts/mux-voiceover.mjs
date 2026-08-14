#!/usr/bin/env node
/**
 * Mux AI voiceover narration into demo.webm.
 *
 * 3 narration clips generated via TTS, aligned to scene timings (total video 140s):
 *  - narration1 (~0-12s): opening — code dropped by caller
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FF = "/private/tmp/fftest/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg";
const WORK = path.join(__dirname, "..", "voiceover");
const SRC = path.join(__dirname, "..", "demo.webm");
const OUT = path.join(__dirname, "..", "demo-narrated.webm");

fs.mkdirSync(WORK, { recursive: true });

// ==== CONFIG: narration audio URLs (fill in from check_task results) ====
const NARRATIONS = [
  { name: "n1", url: "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/fal_minimax-tts/fa3c203f23fd621f029d9e6a56bb0882.mp3", offset: 5 },
  { name: "n2", url: "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/fal_minimax-tts/ae8b3095fa6983a7ab34eca94b3c7ccc.mp3", offset: 45 },
  { name: "n3", url: "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/fal_minimax-tts/4fff48f8cb1e458467cd0fd6acb49eb2.mp3", offset: 95 },
];

if (NARRATIONS.length === 0) {
  console.log("No narration URLs configured yet. Expected usage: edits URLs in this file then run.");
  process.exit(0);
}

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest;
  console.log(`Downloading ${dest} ...`);
  const http = await import("node:https");
  const w = fs.createWriteStream(dest);
  await new Promise((res, rej) => {
    http.default.get(url, (r) => { if (r.statusCode >= 400) return rej(new Error("HTTP " + r.statusCode)); r.pipe(w); w.on("finish", res); }).on("error", rej);
  });
  return dest;
}

function clause() {
  // Build an ffmpeg filter_complex that lays narration files onto a silent
  // background aligned to offsets.
  const files = NARRATIONS.map((n) => path.join(WORK, n.name + ".mp3"));
  const inputs = files.flatMap((f) => ["-i", f]);
  // adelay each audio at its offset
  const delays = NARRATIONS.map((n, k) =>
    `[${k + 1}:a]adelay=${Math.round(n.offset * 1000)}[a${k}]`
  ).join(";");
  const mixInputs = NARRATIONS.map((_, k) => `[a${k}]`).join("");
  const mix = `${mixInputs}amix=inputs=${NARRATIONS.length}:normalize=0,apad[mix]`;
  return { inputs, filter: `${delays};${mix}` };
}

// ==== EXECUTE ====
(async () => {
  for (const n of NARRATIONS) {
    const f = path.join(WORK, n.name + ".mp3");
    await download(n.url, f);
  }
  const { inputs, filter } = clause();
  const args = [
    FF, "-y", "-i", SRC, ...inputs,
    "-filter_complex", filter,
    "-map", "0:v", "-map", "[mix]",
    "-c:v", "copy", "-c:a", "libopus", "-b:a", "96k",
    "-shortest", OUT,
  ];
  console.log("ffmpeg " + args.slice(1).join(" "));
  execFileSync(FF, args.slice(1), { stdio: "inherit" });
  console.log("Output:", OUT);
})().catch(e => { console.error(e); process.exit(1); });