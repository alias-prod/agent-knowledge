"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

export type ParticlesProps = {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);

  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

export function Particles({
  className,
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  refresh = false,
  color = "#ffffff",
  vx = 0,
  vy = 0,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const circlesRef = useRef<Circle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  const createCircle = useCallback((): Circle => {
    const { width, height } = dimensionsRef.current;

    return {
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      translateX: 0,
      translateY: 0,
      size: Math.floor(Math.random() * 2) + size,
      alpha: 0,
      targetAlpha: Number((Math.random() * 0.6 + 0.1).toFixed(1)),
      dx: (Math.random() - 0.5) * 0.2,
      dy: (Math.random() - 0.5) * 0.2,
      magnetism: 0.1 + Math.random() * 4,
    };
  }, [size]);

  const drawCircle = useCallback(
    (circle: Circle, update = false) => {
      const context = contextRef.current;
      if (!context) return;

      const { r, g, b } = hexToRgb(color);
      context.save();
      context.translate(circle.translateX, circle.translateY);
      context.beginPath();
      context.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${circle.alpha})`;
      context.fill();
      context.restore();

      if (!update) {
        circlesRef.current.push(circle);
      }
    },
    [color],
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    dimensionsRef.current = { width, height };
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    contextRef.current = context;
    circlesRef.current = [];

    for (let index = 0; index < quantity; index += 1) {
      drawCircle(createCircle());
    }
  }, [createCircle, drawCircle, quantity]);

  const animate = useCallback(function animateParticles() {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;

    const { width, height } = dimensionsRef.current;
    context.clearRect(0, 0, width, height);

    circlesRef.current.forEach((circle, index) => {
      const edgeDistance = Math.min(
        circle.x + circle.translateX - circle.size,
        width - circle.x - circle.translateX - circle.size,
        circle.y + circle.translateY - circle.size,
        height - circle.y - circle.translateY - circle.size,
      );
      const fade = Math.max(edgeDistance, 0) / 20;

      if (fade > 1) {
        circle.alpha = Math.min(circle.alpha + 0.02, circle.targetAlpha);
      } else {
        circle.alpha = circle.targetAlpha * fade;
      }

      circle.x += circle.dx + vx;
      circle.y += circle.dy + vy;
      circle.translateX +=
        (mouseRef.current.x / (staticity / circle.magnetism) -
          circle.translateX) /
        ease;
      circle.translateY +=
        (mouseRef.current.y / (staticity / circle.magnetism) -
          circle.translateY) /
        ease;

      drawCircle(circle, true);

      if (
        circle.x < -circle.size ||
        circle.x > width + circle.size ||
        circle.y < -circle.size ||
        circle.y > height + circle.size
      ) {
        circlesRef.current[index] = createCircle();
      }
    });

    animationFrameRef.current = window.requestAnimationFrame(animateParticles);
  }, [createCircle, drawCircle, ease, staticity, vx, vy]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (event: MouseEvent) => {
      const bounds = container.getBoundingClientRect();
      const x = event.clientX - (bounds.left + bounds.width / 2);
      const y = event.clientY - (bounds.top + bounds.height / 2);
      const isInside =
        Math.abs(x) <= bounds.width / 2 && Math.abs(y) <= bounds.height / 2;

      mouseRef.current = isInside ? { x, y } : { x: 0, y: 0 };
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    window.addEventListener("mousemove", handleMouseMove);

    resizeCanvas();
    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, refresh, resizeCanvas]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
