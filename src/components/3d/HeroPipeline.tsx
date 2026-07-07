import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';

interface HeroPipelineProps {
  queryVolume?: number;
  percentSolved?: number;
}

const BlockStream = ({ queryVolume = 1000, percentSolved = 0.8 }: HeroPipelineProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  const blockCount = useMemo(() => Math.max(20, Math.floor(queryVolume / 30)), [queryVolume]);

  const blocks = useMemo(() => {
    return Array.from({ length: blockCount }).map(() => ({
      position: new THREE.Vector3(
        4.5 + (Math.random() * 1.5), // x start (at Users container)
        -0.5 + (Math.random() - 0.5) * 2, // y spread
        (Math.random() - 0.5) * 1.5 // z spread
      ),
      speed: Math.random() * 0.02 + 0.015,
      rotationSpeed: new THREE.Vector3(
        Math.random() * 0.05,
        Math.random() * 0.05,
        Math.random() * 0.05
      ),
      originalY: 0,
      originalZ: 0,
      isHuman: Math.random() > percentSolved,
      state: 'INCOMING' // INCOMING, AI_REPLY, TO_HUMAN, HUMAN_REPLY, TO_RESOLVED
    }));
  }, [blockCount, percentSolved]);

  blocks.forEach(b => {
    b.originalY = b.position.y;
    b.originalZ = b.position.z;
  });

  const greyColor = useMemo(() => new THREE.Color('#9CA3AF'), []);
  const emeraldColor = useMemo(() => new THREE.Color('#10B981'), []);
  const emeraldEmissive = useMemo(() => new THREE.Color('#059669'), []);
  const amberColor = useMemo(() => new THREE.Color('#F59E0B'), []);
  const amberEmissive = useMemo(() => new THREE.Color('#D97706'), []);
  const blueColor = useMemo(() => new THREE.Color('#3B82F6'), []);
  const blueEmissive = useMemo(() => new THREE.Color('#2563EB'), []);
  const blackEmissive = useMemo(() => new THREE.Color('#000000'), []);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const blockData = blocks[i];
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;

        // Recycle logic: if they reach Users again or Resolved Container
        if (
          (blockData.state.includes('REPLY') && child.position.x > 4.5) || 
          (blockData.state === 'TO_RESOLVED' && child.position.y > 3.5)
        ) {
          child.position.x = 4.5 + Math.random();
          child.position.y = blockData.originalY;
          child.position.z = blockData.originalZ;
          blockData.state = 'INCOMING';
          
          mat.color.copy(greyColor);
          mat.emissive.copy(blackEmissive);
          mat.emissiveIntensity = 0;
          return;
        } 

        // Emissive pulse fade out
        if (mat.emissiveIntensity > 0.5) {
          mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.5, 0.05);
        }

        // Spin
        child.rotation.x += blockData.rotationSpeed.x;
        child.rotation.y += blockData.rotationSpeed.y;
        child.rotation.z += blockData.rotationSpeed.z;

        // INCOMING from Users to AI Wall
        if (blockData.state === 'INCOMING') {
          child.position.x -= blockData.speed;
          
          // Hit AI Wall at X = 1.5
          if (child.position.x <= 1.5) {
            if (!blockData.isHuman) {
              // 50% chance to animate as Reply, 50% chance as Resolved
              if (Math.random() > 0.5) {
                blockData.state = 'AI_REPLY';
                mat.color.copy(emeraldColor);
                mat.emissive.copy(emeraldEmissive);
                mat.emissiveIntensity = 2.5; // Flash!
              } else {
                blockData.state = 'TO_RESOLVED';
                mat.color.copy(blueColor);
                mat.emissive.copy(blueEmissive);
                mat.emissiveIntensity = 2.5;
              }
            } else {
              blockData.state = 'TO_HUMAN';
              mat.color.copy(amberColor);
              mat.emissive.copy(amberEmissive);
              mat.emissiveIntensity = 2.5; // Flash!
            }
          }
        } 
        
        // AI replying back to Users
        else if (blockData.state === 'AI_REPLY') {
          child.position.x += blockData.speed * 1.5; // fly back to right
        }
        
        // Going from AI to Human Wall
        else if (blockData.state === 'TO_HUMAN') {
          child.position.x -= blockData.speed; // keep moving left
          child.position.y = THREE.MathUtils.lerp(child.position.y, -1.5, 0.02); // drop down
          
          // Hit Human Wall at X = -2.4
          if (child.position.x <= -2.4) {
            if (Math.random() > 0.5) {
              blockData.state = 'HUMAN_REPLY';
              mat.color.copy(emeraldColor);
              mat.emissive.copy(emeraldEmissive);
              mat.emissiveIntensity = 2.5; // Flash!
            } else {
              blockData.state = 'TO_RESOLVED';
              mat.color.copy(blueColor);
              mat.emissive.copy(blueEmissive);
              mat.emissiveIntensity = 2.5;
            }
          }
        }
        
        // Human replying back to Users
        else if (blockData.state === 'HUMAN_REPLY') {
          child.position.x += blockData.speed * 1.5; // fly back to right
          child.position.y = THREE.MathUtils.lerp(child.position.y, 0, 0.01);
        }
        
        // Going UP to Resolved Container
        else if (blockData.state === 'TO_RESOLVED') {
          child.position.y += blockData.speed * 1.5; // shoot straight up
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {blocks.map((b, i) => (
        <RoundedBox key={i} args={[0.25, 0.25, 0.25]} radius={0.05} position={b.position}>
          <meshStandardMaterial color="#9CA3AF" roughness={0.8} />
        </RoundedBox>
      ))}
    </group>
  );
};

export default function HeroPipeline({ queryVolume = 1000, percentSolved = 0.8 }: HeroPipelineProps) {
  return (
    <div className="w-full h-full relative pointer-events-none">
      <Canvas camera={{ position: [0, 1, 13], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} color="#002E23" />
        
        <Float speed={2} rotationIntensity={0.05} floatIntensity={0.1}>
          <group rotation={[0, 0, 0]}>
              
              {/* RESOLVED QUERIES CONTAINER (Top) */}
              <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.2} floatingRange={[-0.1, 0.1]}>
                <RoundedBox args={[7, 1.5, 1]} radius={0.2} position={[-0.5, 3.5, 0]}>
                  <meshPhysicalMaterial color="#ffffff" transmission={0.9} transparent opacity={1} roughness={0.2} ior={1.5} thickness={0.5} />
                </RoundedBox>
                <Html position={[-0.5, 3.5, 0.6]} center className="pointer-events-none">
                  <div className="text-sm font-bold text-emerald-900 uppercase tracking-widest drop-shadow-md">
                    Resolved Queries
                  </div>
                </Html>
              </Float>

              {/* USERS CONTAINER (Right) */}
              <Float speed={2} rotationIntensity={0.05} floatIntensity={0.2} floatingRange={[-0.1, 0.1]}>
                <RoundedBox args={[2, 5, 2]} radius={0.2} position={[5.5, -0.5, 0]}>
                  <meshPhysicalMaterial color="#ffffff" transmission={0.9} transparent opacity={1} roughness={0.2} ior={1.5} thickness={0.5} />
                </RoundedBox>
                <Html position={[5.5, -0.5, 1.1]} center className="pointer-events-none">
                  <div className="text-sm font-bold text-emerald-900 uppercase tracking-widest drop-shadow-md">
                    Users
                  </div>
                </Html>
              </Float>

              {/* WALL 1: AI FAQs RAGS (X = 1.5) */}
              <RoundedBox args={[0.3, 4, 2]} radius={0.1} position={[1.5, -0.5, 0]}>
                <meshPhysicalMaterial color="#004d3a" transmission={0.95} transparent opacity={1} roughness={0.1} ior={1.5} thickness={1} />
              </RoundedBox>
              <Html position={[1.5, -3, 0]} center className="pointer-events-none">
                <div className="bg-emerald-50 px-3 py-1.5 rounded-md shadow-lg border border-emerald-200 text-[11px] font-bold text-emerald-900 whitespace-nowrap text-center">
                  Flought AI<br/>FAQs RAGS
                </div>
              </Html>

              {/* WALL 2: Human Handover (X = -2) */}
              <RoundedBox args={[0.3, 4, 2]} radius={0.1} position={[-2.5, -0.5, 0]}>
                <meshPhysicalMaterial color="#fb923c" transmission={0.95} transparent opacity={1} roughness={0.1} ior={1.5} thickness={1} />
              </RoundedBox>
              <Html position={[-2.5, -3, 0]} center className="pointer-events-none">
                <div className="bg-amber-50 px-3 py-1.5 rounded-md shadow-lg border border-amber-200 text-[11px] font-bold text-amber-900 whitespace-nowrap text-center">
                  Human Handover
                </div>
              </Html>

              {/* ARROW LABELS (Based on diagram) */}
              {/* Users to AI */}
              <Html position={[3.5, 1.2, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-sm font-black leading-none mb-1">←</span>
                  <span className="text-slate-500 text-xl font-black tracking-tight leading-none drop-shadow-sm">Query</span>
                </div>
              </Html>
              <Html position={[3.5, -1.5, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-emerald-500 text-sm font-black leading-none mb-1">→</span>
                  <span className="text-emerald-500 text-base font-black tracking-tight leading-none text-center drop-shadow-sm">Automatic<br/>Reply</span>
                </div>
              </Html>

              {/* AI to Resolved */}
              <Html position={[1.5, 1.8, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-sm font-black leading-none mb-1">↑</span>
                  <span className="text-slate-500 text-sm font-black tracking-tight leading-none drop-shadow-sm">Query</span>
                </div>
              </Html>

              {/* AI to Human */}
              <Html position={[-0.5, 0.2, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-sm font-black leading-none mb-1">←</span>
                  <span className="text-slate-500 text-sm font-black tracking-tight leading-none drop-shadow-sm">Query</span>
                </div>
              </Html>
              <Html position={[-0.5, -2.0, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-emerald-500 text-sm font-black leading-none mb-1">→</span>
                  <span className="text-emerald-500 text-base font-black tracking-tight leading-none text-center drop-shadow-sm">Human<br/>Agent</span>
                </div>
              </Html>

              {/* Human to Resolved */}
              <Html position={[-2.5, 1.8, 0.5]} center className="pointer-events-none">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-sm font-black leading-none mb-1">↑</span>
                  <span className="text-slate-500 text-sm font-black tracking-tight leading-none drop-shadow-sm">Query</span>
                </div>
              </Html>

              {/* The physical flow of data blocks */}
              <BlockStream queryVolume={queryVolume} percentSolved={percentSolved} />
          </group>
        </Float>
      </Canvas>
    </div>
  );
}
