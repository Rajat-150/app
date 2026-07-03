import { AbsoluteFill, useCurrentFrame } from "remotion";

export const MainVideo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A", color: "white", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 96 }}>Scene Studio · frame {frame}</div>
    </AbsoluteFill>
  );
};
