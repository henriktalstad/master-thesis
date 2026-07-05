import type { SdAnleggContactCandidate } from "@/actions/infraspawn-read";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";

export type ContactDraftState = {
  selectedUserId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type ContactDraftAction =
  | {
      type: "reset_from_profile";
      profile: Pick<
        ResolvedSdAnleggSiteProfile,
        "contactUserId" | "contactName" | "contactPhone" | "contactEmail"
      >;
    }
  | {
      type: "set_field";
      field: keyof ContactDraftState;
      value: string;
    }
  | { type: "apply_candidate"; candidate: SdAnleggContactCandidate }
  | { type: "clear_user_selection" };

export function contactDraftReducer(
  state: ContactDraftState,
  action: ContactDraftAction,
): ContactDraftState {
  switch (action.type) {
    case "reset_from_profile":
      return {
        selectedUserId: action.profile.contactUserId ?? "",
        contactName: action.profile.contactName ?? "",
        contactPhone: action.profile.contactPhone ?? "",
        contactEmail: action.profile.contactEmail ?? "",
      };
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "apply_candidate":
      return {
        selectedUserId: action.candidate.userId,
        contactName: action.candidate.name ?? "",
        contactEmail: action.candidate.email ?? "",
        contactPhone: action.candidate.phone ?? "",
      };
    case "clear_user_selection":
      return { ...state, selectedUserId: "" };
    default:
      return state;
  }
}

export function emptyContactDraft(): ContactDraftState {
  return {
    selectedUserId: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  };
}

export function trimContactField(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function hasContactDetails(input: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): boolean {
  return Boolean(
    trimContactField(input.name) ||
      trimContactField(input.phone) ||
      trimContactField(input.email),
  );
}

export function hasContactDraftDetails(draft: ContactDraftState): boolean {
  return hasContactDetails({
    name: draft.contactName,
    phone: draft.contactPhone,
    email: draft.contactEmail,
  });
}
