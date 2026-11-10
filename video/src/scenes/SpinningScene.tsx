import { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Color } from "three";

/**
 * Example 3D scene.
 *
 * IMPORTANT: inside a <ThreeCanvas>, drive every animation from
 * useCurrentFrame() — never from useFrame()/clock time — so that each
 * rendered frame is deterministic and the video renders correctly.
 */
export const SpinningScene: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 12 } });
  const rotation = (frame / fps) * Math.PI * 0.5;
  // Slow "dolly in": move the whole scene towards the camera over the video.
  const zoom = interpolate(frame, [0, durationInFrames], [0, 2]);

  const satellites = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
  const base = useMemo(() => new Color(color), [color]);

  return (
    <>
      <color attach="background" args={["#0b0f1a"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
      <pointLight position={[-5, -3, 2]} intensity={30} color="#ff6ad5" />

      <group position={[0, 0, zoom]}>
        {/* Hero object */}
        <mesh
          rotation={[rotation * 0.6, rotation, 0]}
          scale={entrance * 1.4}
        >
          <torusKnotGeometry args={[1, 0.32, 200, 32]} />
          <meshStandardMaterial color={base} metalness={0.6} roughness={0.25} />
        </mesh>

        {/* Orbiting satellites */}
        {satellites.map((i) => {
          const angle = rotation * 1.5 + (i / satellites.length) * Math.PI * 2;
          const delayed = spring({ frame: frame - 10 - i * 3, fps });
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * 3,
                Math.sin(angle * 2) * 0.5,
                Math.sin(angle) * 3,
              ]}
              scale={delayed * 0.25}
            >
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={base.clone().offsetHSL(i / satellites.length, 0, 0)}
                flatShading
              />
            </mesh>
          );
        })}
      </group>
    </>
  );
};
