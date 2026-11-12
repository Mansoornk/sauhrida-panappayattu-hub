import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export type SpinWheelHandle = {
  spin: () => void;
  /** Spin so `winner` (entry index) lands under the pointer. */
  spinTo: (winner: number, duration?: number, turns?: number) => void;
};
type Entry = { id: string; label: string };

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export const SpinWheel = forwardRef<
  SpinWheelHandle,
  { entries: Entry[]; onResult: (e: Entry) => void; onSpinningChange?: (s: boolean) => void }
>(function SpinWheel({ entries, onResult, onSpinningChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const spinningRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const r = size / 2;
    const emerald = cssVar("--emerald", "#064e3b");
    const deep = cssVar("--emerald-deep", "#053d2f");
    const gold = cssVar("--gold", "#d97706");
    const ivory = cssVar("--ivory", "#fbf7ee");

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);

    // Outer gold ring
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();

    const n = Math.max(entries.length, 1);
    const seg = (Math.PI * 2) / n;
    ctx.rotate(angleRef.current);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 10, i * seg, (i + 1) * seg);
      ctx.closePath();
      ctx.fillStyle = entries.length === 0 ? deep : i % 2 === 0 ? emerald : deep;
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1;
      ctx.stroke();

      const entry = entries[i];
      if (entry) {
        ctx.save();
        ctx.rotate(i * seg + seg / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = i % 2 === 0 ? ivory : gold;
        const fontSize = Math.max(9, Math.min(14, (r * seg) / 2.2));
        ctx.font = `600 ${fontSize}px Inter, sans-serif`;
        const label = entry.label.length > 18 ? entry.label.slice(0, 17) + "…" : entry.label;
        ctx.fillText(label, r - 20, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    // Hub
    ctx.beginPath();
    ctx.arc(r, r, r * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r, r, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = deep;
    ctx.fill();

    // Pointer (top)
    ctx.beginPath();
    ctx.moveTo(r - 13, 2);
    ctx.lineTo(r + 13, 2);
    ctx.lineTo(r, 30);
    ctx.closePath();
    ctx.fillStyle = ivory;
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }, [entries]);

  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const spinTo = useCallback(
    (winner: number, duration = 6000, turns = 6 + Math.floor(Math.random() * 3)) => {
      if (spinningRef.current || entries.length === 0 || winner < 0 || winner >= entries.length) return;
      spinningRef.current = true;
      onSpinningChange?.(true);
      const n = entries.length;
      const seg = (Math.PI * 2) / n;
      // Pointer sits at -90deg. Land winner's middle under it.
      const targetMod = (-Math.PI / 2 - (winner * seg + seg / 2)) % (Math.PI * 2);
      const start = angleRef.current;
      const currentMod = ((start % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let delta = (((targetMod + Math.PI * 2) % (Math.PI * 2)) - currentMod + Math.PI * 2) % (Math.PI * 2);
      delta += Math.PI * 2 * turns;
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 4);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        angleRef.current = start + delta * ease(t);
        draw();
        if (t < 1) requestAnimationFrame(step);
        else {
          spinningRef.current = false;
          onSpinningChange?.(false);
          onResult(entries[winner]!);
        }
      };
      requestAnimationFrame(step);
    },
    [entries, draw, onResult, onSpinningChange],
  );

  useImperativeHandle(ref, () => ({
    spin() {
      spinTo(Math.floor(Math.random() * entries.length));
    },
    spinTo,
  }));

  return <canvas ref={canvasRef} className="aspect-square w-full max-w-[380px]" aria-label="Lottery spinning wheel" />;
});
