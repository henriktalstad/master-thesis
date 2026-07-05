"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type SetStateAction,
} from "react";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { isSdAnleggProcessSchemaTemplate } from "@/lib/sd-anlegg/schema-template-ids";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";
import type { SdAnleggWorkspaceView } from "./sd-anlegg-workspace-tabs";
import {
  readSdAnleggStoredView,
  useSdAnleggWorkspaceUrlSync,
  wrapSdAnleggViewSetter,
} from "./use-sd-anlegg-workspace-url";
import { resolveSchemaDefaultSlotKey } from "@/lib/sd-anlegg/resolve-schema-default-slot-key";

type NavState = {
  view: SdAnleggWorkspaceView;
  selectedKeys: string[];
  preferredSchema: boolean;
  storageHydrated: boolean;
};

type NavAction =
  | { type: "hydrate_storage"; view: SdAnleggWorkspaceView }
  | { type: "reset_scope" }
  | { type: "apply_deep_link"; key: string }
  | { type: "prefer_schema" }
  | { type: "select_default"; key: string }
  | { type: "set_view"; view: SdAnleggWorkspaceView }
  | { type: "set_selected"; update: SetStateAction<string[]> };

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "hydrate_storage":
      return {
        ...state,
        storageHydrated: true,
        view: action.view,
        preferredSchema: action.view === "schema" || state.preferredSchema,
      };
    case "reset_scope":
      return { ...state, selectedKeys: [] };
    case "apply_deep_link":
      return {
        ...state,
        view: "schema",
        selectedKeys: [action.key],
        preferredSchema: true,
      };
    case "prefer_schema":
      return state.preferredSchema
        ? state
        : { ...state, view: "schema", preferredSchema: true };
    case "select_default":
      return state.selectedKeys.includes(action.key)
        ? state
        : { ...state, selectedKeys: [action.key] };
    case "set_view":
      return state.view === action.view ? state : { ...state, view: action.view };
    case "set_selected":
      return {
        ...state,
        selectedKeys:
          typeof action.update === "function"
            ? action.update(state.selectedKeys)
            : action.update,
      };
    default:
      return state;
  }
}

type Input = {
  buildingSlug: string;
  initialViewFromUrl: SdAnleggWorkspaceView | null;
  pointsScopeKey: string;
  points: readonly InfraspawnPointListItem[];
  pointsByKey: ReadonlyMap<string, InfraspawnPointListItem>;
  schemaTemplateId?: string | null;
  elementKey?: string | null;
  schemaSlotOverrides: ReadonlyMap<string, string>;
};

export function useSdAnleggWorkspaceNavigation({
  buildingSlug,
  initialViewFromUrl,
  pointsScopeKey,
  points,
  pointsByKey,
  schemaTemplateId,
  elementKey,
  schemaSlotOverrides,
}: Input) {
  const { syncViewToUrl, syncPointToUrl, urlPoint } = useSdAnleggWorkspaceUrlSync({
    buildingSlug,
  });

  const [state, dispatch] = useReducer(navReducer, {
    view: initialViewFromUrl ?? "list",
    selectedKeys: [],
    preferredSchema: initialViewFromUrl != null,
    storageHydrated: initialViewFromUrl != null,
  });

  const deepLinkRef = useRef<string | null>(null);
  const defaultSlotScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.storageHydrated || initialViewFromUrl) return;
    const stored = readSdAnleggStoredView(buildingSlug);
    if (!stored) {
      dispatch({ type: "hydrate_storage", view: "list" });
      return;
    }
    dispatch({ type: "hydrate_storage", view: stored });
  }, [buildingSlug, initialViewFromUrl, state.storageHydrated]);

  useEffect(() => {
    dispatch({ type: "reset_scope" });
    deepLinkRef.current = null;
    defaultSlotScopeRef.current = null;
  }, [pointsScopeKey]);

  useEffect(() => {
    if (!urlPoint) return;
    const key = sdAnleggPointKey(urlPoint);
    if (!pointsByKey.has(key)) return;
    if (deepLinkRef.current === key) return;

    deepLinkRef.current = key;
    defaultSlotScopeRef.current = pointsScopeKey;
    dispatch({ type: "apply_deep_link", key });
    syncViewToUrl("schema");
  }, [urlPoint, pointsByKey, pointsScopeKey, syncViewToUrl]);

  useEffect(() => {
    const hasProcessSchema =
      isSdAnleggProcessSchemaTemplate(schemaTemplateId) && points.length > 0;
    if (!hasProcessSchema || state.preferredSchema) return;
    dispatch({ type: "prefer_schema" });
    syncViewToUrl("schema");
  }, [points.length, schemaTemplateId, state.preferredSchema, syncViewToUrl]);

  useEffect(() => {
    if (state.view !== "schema" || points.length === 0) return;
    if (state.selectedKeys.some((key) => pointsByKey.has(key))) return;
    if (defaultSlotScopeRef.current === pointsScopeKey) return;

    const defaultKey = resolveSchemaDefaultSlotKey({
      schemaTemplateId,
      elementKey,
      schemaSlotOverrides,
      points,
    });
    if (!defaultKey) return;

    defaultSlotScopeRef.current = pointsScopeKey;
    dispatch({ type: "select_default", key: defaultKey });
  }, [
    state.view,
    state.selectedKeys,
    points,
    pointsByKey,
    pointsScopeKey,
    schemaTemplateId,
    elementKey,
    schemaSlotOverrides,
  ]);

  const setViewState = useCallback((view: SdAnleggWorkspaceView) => {
    dispatch({ type: "set_view", view });
  }, []);

  const setView = useMemo(
    () => wrapSdAnleggViewSetter(setViewState, syncViewToUrl),
    [setViewState, syncViewToUrl],
  );

  const setSelectedKeys = useCallback(
    (update: SetStateAction<string[]>, options?: { skipUrl?: boolean }) => {
      let nextKeys: string[] = [];
      dispatch({
        type: "set_selected",
        update: (prev) => {
          nextKeys = typeof update === "function" ? update(prev) : update;
          return nextKeys;
        },
      });
      if (!options?.skipUrl) {
        queueMicrotask(() => syncPointToUrl(nextKeys[0] ?? null));
      }
    },
    [syncPointToUrl],
  );

  return {
    view: state.view,
    setView,
    selectedKeys: state.selectedKeys,
    setSelectedKeys,
  };
}
