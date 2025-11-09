"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";
import { useTrailTexture } from "@react-three/drei";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform float u_time;
  uniform sampler2D u_trail;
  uniform vec3 u_color;
  varying vec2 vUv;

  float circle(vec2 uv, vec2 pos, float radius) {
    float d = length(uv - pos);
    return 1.0 - smoothstep(radius - 0.002, radius + 0.002, d);
  }

  void main() {
    vec2 uv = vUv;
    vec2 st = gl_FragCoord.xy / u_resolution.xy;

    // Create dot grid
    vec2 grid = fract(uv * 20.0);
    float dot = circle(grid, vec2(0.5), 0.05);

    // Sample trail texture
    vec4 trail = texture2D(u_trail, st);

    // Apply mouse interaction
    vec2 mouse = u_mouse / u_resolution;
    float mouseDist = length(st - mouse);
    float mouseInfluence = smoothstep(0.3, 0.0, mouseDist);

    // Combine effects
    float alpha = dot * (0.3 + trail.r * 0.7 + mouseInfluence * 0.5);

    gl_FragColor = vec4(u_color, alpha);
  }
`;

function DotShader() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const { theme } = useTheme();
  const mouseRef = useRef({ x: 0, y: 0 });

  // Trail texture for mouse interactions
  const [trailTexture, onMove] = useTrailTexture({
    size: 256,
    radius: 0.05,
    maxAge: 0.3,
    interpolate: 1,
    ease: (x: number) => Math.sqrt(1 - Math.pow(x - 1, 2)),
  });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current = {
        x: event.clientX,
        y: size.height - event.clientY,
      };
      onMove([event.clientX / size.width, 1 - event.clientY / size.height]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [size, onMove]);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_mouse: { value: new THREE.Vector2(0, 0) },
      u_trail: { value: trailTexture },
      u_color: { value: new THREE.Color(theme === "dark" ? "#ffffff" : "#000000") },
    }),
    [size, trailTexture, theme]
  );

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.u_time.value = state.clock.elapsedTime;
      material.uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
      material.uniforms.u_resolution.value.set(size.width, size.height);
      material.uniforms.u_trail.value = trailTexture;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[size.width, size.height, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function DotShaderBackground() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1, near: 0.1, far: 1000 }}
        style={{ width: "100%", height: "100%" }}
      >
        <DotShader />
      </Canvas>
    </div>
  );
}
