// REACT NATIVE: Has DOM dependencies (requestAnimationFrame, Three.js). Needs RN adapter.
// useAnimation.ts — Interpolation logic for treatment step animation.

import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import type { TreatmentStep, ToothTransform } from '../types/treatment.types';

export interface InterpolatedTransform {
  fdi_number: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

interface UseAnimationResult {
  currentStep: number;        // float: 0.0 to totalSteps
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setStep: (step: number) => void;
  setSpeed: (speed: number) => void;
  interpolatedTransforms: InterpolatedTransform[];
}

function getTransformForTooth(
  step: TreatmentStep | undefined,
  fdi: number,
): ToothTransform {
  const t = step?.transforms.find((t) => t.fdi_number === fdi);
  return t ?? { fdi_number: fdi, pos_x: 0, pos_y: 0, pos_z: 0, rot_x: 0, rot_y: 0, rot_z: 0 };
}

function lerpTransforms(
  steps: TreatmentStep[],
  teethFdi: number[],
  progress: number,
): InterpolatedTransform[] {
  if (steps.length === 0) {
    return teethFdi.map((fdi) => ({
      fdi_number: fdi,
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
    }));
  }

  const stepIdx = Math.floor(progress);
  const t = progress - stepIdx; // 0..1 fraction between steps

  const fromStep = steps.find((s) => s.step_number === stepIdx);
  const toStep = steps.find((s) => s.step_number === stepIdx + 1);

  return teethFdi.map((fdi) => {
    const from = getTransformForTooth(fromStep, fdi);
    const to = toStep ? getTransformForTooth(toStep, fdi) : from;

    // Lerp position
    const position = new THREE.Vector3(
      from.pos_x + (to.pos_x - from.pos_x) * t,
      from.pos_y + (to.pos_y - from.pos_y) * t,
      from.pos_z + (to.pos_z - from.pos_z) * t,
    );

    // Slerp rotation (convert degrees to radians, use quaternions)
    const deg2rad = Math.PI / 180;
    const qFrom = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(from.rot_x * deg2rad, from.rot_y * deg2rad, from.rot_z * deg2rad),
    );
    const qTo = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(to.rot_x * deg2rad, to.rot_y * deg2rad, to.rot_z * deg2rad),
    );
    const qResult = new THREE.Quaternion().slerpQuaternions(qFrom, qTo, t);
    const rotation = new THREE.Euler().setFromQuaternion(qResult);

    return { fdi_number: fdi, position, rotation };
  });
}

export function useAnimation(
  steps: TreatmentStep[],
  teethFdi: number[],
): UseAnimationResult {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const maxStep = steps.length > 0 ? Math.max(...steps.map((s) => s.step_number)) : 0;

  // Animation loop
  useEffect(() => {
    if (!isPlaying || maxStep === 0) return;

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = time;

      setCurrentStep((prev) => {
        const next = prev + delta * speed;
        if (next >= maxStep) {
          setIsPlaying(false);
          return maxStep;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, maxStep, speed]);

  const play = useCallback(() => {
    if (currentStep >= maxStep) setCurrentStep(0);
    setIsPlaying(true);
  }, [currentStep, maxStep]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const interpolatedTransforms = lerpTransforms(steps, teethFdi, currentStep);

  return {
    currentStep,
    isPlaying,
    speed,
    play,
    pause,
    toggle,
    setStep: setCurrentStep,
    setSpeed,
    interpolatedTransforms,
  };
}
