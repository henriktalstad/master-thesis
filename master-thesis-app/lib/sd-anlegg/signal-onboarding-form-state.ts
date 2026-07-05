import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import {
  findPointMetadataOverride,
  type SdAnleggPointMetadataOverride,
} from "@/lib/sd-anlegg/point-metadata-overrides";
import {
  mergePointMetadataWithSuggestions,
  suggestPointMetadataOverride,
  type SignalMetadataSuggestions,
} from "@/lib/sd-anlegg/signal-onboarding-suggestions";

export type SignalOnboardingFormState = {
  objectName: string;
  description: string;
  subCentral: string;
  scopeId: string;
  schemaSlotId: string;
};

export const EMPTY_SIGNAL_ONBOARDING_FORM: SignalOnboardingFormState = {
  objectName: "",
  description: "",
  subCentral: "",
  scopeId: "",
  schemaSlotId: "",
};

type BuildInitialSignalFormStateInput = {
  point: InfraspawnPointListItem;
  overrides: readonly SdAnleggPointMetadataOverride[];
  elementKey?: string | null;
  model: ReturnType<typeof buildAhuPresentationModel>;
  preferSuggestions?: boolean;
};

export function buildInitialSignalFormState({
  point,
  overrides,
  elementKey,
  model,
  preferSuggestions,
}: BuildInitialSignalFormStateInput): SignalOnboardingFormState {
  const override = findPointMetadataOverride(overrides, point);
  const suggestions = suggestPointMetadataOverride({
    point,
    elementKey,
    model,
  });
  const merged = mergePointMetadataWithSuggestions({
    point,
    override,
    suggestions,
    autoFill: true,
    preferSuggestions,
  });

  return {
    objectName: merged.objectName,
    description: merged.description,
    subCentral: merged.subCentral,
    scopeId: merged.scopeId,
    schemaSlotId: merged.schemaSlotId,
  };
}

export type SignalOnboardingFormAction =
  | {
      type: "set_field";
      field: keyof SignalOnboardingFormState;
      value: string;
    }
  | {
      type: "apply_suggestions";
      suggestions: SignalMetadataSuggestions;
    };

export function signalOnboardingFormReducer(
  state: SignalOnboardingFormState,
  action: SignalOnboardingFormAction,
): SignalOnboardingFormState {
  switch (action.type) {
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "apply_suggestions": {
      const next = { ...state };
      const { suggestions } = action;
      if (suggestions.objectName?.value) {
        next.objectName = suggestions.objectName.value;
      }
      if (suggestions.description?.value) {
        next.description = suggestions.description.value;
      }
      if (suggestions.scopeId?.value) {
        next.scopeId = suggestions.scopeId.value;
      }
      if (suggestions.schemaSlotId?.value) {
        next.schemaSlotId = suggestions.schemaSlotId.value;
      }
      return next;
    }
    default:
      return state;
  }
}
