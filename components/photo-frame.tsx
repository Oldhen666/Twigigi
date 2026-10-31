"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, ghostClass } from "@/components/ui";

const OUTPUT = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

type Size = { w: number; h: number };
type Point = { x: number; y: number };

export function PhotoFrame({
  src,
  progress,
  onCancel,
  onSkip,
  onUse,
}: {
  src: string;
  progress?: string;
  onCancel: () => void;
  onSkip?: () => void;
  onUse: (file: File) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const dragged = useRef(false);
  const [natural, setNatural] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setView(frame.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (!natural.w || !view) return;
    setOffset((current) => (dragged.current ? clamp(current, natural, view, zoom) : centered(natural, view, zoom)));
  }, [natural, view, zoom]);

  function cover(size: Size, viewport: number) {
    return Math.max(viewport / size.w, viewport / size.h);
  }

  function changeZoom(nextZoom: number) {
    if (!natural.w || !view) {
      setZoom(nextZoom);
      return;
    }
    const previous = cover(natural, view) * zoom;
    const next = cover(natural, view) * nextZoom;
    setOffset((current) => {
      const cx = (view / 2 - current.x) / previous;
      const cy = (view / 2 - current.y) / previous;
      return clamp({ x: view / 2 - cx * next, y: view / 2 - cy * next }, natural, view, nextZoom);
    });
    setZoom(nextZoom);
  }

  function reset() {
    dragged.current = false;
    setZoom(1);
    if (natural.w && view) setOffset(centered(natural, view, 1));
  }

  async function useFrame() {
    if (!natural.w || !view) return;
    setBusy(true);
    setError("");
    try {
      onUse(await frameToFile(src, offset, zoom, view));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not frame that photo.");
      setBusy(false);
    }
  }

  const scale = natural.w && view ? cover(natural, view) * zoom : 1;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 px-5" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="frame-photo-title"
        className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="frame-photo-title" className="font-serif text-3xl">Frame the photo</h2>
        <p className="mt-2 text-sm text-muted">
          Drag and zoom. The square is the cover customers see.{progress ? ` ${progress}` : ""}
        </p>
        <div
          ref={frameRef}
          className="relative mt-4 aspect-square w-full touch-none overflow-hidden rounded-2xl bg-paper-deep"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current || !natural.w || !view) return;
            dragged.current = true;
            setOffset(
              clamp(
                {
                  x: drag.current.ox + event.clientX - drag.current.x,
                  y: drag.current.oy + event.clientY - drag.current.y,
                },
                natural,
                view,
                zoom,
              ),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
            className={`absolute max-w-none select-none ${natural.w ? "" : "opacity-0"}`}
            style={natural.w ? { width: natural.w * scale, height: natural.h * scale, left: offset.x, top: offset.y } : undefined}
          />
        </div>
        <label className="mt-4 block text-sm text-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="mt-1 w-full accent-forest"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={reset} className={`${ghostClass} flex-1`}>
            Reset
          </button>
          {onSkip ? (
            <button type="button" onClick={onSkip} className={`${ghostClass} flex-1`}>
              Skip
            </button>
          ) : (
            <button type="button" onClick={onCancel} className={`${ghostClass} flex-1`}>
              Cancel
            </button>
          )}
        </div>
        <button type="button" onClick={useFrame} disabled={busy || !natural.w} className={`${buttonClass} mt-2 w-full`}>
          {busy ? "Saving frame…" : "Use this frame"}
        </button>
      </div>
    </div>
  );
}

function coverScale(size: Size, view: number) {
  return Math.max(view / size.w, view / size.h);
}

function centered(size: Size, view: number, zoom: number): Point {
  const scale = coverScale(size, view) * zoom;
  return { x: (view - size.w * scale) / 2, y: (view - size.h * scale) / 2 };
}

function clamp(point: Point, size: Size, view: number, zoom: number): Point {
  const scale = coverScale(size, view) * zoom;
  const width = size.w * scale;
  const height = size.h * scale;
  return {
    x: Math.min(0, Math.max(view - width, point.x)),
    y: Math.min(0, Math.max(view - height, point.y)),
  };
}

async function frameToFile(src: string, offset: Point, zoom: number, view: number) {
  const image = await loadImage(src);
  const scale = coverScale({ w: image.naturalWidth, h: image.naturalHeight }, view) * zoom;
  let sourceX = Math.max(0, -offset.x / scale);
  let sourceY = Math.max(0, -offset.y / scale);
  let sourceSize = view / scale;
  sourceSize = Math.min(sourceSize, image.naturalWidth - sourceX, image.naturalHeight - sourceY);
  let edge = OUTPUT;
  let quality = 0.9;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not frame that photo.");
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, edge, edge);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) break;
    edge = Math.round(edge * 0.75);
    quality = 0.8;
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error("That frame is still over 5 MB. Zoom in a little more.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = src;
  });
}
