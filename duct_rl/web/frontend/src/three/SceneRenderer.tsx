import React, { useRef, useMemo, useLayoutEffect, useState, useCallback, createContext, useContext } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore, ObstacleBox, CustomLayout } from "../store/useSimStore";

// Shared ref so draggables can disable OrbitControls
const OrbitControlsRefContext = createContext<React.RefObject<any> | null>(null);

// ── Shared drag logic ──────────────────────────────────────────────────────

function useDragOnPlane(
  onDrag: (worldPos: THREE.Vector3) => void,
  onEnd?: () => void,
) {
  const { camera, gl } = useThree();
  const orbitRef = useContext(OrbitControlsRefContext);
  const dragging = useRef(false);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const intersection = useRef(new THREE.Vector3());

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    if (orbitRef?.current) orbitRef.current.enabled = false;
    plane.current.set(new THREE.Vector3(0, 1, 0), -e.point.y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [orbitRef]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.current.setFromCamera(mouse, camera);
    if (raycaster.current.ray.intersectPlane(plane.current, intersection.current)) {
      onDrag(intersection.current);
    }
  }, [camera, gl, onDrag]);

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (orbitRef?.current) orbitRef.current.enabled = true;
    e.stopPropagation();
    onEnd?.();
  }, [onEnd, orbitRef]);

  return { onPointerDown, onPointerMove, onPointerUp, isDragging: dragging };
}

// ── Draggable point (start / target) ───────────────────────────────────────

function DraggablePoint({
  position,
  color,
  size,
  onMove,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  onMove: (x: number, y: number, z: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const handleDrag = useCallback((pos: THREE.Vector3) => {
    // Three.js Y-up → world coords: three(x,y,z) = world(x,z,y)
    onMove(pos.x, pos.z, pos.y);
  }, [onMove]);

  const { onPointerDown, onPointerMove, onPointerUp } = useDragOnPlane(handleDrag);

  return (
    <mesh
      position={position}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={hovered ? "#ffffff" : color}
        emissive={color}
        emissiveIntensity={hovered ? 0.6 : 0.3}
      />
    </mesh>
  );
}

// ── Draggable obstacle box ─────────────────────────────────────────────────

function DraggableObstacle({
  box,
  index,
  onMove,
}: {
  box: ObstacleBox;
  index: number;
  onMove: (index: number, dx: number, dy: number, dz: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const startDragWorld = useRef(new THREE.Vector3());
  const origBox = useRef(box);

  const sx = box.x_max - box.x_min;
  const sy = box.y_max - box.y_min;
  const sz = box.z_max - box.z_min;
  const cx = box.x_min + sx / 2;
  const cy = box.y_min + sy / 2;
  const cz = box.z_min + sz / 2;

  const handleDrag = useCallback((pos: THREE.Vector3) => {
    // Three.js (x,y,z) → world (x,z,y)
    const dx = pos.x - startDragWorld.current.x;
    const dy = pos.z - startDragWorld.current.z;
    const dz = pos.y - startDragWorld.current.y;
    onMove(index, dx, dy, dz);
  }, [index, onMove]);

  const { onPointerDown: basePD, onPointerMove, onPointerUp } = useDragOnPlane(handleDrag);

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    startDragWorld.current.set(e.point.x, e.point.y, e.point.z);
    origBox.current = box;
    basePD(e);
  }, [basePD, box]);

  // Position in Three.js coords: swap Y↔Z
  return (
    <mesh
      position={[cx, cz, cy]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[sx, sz, sy]} />
      <meshStandardMaterial
        color={hovered ? "#ff8844" : "#ff6633"}
        transparent
        opacity={hovered ? 0.6 : 0.4}
      />
    </mesh>
  );
}

// ── Voxelized obstacles (read-only, from WASM) ────────────────────────────

function VoxelObstacles() {
  const obstaclePositions = useSimStore((s) => s.obstaclePositions);
  const sceneInfo = useSimStore((s) => s.sceneInfo);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // This has to be a layout effect, not useMemo. The matrices are written
  // through meshRef, and React only populates a ref at commit — during render
  // it is still null. So the first Build Scene wrote nothing, the mesh kept
  // its identity matrices, and every obstacle voxel collapsed onto the
  // origin. It only looked correct after a second build, when the ref
  // happened to still hold the previous render's mesh.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !obstaclePositions || !sceneInfo) return;

    const vs = sceneInfo.voxel_size;
    const count = obstaclePositions.length / 3;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(vs * 0.95, vs * 0.95, vs * 0.95);

    for (let i = 0; i < count; i++) {
      matrix.makeTranslation(
        obstaclePositions[i * 3],
        obstaclePositions[i * 3 + 2],
        obstaclePositions[i * 3 + 1]
      );
      matrix.scale(scale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [obstaclePositions, sceneInfo]);

  if (!obstaclePositions || !sceneInfo) return null;
  const count = obstaclePositions.length / 3;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#444" transparent opacity={0.25} />
    </instancedMesh>
  );
}

// ── Start / Target markers ─────────────────────────────────────────────────

function StartTarget() {
  const sceneInfo = useSimStore((s) => s.sceneInfo);
  const layoutMode = useSimStore((s) => s.layoutMode);
  const customLayout = useSimStore((s) => s.customLayout);
  const setCustomLayout = useSimStore((s) => s.setCustomLayout);

  if (!sceneInfo) return null;

  const vs = sceneInfo.voxel_size;
  const [ox, oy, oz] = sceneInfo.origin;
  const [sx, sy, sz] = sceneInfo.start_ijk;
  const [tx, ty, tz] = sceneInfo.target_ijk;

  const startPos: [number, number, number] = [
    ox + (sx + 0.5) * vs,
    oz + (sz + 0.5) * vs,
    oy + (sy + 0.5) * vs,
  ];
  const targetPos: [number, number, number] = [
    ox + (tx + 0.5) * vs,
    oz + (tz + 0.5) * vs,
    oy + (ty + 0.5) * vs,
  ];

  if (layoutMode === "custom") {
    return (
      <>
        <DraggablePoint
          position={startPos}
          color="#32cd32"
          size={vs * 0.4}
          onMove={(x, y, z) => {
            setCustomLayout({
              ...customLayout,
              start: [
                Math.round(x * 10) / 10,
                Math.round(y * 10) / 10,
                Math.round(z * 10) / 10,
              ],
            });
          }}
        />
        <DraggablePoint
          position={targetPos}
          color="#ff3333"
          size={vs * 0.4}
          onMove={(x, y, z) => {
            setCustomLayout({
              ...customLayout,
              target: [
                Math.round(x * 10) / 10,
                Math.round(y * 10) / 10,
                Math.round(z * 10) / 10,
              ],
            });
          }}
        />
      </>
    );
  }

  return (
    <>
      <mesh position={startPos}>
        <sphereGeometry args={[vs * 0.4, 16, 16]} />
        <meshStandardMaterial color="#32cd32" emissive="#32cd32" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={targetPos}>
        <sphereGeometry args={[vs * 0.4, 16, 16]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff3333" emissiveIntensity={0.3} />
      </mesh>
    </>
  );
}

// ── Custom layout obstacle handles ─────────────────────────────────────────

function CustomObstacles() {
  const customLayout = useSimStore((s) => s.customLayout);
  const setCustomLayout = useSimStore((s) => s.setCustomLayout);

  const handleMove = useCallback((index: number, dx: number, dy: number, dz: number) => {
    const state = useSimStore.getState();
    const layout = state.customLayout;
    const obs = [...layout.obstacles];
    const orig = obs[index];
    obs[index] = {
      x_min: Math.round((orig.x_min + dx) * 10) / 10,
      y_min: Math.round((orig.y_min + dy) * 10) / 10,
      z_min: Math.round((orig.z_min + dz) * 10) / 10,
      x_max: Math.round((orig.x_max + dx) * 10) / 10,
      y_max: Math.round((orig.y_max + dy) * 10) / 10,
      z_max: Math.round((orig.z_max + dz) * 10) / 10,
    };
    state.setCustomLayout({ ...layout, obstacles: obs });
  }, []);

  return (
    <>
      {customLayout.obstacles.map((box, i) => (
        <DraggableObstacle key={i} box={box} index={i} onMove={handleMove} />
      ))}
    </>
  );
}

// ── Agent path ─────────────────────────────────────────────────────────────

function AgentPath() {
  const path = useSimStore((s) => s.path);
  const sceneInfo = useSimStore((s) => s.sceneInfo);
  const isDone = useSimStore((s) => s.isDone);
  const reachedTarget = useSimStore((s) => s.reachedTarget);

  if (!sceneInfo || path.length < 2) return null;

  const vs = sceneInfo.voxel_size;
  const [ox, oy, oz] = sceneInfo.origin;

  const points: [number, number, number][] = path.map(([px, py, pz]) => [
    ox + (px + 0.5) * vs,
    oz + (pz + 0.5) * vs,
    oy + (py + 0.5) * vs,
  ]);

  const color = isDone ? (reachedTarget ? "#32cd32" : "#ff6666") : "#4488ff";

  return (
    <>
      <Line points={points} color={color} lineWidth={3} />
      {path.length > 0 && (
        <mesh position={points[points.length - 1]}>
          <sphereGeometry args={[vs * 0.25, 12, 12]} />
          <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={0.5} />
        </mesh>
      )}
    </>
  );
}

// ── Room wireframe box ─────────────────────────────────────────────────────

function RoomBox() {
  const sceneInfo = useSimStore((s) => s.sceneInfo);
  if (!sceneInfo) return null;

  const { nx, ny, nz, voxel_size: vs, origin } = sceneInfo;
  const [ox, oy, oz] = origin;

  return (
    <mesh
      position={[
        ox + (nx * vs) / 2,
        oz + (nz * vs) / 2,
        oy + (ny * vs) / 2,
      ]}
    >
      <boxGeometry args={[nx * vs, nz * vs, ny * vs]} />
      <meshBasicMaterial color="#333" wireframe transparent opacity={0.3} />
    </mesh>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────

function SceneContents() {
  const sceneInfo = useSimStore((s) => s.sceneInfo);
  const layoutMode = useSimStore((s) => s.layoutMode);
  const orbitRef = useRef<any>(null);

  const target = useMemo(() => {
    if (!sceneInfo) return [5, 1.5, 5] as [number, number, number];
    const { nx, ny, nz, voxel_size: vs, origin } = sceneInfo;
    const [ox, oy, oz] = origin;
    return [
      ox + (nx * vs) / 2,
      oz + (nz * vs) / 2,
      oy + (ny * vs) / 2,
    ] as [number, number, number];
  }, [sceneInfo]);

  return (
    <OrbitControlsRefContext.Provider value={orbitRef}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <pointLight position={[-10, 10, -10]} intensity={0.3} />

      <RoomBox />
      <VoxelObstacles />
      <StartTarget />
      <AgentPath />
      {layoutMode === "custom" && <CustomObstacles />}

      <gridHelper args={[50, 50, "#222", "#181818"]} />
      <OrbitControls ref={orbitRef} target={target} />
    </OrbitControlsRefContext.Provider>
  );
}

export default function SceneRenderer() {
  return (
    <Canvas
      camera={{ position: [20, 15, 20], fov: 50, near: 0.1, far: 200 }}
      style={{ background: "#0a0a0f" }}
    >
      <SceneContents />
    </Canvas>
  );
}
