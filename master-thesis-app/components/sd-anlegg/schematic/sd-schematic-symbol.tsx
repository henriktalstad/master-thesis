"use client";

import type { SdComponentType } from "@/lib/sd-anlegg/component-types";

type Props = {
  type: SdComponentType;
  className?: string;
  coilVariant?: "heat" | "cool";
  style?: "default" | "process";
  temperatureProbe?: "vertical" | "horizontal";
};

const PROCESS_SYMBOL = {
  stroke: 2.75,
  strokeMd: 2.25,
  strokeSm: 1.75,
} as const;

export function SdSchematicSymbol({
  type,
  className = "size-10",
  coilVariant = "heat",
  style = "default",
  temperatureProbe = "vertical",
}: Props) {
  const isProcess = style === "process";
  const sw = isProcess ? PROCESS_SYMBOL.stroke : 2;
  const swMd = isProcess ? PROCESS_SYMBOL.strokeMd : 1.5;
  const swSm = isProcess ? PROCESS_SYMBOL.strokeSm : 1.5;

  switch (type) {
    case "ventilation.fan":
      if (isProcess) {
        return (
          <svg viewBox="0 0 48 48" className={className} aria-hidden>
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="currentColor"
              fillOpacity="0.12"
              stroke="currentColor"
              strokeWidth={sw}
            />
            <polygon points="24,12 34,34 14,34" fill="currentColor" />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M24 8 L28 22 L24 24 L20 22 Z M24 40 L28 26 L24 24 L20 26 Z M8 24 L22 28 L24 24 L22 20 Z M40 24 L26 28 L24 24 L26 20 Z"
            fill="currentColor"
            opacity="0.85"
          />
        </svg>
      );
    case "ventilation.damper":
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          {isProcess ? (
            <>
              <line
                x1="6"
                y1="24"
                x2="42"
                y2="24"
                stroke="currentColor"
                strokeWidth={swSm}
                opacity="0.55"
              />
              <path
                d="M10 10 L24 24 L10 38"
                fill="none"
                stroke="currentColor"
                strokeWidth={swMd}
                strokeLinejoin="round"
              />
              <path
                d="M38 10 L24 24 L38 38"
                fill="none"
                stroke="currentColor"
                strokeWidth={swMd}
                strokeLinejoin="round"
              />
            </>
          ) : (
            <path
              d="M12 8 L24 40 L36 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          )}
        </svg>
      );
    case "ventilation.filter":
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <rect
            x="10"
            y="10"
            width="28"
            height="28"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth={swMd}
          />
          {[14, 20, 26, 32].map((x) => (
            <line
              key={x}
              x1={x}
              y1="12"
              x2={x}
              y2="36"
              stroke="currentColor"
              strokeWidth={swSm}
              opacity="0.75"
            />
          ))}
        </svg>
      );
    case "ventilation.heat_recovery":
      return (
        <svg viewBox="0 0 48 80" className={className} aria-hidden>
          <rect
            x="8"
            y="4"
            width="32"
            height="72"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth={isProcess ? 3 : 2.5}
          />
          {[16, 28, 40, 52, 64].map((y) => (
            <line
              key={y}
              x1="12"
              y1={y}
              x2="36"
              y2={y}
              stroke="currentColor"
              strokeWidth={swSm}
              opacity="0.6"
            />
          ))}
        </svg>
      );
    case "sensor.temperature":
      if (isProcess && temperatureProbe === "horizontal") {
        return (
          <svg viewBox="0 0 48 32" className={className} aria-hidden>
            <line x1="4" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth={swMd} />
            <circle
              cx="36"
              cy="16"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth={swMd}
            />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 32 48" className={className} aria-hidden>
          <circle
            cx="16"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth={swMd}
          />
          <line x1="16" y1="20" x2="16" y2="42" stroke="currentColor" strokeWidth={swMd} />
          <circle cx="16" cy="42" r="3" fill="currentColor" />
        </svg>
      );
    case "sensor.pressure":
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth={sw} />
          <path
            d="M24 14 L24 24 L30 30"
            fill="none"
            stroke="currentColor"
            strokeWidth={swMd}
            strokeLinecap="round"
          />
        </svg>
      );
    case "hvac.valve":
      if (isProcess) {
        return (
          <svg viewBox="0 0 48 48" className={className} aria-hidden>
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth={swMd} />
            <path
              d="M12 12 L12 36 L22 24 Z"
              fill="currentColor"
              opacity="0.85"
            />
            <path
              d="M36 12 L36 36 L26 24 Z"
              fill="currentColor"
              opacity="0.85"
            />
            <circle
              cx="40"
              cy="24"
              r="4"
              fill="none"
              stroke="currentColor"
              strokeWidth={swSm}
            />
          </svg>
        );
      }
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <path d="M8 24 H40" stroke="currentColor" strokeWidth={swMd} />
          <path d="M24 10 L16 24 L24 38 L32 24 Z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    case "hvac.coil":
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          {isProcess ? (
            <>
              <rect
                x="10"
                y="12"
                width="28"
                height="24"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth={swMd}
              />
              <path
                d="M14 18 L18 30 L22 18 L26 30 L30 18 L34 30"
                fill="none"
                stroke="currentColor"
                strokeWidth={swSm}
                strokeLinejoin="round"
                opacity="0.85"
              />
              <text
                x="24"
                y="29"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="currentColor"
              >
                {coilVariant === "cool" ? "−" : "+"}
              </text>
            </>
          ) : (
            <>
              <path
                d="M8 24 H13 L16 14 L20 34 L24 14 L28 34 L32 14 L35 24 H40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle
                cx="24"
                cy="24"
                r="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <text
                x="24"
                y="27.5"
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="currentColor"
              >
                {coilVariant === "cool" ? "−" : "+"}
              </text>
            </>
          )}
        </svg>
      );
    case "hvac.pump":
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth={sw} />
          <polygon points="24,14 32,32 16,32" fill="currentColor" opacity="0.9" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden>
          <rect
            x="10"
            y="10"
            width="28"
            height="28"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth={sw}
          />
        </svg>
      );
  }
}
