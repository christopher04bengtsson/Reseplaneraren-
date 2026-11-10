import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";

// How long a caption "page" may span before a new one starts.
const SWITCH_CAPTIONS_EVERY_MS = 1200;

/** Loads a Caption[] JSON file from public/ and renders word-highlighted captions. */
export const Captions: React.FC<{ file: string }> = ({ file }) => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender(`Loading captions ${file}`));
  const { fps } = useVideoConfig();

  const load = useCallback(async () => {
    try {
      const res = await fetch(staticFile(file));
      setCaptions((await res.json()) as Caption[]);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [file, handle]);

  useEffect(() => {
    load();
  }, [load]);

  const { pages } = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions: captions ?? [],
        combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
      }),
    [captions],
  );

  if (!captions) return null;

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const next = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = Math.min(
          next ? Math.round((next.startMs / 1000) * fps) : Infinity,
          startFrame + Math.round((SWITCH_CAPTIONS_EVERY_MS / 1000) * fps),
        );
        const duration = endFrame - startFrame;
        if (duration <= 0) return null;
        return (
          <Sequence key={index} from={startFrame} durationInFrames={duration} layout="none">
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Time relative to the start of this page's Sequence, made absolute.
  const absoluteMs = page.startMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}>
      <div
        style={{
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontSize: 72,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          whiteSpace: "pre",
          WebkitTextStroke: "10px black",
          paintOrder: "stroke",
        }}
      >
        {page.tokens.map((t) => {
          const active = t.fromMs <= absoluteMs && t.toMs > absoluteMs;
          return (
            <span key={t.fromMs} style={{ color: active ? "#ffd84f" : "white" }}>
              {t.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
