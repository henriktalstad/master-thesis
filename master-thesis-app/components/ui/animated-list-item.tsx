"use client";

import * as React from "react";
import { m, useInView } from "@/lib/motion/m";
import { cn } from "@/lib/utils";

type AnimatedItemProps = {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  onMouseEnter?: () => void;
  onClick?: () => void;
  className?: string;
};

export function AnimatedItem({
  children,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
  className,
}: AnimatedItemProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.2, once: false });
  return (
    <m.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.98, opacity: 0, y: 8 }}
      animate={
        inView
          ? { scale: 1, opacity: 1, y: 0 }
          : { scale: 0.98, opacity: 0, y: 8 }
      }
      transition={{
        duration: 0.35,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn("will-change-transform w-full", className)}
    >
      {children}
    </m.div>
  );
}
