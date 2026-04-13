import React from 'react';
import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import MotionLayers from '@/components/neuro-motion/MotionLayers';
import { NEURO_MOTION_TRANSITIONS } from '@/lib/neuroMotion/constants';
import { neuromotionFontFamily } from '@/lib/neuroMotion/loadInterFont';

const DEFAULT_SCENE = {
  title: 'NeuroMotion',
  subtitle: 'Videos programaticos com React + IA',
  accentColor: '#7c3aed',
  backgroundColor: '#0f172a',
  durationSec: 3,
  transition: 'fade',
  imageUrl: '',
  hideClassicText: false,
  layers: [],
};

const SceneSlide = ({
  scene,
  durationInFrames,
  transitionFrames,
  isFirst,
  isLast,
  sceneIndex = 0,
  /** Como esta cena aparece após a anterior: vem de `scenes[i-1].transition` (mão contínua). */
  enterAfterPrevious = 'fade',
}) => {
  const { fps, width, height } = useVideoConfig();
  const isVertical = height > width;
  const shortSide = Math.min(width, height);
  /** Deslocamento horizontal de slide proporcional ao quadro (push broadcast, sem “duplo arrasto”). */
  const slideTravelPx = Math.round(Math.min(width, height) * 0.11);
  const titleFontSize = Math.round(
    Math.min(isVertical ? shortSide * 0.078 : width * 0.055, isVertical ? 96 : 88)
  );
  const subtitleFontSize = Math.round(
    Math.min(isVertical ? shortSide * 0.038 : width * 0.028, isVertical ? 40 : 36)
  );
  const glowSize = Math.round(shortSide * 0.42);
  /** Dentro de <Sequence>, useCurrentFrame() já é relativo ao início da cena (0 … duração-1). */
  const localFrame = useCurrentFrame();

  const titleScale = spring({
    fps,
    frame: localFrame,
    config: {
      damping: 17,
      stiffness: 182,
      mass: 0.88,
    },
  });

  const subtitleOpacity = interpolate(localFrame, [4, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const glowOpacity = interpolate(localFrame, [0, 14, 56], [0.28, 0.78, 0.36], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });

  /**
   * Dissolve entre cenas: só a cena que ENTRA faz fade-in por cima. A que sai mantém opacidade 1;
   * caso contrário opacidades multiplicam-se e o fundo preto aparece a meio (efeito “sujo”).
   */
  const fadeInFrames = Math.max(1, Math.min(transitionFrames, durationInFrames - 1));
  const enter = isFirst ? 'fade' : enterAfterPrevious;
  const transitionInOpacity =
    isFirst
      ? interpolate(localFrame, [0, Math.min(fadeInFrames, 12)], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
      : enter === 'fade'
        ? interpolate(localFrame, [0, fadeInFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.inOut(Easing.cubic),
          })
        : 1;

  const transitionOutOpacity =
    isLast
      ? interpolate(
          localFrame,
          [durationInFrames - fadeInFrames, durationInFrames],
          [1, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.in(Easing.cubic),
          }
        )
      : 1;

  /** Push: só a nova cena desliza por cima; a anterior fica estável (leitura contínua). */
  const slideInX =
    !isFirst && enter === 'slide'
      ? interpolate(localFrame, [0, fadeInFrames], [slideTravelPx, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
      : 0;
  const slideOutX = 0;

  const noiseFilterId = `nm-bc-noise-${sceneIndex}`;

  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(118deg, ${scene.backgroundColor} 0%, ${scene.backgroundColor} 48%, ${scene.accentColor}2e 100%),
          radial-gradient(ellipse 120% 90% at 18% 12%, ${scene.accentColor}55 0%, ${scene.backgroundColor} 52%)
        `,
        color: '#ffffff',
        fontFamily: neuromotionFontFamily,
        overflow: 'hidden',
        opacity: transitionInOpacity * transitionOutOpacity,
        transform: `translateX(${slideInX + slideOutX}px)`,
      }}
    >
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: glowOpacity,
          transform: `scale(${1 + localFrame * 0.0005})`,
        }}
      >
        <div
          style={{
            width: glowSize,
            height: glowSize,
            borderRadius: 9999,
            background: `${scene.accentColor}44`,
            filter: 'blur(80px)',
          }}
        />
      </AbsoluteFill>

      {scene.imageUrl && scene.hideClassicText ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
            padding: '48px',
          }}
        >
          <Img
            src={scene.imageUrl}
            style={{
              maxWidth: '78%',
              maxHeight: '42%',
              objectFit: 'contain',
              borderRadius: 16,
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
          />
        </AbsoluteFill>
      ) : null}

      {Array.isArray(scene.layers) && scene.layers.length > 0 ? (
        <MotionLayers layers={scene.layers} localFrame={localFrame} durationInFrames={durationInFrames} />
      ) : null}

      {Array.isArray(scene.layers) && scene.layers.length > 0 ? (
        <AbsoluteFill
          pointerEvents="none"
          style={{
            zIndex: 3,
            background:
              'radial-gradient(ellipse 94% 88% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.58) 100%)',
          }}
        />
      ) : null}

      {!scene.hideClassicText ? (
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '56px',
            textAlign: 'center',
            zIndex: 5,
            gap: 24,
          }}
        >
          {scene.imageUrl ? (
            <Img
              src={scene.imageUrl}
              style={{
                maxWidth: '72%',
                maxHeight: '38%',
                objectFit: 'contain',
                borderRadius: 16,
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
              }}
            />
          ) : null}
          <h1
            style={{
              margin: 0,
              fontSize: Math.max(42, titleFontSize),
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 1.04,
              color: scene.accentColor,
              transform: `scale(${titleScale})`,
              textShadow:
                '0 0 2px rgba(0,0,0,0.9), 0 10px 40px rgba(0,0,0,0.55), 0 2px 0 rgba(0,0,0,0.35)',
              maxWidth: isVertical ? '88%' : '92%',
            }}
          >
            {scene.title}
          </h1>
          <p
            style={{
              marginTop: 24,
              marginBottom: 0,
              fontSize: Math.max(20, subtitleFontSize),
              maxWidth: isVertical ? Math.min(720, width * 0.88) : 900,
              lineHeight: 1.35,
              opacity: subtitleOpacity,
              fontWeight: 500,
              transform: `translateY(${interpolate(localFrame, [4, 18], [22, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
              })}px)`,
            }}
          >
            {scene.subtitle}
          </p>
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill
        pointerEvents="none"
        style={{
          zIndex: 24,
          opacity: 0.042,
          mixBlendMode: 'overlay',
        }}
      >
        <svg width="100%" height="100%" style={{ display: 'block' }} aria-hidden>
          <defs>
            <filter id={noiseFilterId} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="7" stitchTiles="stitch" result="n" />
              <feColorMatrix in="n" type="saturate" values="0" result="g" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${noiseFilterId})`} fill="#808080" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        pointerEvents="none"
        style={{
          zIndex: 25,
          opacity: 0.35,
          mixBlendMode: 'soft-light',
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 2px, rgba(255,255,255,0.045) 2px, rgba(255,255,255,0.045) 3px)',
        }}
      />
    </AbsoluteFill>
  );
};

const NeuroMotionComposition = ({ scenes, transitionFrames = 10 }) => {
  const { fps } = useVideoConfig();
  const safeScenes = Array.isArray(scenes) && scenes.length > 0 ? scenes : [DEFAULT_SCENE];
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {safeScenes.map((scene, idx) => {
        const durationSec = Number(scene?.durationSec) > 0 ? Number(scene.durationSec) : DEFAULT_SCENE.durationSec;
        const durationInFrames = Math.max(15, Math.round(durationSec * fps));
        const overlapFrames = idx > 0 ? Math.min(transitionFrames, Math.max(0, durationInFrames - 1)) : 0;
        const from = cursor - overlapFrames;
        cursor += durationInFrames;

        return (
          <Sequence key={`scene-${idx}-${from}`} from={from} durationInFrames={durationInFrames}>
            <SceneSlide
              sceneIndex={idx}
              durationInFrames={durationInFrames}
              transitionFrames={transitionFrames}
              isFirst={idx === 0}
              isLast={idx === safeScenes.length - 1}
              enterAfterPrevious={
                idx === 0
                  ? 'fade'
                  : NEURO_MOTION_TRANSITIONS.includes(String(safeScenes[idx - 1]?.transition))
                    ? String(safeScenes[idx - 1].transition)
                    : 'fade'
              }
              scene={{
                ...DEFAULT_SCENE,
                ...scene,
              }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default NeuroMotionComposition;
