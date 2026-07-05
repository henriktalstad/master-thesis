import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type {
  Control,
  FieldValues,
  FieldPath,
  ControllerRenderProps,
} from "react-hook-form";
import {
  formatDecimalInputDisplay,
  sanitizeDecimalInputTyping,
  tryParseDecimalInput,
} from "@/lib/parse-decimal-input";

/**
 * Tallfelt-kontrakt (NumberField):
 * - **Lagre / form-state / API:** `number` (f.eks. 3682) — aldri formatert streng.
 * - **Visning (blur + lasting):** nb-NO med tusenskille (f.eks. «3 682» / «3 682,5»).
 * - **Under skriving (lokal streng):** fri inndata med mellomrom, komma, punktum;
 *   `tryParseDecimalInput` normaliserer ved blur. Ugyldig tekst endrer ikke lagret tall.
 *
 * NumberInput uten formatOnCommit: samme parsing, valgfri visning uten tusenskille (f.eks. %).
 */

const INVALID_DECIMAL_MESSAGE =
  "Ugyldig tall. Bruk f.eks. 3682, 3 682 eller 3682,5";

export type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: string;
  onValueChange: (next: string) => void;
  onCommit?: (parsed: number | undefined) => void;
  minValue?: number;
  maxValue?: number;
  decimals?: number;
  invalidMessage?: string;
  formatOnCommit?: boolean;
};

function clampAndRound(
  value: number,
  minValue?: number,
  maxValue?: number,
  decimals?: number,
): number {
  let v = value;
  if (typeof minValue === "number" && v < minValue) v = minValue;
  if (typeof maxValue === "number" && v > maxValue) v = maxValue;
  if (typeof decimals === "number") {
    const f = 10 ** decimals;
    v = Math.round((v + Number.EPSILON) * f) / f;
  }
  return v;
}

/** Ren, kontrollerbar input — tom streng, komma og mellomrom under skriving. */
export function NumberInput({
  value,
  onValueChange,
  onCommit,
  minValue,
  maxValue,
  decimals,
  invalidMessage = INVALID_DECIMAL_MESSAGE,
  formatOnCommit = false,
  onBlur,
  className,
  ...rest
}: NumberInputProps) {
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  const commitFromRaw = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        setInlineError(null);
        onCommit?.(undefined);
        return;
      }
      const parsed = tryParseDecimalInput(trimmed);
      if (parsed === undefined) {
        setInlineError(invalidMessage);
        return;
      }
      setInlineError(null);
      const v = clampAndRound(parsed, minValue, maxValue, decimals);
      onCommit?.(v);
      if (formatOnCommit) {
        onValueChange(formatDecimalInputDisplay(v, { maxDecimals: decimals }));
      }
    },
    [
      decimals,
      formatOnCommit,
      invalidMessage,
      maxValue,
      minValue,
      onCommit,
      onValueChange,
    ],
  );

  return (
    <div className="space-y-1">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        aria-invalid={inlineError ? true : undefined}
        className={cn(
          inlineError && "border-destructive focus-visible:ring-destructive/30",
          className,
        )}
        onChange={(e) => {
          setInlineError(null);
          onValueChange(sanitizeDecimalInputTyping(e.target.value));
        }}
        onBlur={(e) => {
          commitFromRaw(value);
          onBlur?.(e);
        }}
        {...rest}
      />
      {inlineError ? (
        <p className="text-xs text-destructive" role="alert">
          {inlineError}
        </p>
      ) : null}
    </div>
  );
}

export function NumberField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  placeholder,
  minValue,
  maxValue,
  decimals,
  formatOnCommit,
}: {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
  decimals?: number;
  /** Standard true — sett false for rå tall uten tusenskille (f.eks. prosent i tabell). */
  formatOnCommit?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <NumberFieldInner
          field={field as unknown as ControllerRenderProps}
          label={label}
          description={description}
          placeholder={placeholder}
          minValue={minValue}
          maxValue={maxValue}
          decimals={decimals}
          formatOnCommit={formatOnCommit}
        />
      )}
    />
  );
}

function numberToInputString(
  value: unknown,
  decimals?: number,
  formatOnCommit?: boolean,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return formatOnCommit !== false
    ? formatDecimalInputDisplay(value, { maxDecimals: decimals })
    : String(value);
}

function NumberFieldInner({
  field,
  label,
  description,
  placeholder,
  minValue,
  maxValue,
  decimals,
  formatOnCommit = true,
}: {
  field: ControllerRenderProps;
  label: string;
  description?: string;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
  decimals?: number;
  formatOnCommit?: boolean;
}) {
  const [localOverride, setLocalOverride] = React.useState<string | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const syncedValue = numberToInputString(field.value, decimals, formatOnCommit);
  const local = isFocused ? (localOverride ?? syncedValue) : syncedValue;

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <NumberInput
          value={local}
          formatOnCommit={formatOnCommit}
          onFocus={() => {
            setIsFocused(true);
            setLocalOverride(syncedValue);
          }}
          onValueChange={setLocalOverride}
          onBlur={() => {
            setIsFocused(false);
            setLocalOverride(null);
          }}
          onCommit={(parsed) => {
            field.onChange(parsed as unknown as number);
          }}
          placeholder={placeholder}
          minValue={minValue}
          maxValue={maxValue}
          decimals={decimals}
          className="h-10"
        />
      </FormControl>
      {description ? (
        <FormDescription className="text-xs">{description}</FormDescription>
      ) : null}
      <FormMessage />
    </FormItem>
  );
}
