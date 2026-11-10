import { Composition } from "remotion";
import { Main3DVideo, main3DVideoSchema } from "./Main3DVideo";

export const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main3DVideo"
      component={Main3DVideo}
      durationInFrames={FPS * 8}
      fps={FPS}
      width={1920}
      height={1080}
      schema={main3DVideoSchema}
      defaultProps={{
        title: "Hello 3D",
        captionsFile: "captions.json",
        audioFile: "audio.mp3",
        color: "#4f8cff",
      }}
    />
  );
};
