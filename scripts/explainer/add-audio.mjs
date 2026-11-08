// Lays a music track under the silent explainer video. Nothing else changes:
// the picture is copied as it is, so there is no re-recording or re-encoding.
//
//   node scripts/explainer/add-audio.mjs <track> [input] [output]
//
// <track>   any audio file ffmpeg reads (mp3, m4a, wav…)
// [input]   the silent video (default public/explainer.mp4)
// [output]  default explainer-with-audio.mp4 in the current folder
//
// The track is cut to the video's length, fades in over 1 s and out over the
// last 2.5 s, and is padded with silence if it is shorter. AAC 160k. Needs
// ffmpeg and ffprobe on the PATH. Check the result, then copy it over
// public/explainer.mp4 (and update CLAUDE.md: the video is no longer silent).
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const [track, input = "public/explainer.mp4", output = "explainer-with-audio.mp4"] = process.argv.slice(2);
if (!track) {
  console.error("usage: node scripts/explainer/add-audio.mjs <track> [input] [output]");
  process.exit(1);
}
for (const f of [track, input]) {
  if (!fs.existsSync(f)) {
    console.error(`not found: ${f}`);
    process.exit(1);
  }
}

const duration = Number(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", input])
    .toString()
    .trim(),
);
if (!(duration > 0)) {
  console.error("could not read the video's length");
  process.exit(1);
}
const fadeOut = Math.max(0, duration - 2.5).toFixed(2);

execFileSync(
  "ffmpeg",
  [
    "-v", "error", "-y",
    "-i", input,
    "-i", track,
    "-filter_complex",
    `[1:a]atrim=0:${duration.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:d=1,afade=t=out:st=${fadeOut}:d=2.5,apad[a]`,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "160k",
    "-shortest",
    "-movflags", "+faststart",
    output,
  ],
  { stdio: "inherit" },
);
console.log(`${output}: ${(fs.statSync(output).size / 1e6).toFixed(2)} MB, ${duration.toFixed(1)} s`);
