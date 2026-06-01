import { useRef, useState, useCallback } from 'react';

export function usePinchZoom() {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const lastTouchRef = useRef<{ dist: number; x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchRef.current = {
        dist: getDistance(e.touches),
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap — reset
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      }
      lastTapRef.current = now;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchRef.current) {
      e.preventDefault();
      const newDist = getDistance(e.touches);
      const ratio = newDist / lastTouchRef.current.dist;
      setScale(prev => Math.min(5, Math.max(1, prev * ratio)));
      lastTouchRef.current.dist = newDist;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  return { scale, translateX, translateY, reset, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
