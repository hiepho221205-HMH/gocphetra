import React, { createContext, useContext, useMemo } from 'react';
import {
  createMotionTokens,
  spring as staticSpring,
  transition as staticTransition,
  ease as staticEase,
  blur as staticBlur,
  scale as staticScale,
  shift as staticShift,
  stagger as staticStagger
} from '@animate-ui/react/utils/motion';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

// Default static tokens at tempo 1
const defaultTokens = createMotionTokens(1);

const AnimateUIContext = createContext(defaultTokens);

/**
 * AnimateUIProvider - React 18 compatible provider for Animate UI motion tokens
 * Manages motion pace (tempo) and integrates seamlessly with motion/react primitives
 */
export function AnimateUIProvider({ tempo = 1, children }) {
  const outer = useContext(AnimateUIContext);
  const pace = tempo ?? outer?.tempo ?? 1;
  const tokens = useMemo(() => (pace === outer?.tempo ? outer : createMotionTokens(pace)), [pace, outer]);

  return React.createElement(AnimateUIContext.Provider, { value: tokens }, children);
}

/**
 * useMotionTokens - Access current motion tokens paced by AnimateUIProvider
 */
export function useMotionTokens() {
  const ctx = useContext(AnimateUIContext);
  return ctx || defaultTokens;
}

// Re-export static motion tokens
export {
  staticSpring as spring,
  staticTransition as transition,
  staticEase as ease,
  staticBlur as blur,
  staticScale as scale,
  staticShift as shift,
  staticStagger as stagger,
  motion,
  AnimatePresence,
  useReducedMotion
};
