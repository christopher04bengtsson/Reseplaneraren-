# 3D video studio (Three.js + Remotion)

Make 3D animated videos with **Three.js** (via React Three Fiber) and render them with
**Remotion**, which also handles **captions**, **audio** and **video encoding**.

## Requirements

- Node.js 18+ (tested with 22)
- FFmpeg is bundled with Remotion; a system `ffmpeg` is only needed for `npm run transcribe`

## Getting started

```bash
cd video
npm install
npm run dev        # opens Remotion Studio in the browser (live preview + timeline)
npm run render     # renders out/video.mp4
npm run still      # renders out/thumbnail.png
```

On a server without a GPU, add `-- --gl=swangle` to `render`/`still` so WebGL works headless.

## Project layout

| Path | What it is |
| --- | --- |
| `src/Root.tsx` | Registers compositions (id, size, fps, duration, default props) |
| `src/Main3DVideo.tsx` | The example video: 3D layer + title + captions + audio |
| `src/scenes/SpinningScene.tsx` | Example Three.js scene (meshes, lights, animation) |
| `src/Captions.tsx` | TikTok-style word-highlighted captions using `@remotion/captions` |
| `src/Title.tsx` | Animated 2D title overlay |
| `public/` | Assets: `audio.mp3` (placeholder tone), `captions.json` (sample captions) |
| `scripts/transcribe.mjs` | Generates `captions.json` from a voice-over with Whisper.cpp |
| `remotion.config.ts` | Render settings (image format, OpenGL backend) |

## Packages

- `remotion`, `@remotion/cli` – composition, timeline, Studio, rendering
- `three`, `@react-three/fiber`, `@react-three/drei` – 3D scenes and helpers
- `@remotion/three` – `<ThreeCanvas>` that syncs React Three Fiber with Remotion frames
- `@remotion/captions` – caption types and TikTok-style paging
- `@remotion/media` – `<Audio>` / `<Video>` components
- `@remotion/media-utils` – audio visualisation helpers (waveforms, `useAudioData`)
- `@remotion/install-whisper-cpp` – local speech-to-text for captions
- `zod` – typed, editable composition props in Studio

## Animating 3D the Remotion way

Drive everything from `useCurrentFrame()` (with `interpolate()` / `spring()`), **not** from
React Three Fiber's `useFrame()` or clock time. That keeps every frame deterministic, so the
preview and the rendered video match exactly.

```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
<mesh rotation={[0, (frame / fps) * Math.PI, 0]}>...</mesh>
```

Loading GLTF models: put the file in `public/` and use `useGLTF(staticFile("model.glb"))` from
`@react-three/drei`.

## Audio and captions

1. Put your voice-over or music in `public/` and set `audioFile` in `src/Root.tsx` (or in Studio's props panel).
2. Generate word-level captions from it:
   ```bash
   npm run transcribe -- public/voiceover.mp3 public/captions.json
   ```
   The first run downloads Whisper.cpp and a model (~1.5 GB) and builds it, so it takes a while.
   For Swedish or other languages, change `model` in `scripts/transcribe.mjs` to `"medium"` or `"large-v3"`.
3. Adjust `durationInFrames` in `src/Root.tsx` to match the audio length.
