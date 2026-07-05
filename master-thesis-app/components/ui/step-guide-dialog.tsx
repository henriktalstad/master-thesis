"use client";

import React, { useState, useEffect, useCallback, useEffectEvent } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepGuideStep = {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  icon: React.ReactNode;
};

type StepGuideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: StepGuideStep[];
  /** Overstyring av "Guide" i header; standard er "Guide" */
  title?: string;
};

export function StepGuideDialog({
  open,
  onOpenChange,
  steps,
  title = "Guide",
}: StepGuideDialogProps) {
  if (!open || steps.length === 0) return null;

  return (
    <StepGuideDialogPanel
      key={steps.map((s) => s.id).join("|")}
      steps={steps}
      title={title}
      onOpenChange={onOpenChange}
    />
  );
}

function StepGuideDialogPanel({
  steps,
  title,
  onOpenChange,
}: {
  steps: StepGuideStep[];
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const goToNext = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      if (isLastStep) {
        close();
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }
      setIsAnimating(false);
    }, 150);
  }, [isLastStep, steps.length, close]);

  const goToPrevious = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => Math.max(0, prev - 1));
      setIsAnimating(false);
    }, 150);
  }, []);

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (!isFirstStep) goToPrevious();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (isLastStep) close();
      else goToNext();
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const validStep = Math.max(0, Math.min(currentStep, steps.length - 1));
  const current = steps[validStep];
  if (!current) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-4 print:hidden open:flex"
      aria-labelledby="step-guide-dialog-title"
      aria-describedby="step-guide-dialog-description"
      data-print-omit
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Lukk guide"
        className="absolute inset-0 border-0 bg-foreground/40 p-0 backdrop-blur-sm"
        onClick={close}
      />
      <Card
        className={cn(
          "relative z-10 w-full max-w-lg transition-all duration-300 bg-card text-foreground border border-border shadow-md rounded-lg",
          isAnimating && "scale-95 opacity-75",
        )}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full border border-primary/20 bg-primary/10 text-primary shrink-0">
              {current.icon}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80 mb-0.5">
                {title}
              </div>
              <CardTitle id="step-guide-dialog-title" className="text-lg">
                {current.title}
              </CardTitle>
              <p
                id="step-guide-dialog-description"
                className="text-sm text-muted-foreground"
              >
                {current.description}
              </p>
            </div>
          </div>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => close()}
              className="size-8 p-0"
              aria-label="Lukk guide"
            >
              <X className="size-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-5 md:space-y-6">
          <Separator className="my-1" />
          <div className="min-h-[120px] leading-relaxed">{current.content}</div>

          <Separator className="my-1" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {steps.map((_, index) => (
                <div
                  key={steps[index].id}
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    index === validStep
                      ? "bg-primary"
                      : index < validStep
                        ? "bg-success"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
              ))}
            </div>
            <Badge variant="secondary" className="text-xs">
              {validStep + 1} av {steps.length}
            </Badge>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="ghost"
              onClick={goToPrevious}
              disabled={isFirstStep}
              className="gap-2"
            >
              <ChevronLeft className="size-4" />
              Forrige
            </Button>

            <div className="flex gap-2">
              {!isLastStep && (
                <Button
                  variant="outline"
                  onClick={() => close()}
                  className="text-sm"
                >
                  Hopp over
                </Button>
              )}
              <Button onClick={goToNext} className="gap-2">
                {isLastStep ? "Fullfør" : "Neste"}
                {!isLastStep && <ChevronRight className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="text-[12px] text-muted-foreground/90 text-right">
            Tips: Bruk piltaster (←/→) for forrige/neste. Esc lukker guiden.
          </div>
        </CardContent>
      </Card>
    </dialog>
  );
}
