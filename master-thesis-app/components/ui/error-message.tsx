"use client";

import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  title?: string;
  message?: string;
}

export function ErrorMessage({
  title = "Beklager, noe gikk galt",
  message = "Det oppstod en uventet feil. Vennligst prøv å laste siden på nytt.",
}: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-4">
      <AlertCircle className="h-10 w-10 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-4 text-center max-w-md">
        {message}
      </p>
    </div>
  );
}
