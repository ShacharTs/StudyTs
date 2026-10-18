import React, { useEffect, useState } from 'react';
import styles from './DebugOverlay.module.css';

interface RenderSample {
  timestamp: string;
  durationMs: number;
}

export function DebugOverlay(): React.ReactElement | null {
  const isDebug = import.meta.env.VITE_DEBUG_MODE === 'true';
  const [samples, setSamples] = useState<RenderSample[]>([]);
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    if (!isDebug) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [isDebug]);

  useEffect(() => {
    if (!isDebug) return;
    const now = performance.now();
    setSamples((prev) => [
      { timestamp: new Date().toLocaleTimeString(), durationMs: Math.round(now % 1000) },
      ...prev.slice(0, 4),
    ]);
  }, [isDebug]);

  if (!isDebug) return null;

  return (
    <aside
      aria-label="Developer Debug Overlay"
      className={styles.overlay}
    >
      <div className={styles.title}>[DEBUG MODE ACTIVE]</div>
      <div>FPS: <span className={styles.fps}>{fps}</span></div>
      <div>Recent Frames:</div>
      {samples.map((s, idx) => (
        <div key={idx} className={styles.sample}>
          {s.timestamp} — {s.durationMs}ms
        </div>
      ))}
    </aside>
  );
}
