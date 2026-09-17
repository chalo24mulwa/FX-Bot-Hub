"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointer2, Pencil, Minus, Type, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Freehand/line/text annotation overlay for the hero chart — a plain
// <canvas> absolutely positioned on top of the lightweight-charts
// container, entirely independent of it (lightweight-charts itself has
// no drawing-tools API; this doesn't touch or wrap its rendering at
// all). Annotations are client-side/session-only — there's no backend
// model for them yet, so they're lost on reload; a deliberate scope cut
// for a first pass, not a bug. When a draw tool is active, this layer
// captures pointer events and the chart underneath is inert (so a
// pencil stroke doesn't also pan the chart); switching back to the
// cursor tool returns full interaction to the chart.

type DrawTool = "cursor" | "pencil" | "line" | "text";

interface Point {
  x: number;
  y: number;
}

type Stroke =
  | { type: "freehand"; color: string; points: Point[] }
  | { type: "line"; color: string; from: Point; to: Point }
  | { type: "text"; color: string; at: Point; text: string };

const PALETTE = ["#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7", "#f97316"];

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.type === "freehand") {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else if (stroke.type === "line") {
    ctx.beginPath();
    ctx.moveTo(stroke.from.x, stroke.from.y);
    ctx.lineTo(stroke.to.x, stroke.to.y);
    ctx.stroke();
  } else {
    ctx.font = "13px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(stroke.text, stroke.at.x, stroke.at.y);
  }
}

export function ChartDrawingLayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<DrawTool>("cursor");
  const [color, setColor] = useState(PALETTE[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  // Mirrors `strokes` for the ResizeObserver callback below, which is
  // attached once on mount (see that effect's empty deps) and would
  // otherwise always redraw whatever `strokes` was at mount time —
  // updated in an effect, never during render, per the rule against
  // mutating a ref while rendering.
  const strokesRef = useRef<Stroke[]>([]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  function repaint() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) {
      if (stroke) drawStroke(ctx, stroke);
    }
    if (activeStrokeRef.current) drawStroke(ctx, activeStrokeRef.current);
  }

  // Keeps the canvas's pixel size matched to the chart container —
  // existing strokes stay in the same pixel coordinates rather than
  // rescaling with the container, a known simplification (see file doc
  // comment) acceptable for scratch annotations.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      repaint();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(repaint, [strokes]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "cursor") return;
    const point = pointFromEvent(e);

    if (tool === "text") {
      const text = window.prompt("Note text:");
      if (text && text.trim()) {
        setStrokes((prev) => [...prev, { type: "text", color, at: point, text: text.trim() }]);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    activeStrokeRef.current =
      tool === "pencil" ? { type: "freehand", color, points: [point] } : { type: "line", color, from: point, to: point };
    repaint();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return;
    const point = pointFromEvent(e);
    const active = activeStrokeRef.current;
    if (active.type === "freehand") active.points.push(point);
    else if (active.type === "line") active.to = point;
    repaint();
  }

  function handlePointerUp() {
    if (!activeStrokeRef.current) return;
    setStrokes((prev) => [...prev, activeStrokeRef.current!]);
    activeStrokeRef.current = null;
  }

  const tools: { id: DrawTool; label: string; Icon: typeof MousePointer2 }[] = [
    { id: "cursor", label: "Cursor (chart interaction)", Icon: MousePointer2 },
    { id: "pencil", label: "Pencil — freehand draw", Icon: Pencil },
    { id: "line", label: "Line — trend line", Icon: Minus },
    { id: "text", label: "Text note", Icon: Type },
  ];

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10">
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 h-full w-full", tool !== "cursor" ? "pointer-events-auto" : "pointer-events-none")}
        style={{ cursor: tool === "cursor" ? "default" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      <div className="pointer-events-auto absolute left-2 top-2 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/70 p-1.5 backdrop-blur-sm">
        <div className="flex gap-1">
          {tools.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setTool(id)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded transition-colors",
                tool === id ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            title="Clear all drawings"
            aria-label="Clear all drawings"
            onClick={() => setStrokes([])}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition-colors hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1 px-0.5">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              title={swatch}
              aria-label={`Color ${swatch}`}
              onClick={() => setColor(swatch)}
              className={cn("h-4 w-4 rounded-full ring-offset-1 ring-offset-black", color === swatch && "ring-2 ring-white")}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
