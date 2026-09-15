import { useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "./cn";

interface Props {
  children: ComponentChildren;
  className?: string;
}

/** Mouse-follow radial glow behind a card's border, Aceternity-style. */
export function SpotlightCard({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [hovering, setHovering] = useState(false);

  function onMouseMove(e: JSX.TargetedMouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  const background = useMotionTemplate`radial-gradient(240px circle at ${mouseX}px ${mouseY}px, rgba(99,102,241,0.15), transparent 70%)`;

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 p-6",
        className,
      )}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ background, opacity: hovering ? 1 : 0 }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
