import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { z } from "zod";
import { SpinningScene } from "./scenes/SpinningScene";
import { Captions } from "./Captions";
import { Title } from "./Title";

export const main3DVideoSchema = z.object({
  title: z.string(),
  /** JSON file in public/ containing a Caption[] array (see @remotion/captions) */
  captionsFile: z.string(),
  /** Audio file in public/ (mp3/wav/aac) */
  audioFile: z.string(),
  color: z.string(),
});

export const Main3DVideo: React.FC<z.infer<typeof main3DVideoSchema>> = ({
  title,
  captionsFile,
  audioFile,
  color,
}) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f1a" }}>
      {/* 3D layer: Three.js via React Three Fiber, synced to Remotion's timeline */}
      <ThreeCanvas
        linear
        width={width}
        height={height}
        camera={{ fov: 50, position: [0, 0, 7] }}
      >
        <SpinningScene color={color} />
      </ThreeCanvas>

      {/* 2D overlays */}
      <Title text={title} />
      <Captions file={captionsFile} />

      {/* Soundtrack / voice-over */}
      <Audio src={staticFile(audioFile)} />
    </AbsoluteFill>
  );
};
