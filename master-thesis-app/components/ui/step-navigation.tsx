"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface Step {
  title: string;
  route: string;
  link: string;
}

interface StepNavigationProps {
  steps: ReadonlyArray<Step>;
}

export default function StepNavigation({ steps }: StepNavigationProps) {
  const pathname = usePathname();
  const currentPath = pathname.split("/").pop() || "";

  const currentStep = useMemo(() => {
    const idx = steps.findIndex((step) => step.route === currentPath);
    return idx !== -1 ? idx + 1 : 1;
  }, [currentPath, steps]);

  return (
    <nav className="w-full">
      {/* Mobile Steps */}
      <div className="lg:hidden bg-card border rounded-xl p-4">
        <div className="flex justify-between items-center">
          {steps.map((step, i) => (
            <Link
              href={step.link}
              key={step.link}
              className="relative z-10"
              prefetch={true}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 border-2",
                  i + 1 === currentStep
                    ? "bg-accent border-accent-foreground/20 text-accent-foreground scale-110 shadow-lg"
                    : i + 1 > currentStep
                      ? "bg-transparent border-border text-muted-foreground"
                      : "bg-primary/20 border-transparent text-primary",
                )}
              >
                {i + 1 < currentStep ? <Check className="size-4" /> : i + 1}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <h3 className="font-medium text-card-foreground">
            {steps[currentStep - 1]?.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Steg {currentStep} av {steps.length}
          </p>
        </div>
      </div>

      {/* Desktop Steps */}
      <div className="hidden lg:flex flex-col bg-card border rounded-xl p-4 gap-2">
        {steps.map((step, i) => (
          <Link
            href={step.link}
            key={step.link}
            className={cn(
              "group flex items-center gap-4 p-3 rounded-lg transition-colors duration-200",
              currentPath === step.route ? "bg-accent" : "hover:bg-accent/50",
            )}
            prefetch={true}
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 border-2",
                i + 1 === currentStep
                  ? "bg-accent border-accent-foreground/20 text-accent-foreground scale-105 shadow-md"
                  : i + 1 > currentStep
                    ? "bg-card border-border text-muted-foreground"
                    : "bg-primary/20 border-transparent text-primary",
              )}
            >
              {i + 1 < currentStep ? <Check className="size-5" /> : i + 1}
            </span>
            <span
              className={cn(
                "font-medium transition-colors duration-200",
                currentPath === step.route
                  ? "text-accent-foreground" /* Bruk accent-foreground for konsistens med badge */
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              {step.title}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
