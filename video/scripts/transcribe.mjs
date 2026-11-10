// Transcribe an audio file into Remotion captions JSON using Whisper.cpp (runs locally).
// Usage: npm run transcribe -- public/voiceover.mp3 [public/captions.json]
// First run downloads and builds whisper.cpp + the model (~1.5 GB), which takes a few minutes.
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

const [input, output = "public/captions.json"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: npm run transcribe -- <audio-file> [output.json]");
  process.exit(1);
}

const whisperPath = path.join(process.cwd(), "whisper.cpp");
const model = "medium.en"; // use "medium" or "large-v3" for non-English audio

await installWhisperCpp({ to: whisperPath, version: "1.5.5" });
await downloadWhisperModel({ model, folder: whisperPath });

// Whisper needs 16 kHz mono WAV
const wav = path.join(whisperPath, "input-16khz.wav");
execSync(`ffmpeg -y -loglevel error -i "${input}" -ar 16000 -ac 1 "${wav}"`);

const whisperCppOutput = await transcribe({
  model,
  whisperPath,
  whisperCppVersion: "1.5.5",
  inputPath: wav,
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput });
fs.writeFileSync(output, JSON.stringify(captions, null, 2));
console.log(`Wrote ${captions.length} captions to ${output}`);
