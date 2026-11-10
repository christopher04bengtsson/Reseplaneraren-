import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const Title: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20, 70, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 80 }}>
      <h1
        style={{
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontSize: 110,
          fontWeight: 800,
          color: "white",
          margin: 0,
          opacity,
          transform: `translateY(${y}px)`,
          textShadow: "0 8px 30px rgba(0,0,0,0.6)",
        }}
      >
        {text}
      </h1>
    </AbsoluteFill>
  );
};
