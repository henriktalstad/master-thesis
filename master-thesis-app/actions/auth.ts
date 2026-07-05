"use server";

export async function isCurrentUserAdmin(): Promise<boolean> {
  return true;
}

export async function isOrgAdmin(): Promise<boolean> {
  return true;
}
