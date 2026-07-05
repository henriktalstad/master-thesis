export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: "log",
  chat: "response",
  auth: "response",
  stream: "response",
  api: "response",
  history: "response",
  vote: "response",
  document: "response",
  suggestions: "response",
  activate_gateway: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: "", message: "Noe gikk galt. Prøv igjen senere." },
        { status: statusCode },
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "En databasefeil oppstod.";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "Forespørselen kunne ikke behandles. Sjekk inndata og prøv igjen.";

    case "bad_request:activate_gateway":
      return "AI Gateway krever gyldig betalingskort hos leverandør.";

    case "unauthorized:auth":
      return "Du må logge inn for å fortsette.";
    case "forbidden:auth":
      return "Kontoen din har ikke tilgang til denne funksjonen.";

    case "rate_limit:chat":
      return "Du har nådd meldingsgrensen. Prøv igjen om en time.";
    case "not_found:chat":
      return "Samtalen ble ikke funnet.";
    case "forbidden:chat":
      return "Denne samtalen tilhører en annen bruker.";
    case "unauthorized:chat":
      return "Du må logge inn for å bruke chatten.";
    case "bad_request:chat":
      return "Meldingen kunne ikke godkjennes. Sjekk vedlegg og prøv igjen.";
    case "offline:chat":
      return "Kunne ikke sende melding. Sjekk nettverket.";

    case "not_found:document":
      return "Dokumentet ble ikke funnet.";
    case "forbidden:document":
      return "Dette dokumentet tilhører en annen bruker.";
    case "unauthorized:document":
      return "Du må logge inn for å se dokumentet.";
    case "bad_request:document":
      return "Ugyldig forespørsel for dokument.";

    case "not_found:vote":
      return "Samtalen ble ikke funnet.";
    case "forbidden:vote":
      return "Du har ikke tilgang til å stemme på denne samtalen.";

    case "forbidden:api":
      return "Du har ikke tilgang til denne ressursen.";

    default:
      return "Noe gikk galt. Prøv igjen senere.";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
