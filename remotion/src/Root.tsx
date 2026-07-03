// Minimal Remotion root. Replace the MainVideo composition with your own.
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
