import { useRef, useState } from "react";

type TapPoint = { x: number; y: number; t: number; pointerId: number };

const MOVE_TOLERANCE = 12;
const MAX_TAP_DURATION_MS = 500;

/**
 * Android WebView suppresses the synthetic `click` event that follows a
 * scroll/swipe gesture, so `onClick`-only controls feel like they need two
 * presses after scrolling. This activates on `pointerup` instead, with
 * movement/duration guards so real scrolls never trigger a tap. Also exposes
 * a `pressed` flag for press-state visuals.
 */
export function useTap(onTap: () => void) {
  const startRef = useRef<TapPoint | null>(null);
  const [pressed, setPressed] = useState(false);

  const down = (e: React.PointerEvent) => {
    setPressed(true);
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), pointerId: e.pointerId };
  };

  const move = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) {
      startRef.current = null;
    }
  };

  const up = (e: React.PointerEvent) => {
    setPressed(false);
    const s = startRef.current;
    startRef.current = null;
    if (!s || e.pointerId !== s.pointerId) return;
    if (Date.now() - s.t > MAX_TAP_DURATION_MS) return;
    onTap();
  };

  const cancel = () => {
    setPressed(false);
    startRef.current = null;
  };

  return {
    pressed,
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
