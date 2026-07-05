import { Prisma } from "@/generated/client";

/** Typed bridge for Prisma JSON columns — single cast site. */
export function toPrismaJson<T>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function toPrismaJsonNullable<T>(
  value: T | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return toPrismaJson(value);
}
