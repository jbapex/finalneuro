import React from 'react';
import { Composition, registerRoot } from 'remotion';
import NeuroMotionComposition from '../components/neuro-motion/NeuroMotionComposition.jsx';
import {
  NEURO_MOTION_COMPOSITION_ID,
  NEURO_MOTION_DURATION_FRAMES,
  NEURO_MOTION_FPS,
  NEURO_MOTION_FORMAT_PRESETS,
  NEURO_MOTION_HEIGHT,
  NEURO_MOTION_WIDTH,
} from '../lib/neuroMotion/constants.js';

const defaultProps = {
  format: 'youtube',
  transitionFrames: 10,
  scenes: [
    {
      title: 'NeuroMotion',
      subtitle: 'Videos programaticos com React + IA',
      accentColor: '#7c3aed',
      backgroundColor: '#0f172a',
      durationSec: 3,
    },
  ],
};

const getDynamicDuration = ({ props, defaultDurationInFrames, fps }) => {
  const scenes = Array.isArray(props?.scenes) ? props.scenes : [];
  if (!scenes.length) return defaultDurationInFrames;
  const total = scenes.reduce((acc, s) => {
    const sec = Number(s?.durationSec);
    return acc + (Number.isFinite(sec) && sec > 0 ? sec : 3);
  }, 0);
  return Math.max(15, Math.round(total * fps));
};

const getDynamicFormat = (props) => {
  const key = String(props?.format || 'youtube');
  const preset = NEURO_MOTION_FORMAT_PRESETS[key] || NEURO_MOTION_FORMAT_PRESETS.youtube;
  return { width: preset.width, height: preset.height };
};

registerRoot(() => (
  <>
    <Composition
      id={NEURO_MOTION_COMPOSITION_ID}
      component={NeuroMotionComposition}
      durationInFrames={NEURO_MOTION_DURATION_FRAMES}
      fps={NEURO_MOTION_FPS}
      width={NEURO_MOTION_WIDTH}
      height={NEURO_MOTION_HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const size = getDynamicFormat(props);
        return {
          durationInFrames: getDynamicDuration({
            props,
            defaultDurationInFrames: NEURO_MOTION_DURATION_FRAMES,
            fps: NEURO_MOTION_FPS,
          }),
          width: size.width,
          height: size.height,
        };
      }}
    />
  </>
));
