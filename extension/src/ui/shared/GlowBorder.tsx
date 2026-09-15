import type { ComponentChildren } from "preact";
import { cn } from "./cn";

interface Props {
  children: ComponentChildren;
  active?: boolean;
  className?: string;
}

/**
 * Aceternity-style animated gradient border: a rotating conic-gradient sits
 * behind the content and shows through a 1px transparent gap. `active`
 * speeds the spin + intensifies the glow (used for the "recording" state).
 */
export function GlowBorder({ children, active, className }: Props) {
  return (
    <div className={cn("relative rounded-xl p-[1.5px] overflow-hidden", className)}>
      <div
        className={cn(
          "absolute inset-[-40%] bg-[conic-gradient(from_0deg,#6366f1,#a855f7,#ec4899,#6366f1)] animate-spin-slow opacity-70",
          active && "opacity-100 [animation-duration:2.5s]",
        )}
      />
      <div className="relative rounded-xl bg-neutral-950">{children}</div>
    </div>
  );
}
