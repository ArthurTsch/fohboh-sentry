import { useMemo } from "react";
import { faqItems } from "../data";
import type {
  CaarRecord,
  LocationRecord,
  LogRecord,
  SchemaWorkspace,
  SessionState,
  SupportModeState,
  UploadModule,
} from "../types";
import { formatCurrency, parseCurrency } from "../utils";

function matchesSessionScope(location: LocationRecord, session: SessionState) {
  if (session.role === "WGS Manager") {
    return true;
  }

  const sessionEmail = session.email.trim().toLowerCase();
  const locationEmail = location.ownerEmail?.trim().toLowerCase() ?? "";

  if (typeof session.managerId === "number" && location.ownerManagerId === session.managerId) {
    return true;
  }

  if (locationEmail && locationEmail === sessionEmail) {
    return true;
  }

  return false;
}

export function useSentryDerivedState({
  deferredFaqQuery,
  faqSource = faqItems,
  logFilter,
  logState,
  locationState,
  schemaState,
  session,
  supportMode,
  uploadState,
  caarState,
}: {
  caarState: CaarRecord[];
  deferredFaqQuery: string;
  faqSource?: typeof faqItems;
  logFilter: "all" | "immutable" | "editable";
  logState: LogRecord[];
  locationState: LocationRecord[];
  schemaState: SchemaWorkspace[];
  session: SessionState | null;
  supportMode: SupportModeState;
  uploadState: UploadModule[];
}) {
  const scopedAccountId =
    session?.role === "WGS Manager" && supportMode.active && supportMode.accountId
      ? supportMode.accountId
      : session?.role === "WGS Manager"
        ? null
        : session?.accountId ?? null;

  const visibleLocations = useMemo(() => {
    if (!session) return [];
    return locationState.filter((location) => matchesSessionScope(location, session));
  }, [locationState, session]);

  const visibleCaars = useMemo(() => {
    if (!session) return [];
    if (!scopedAccountId) return session.role === "WGS Manager" ? caarState : [];
    return caarState.filter((record) => record.accountId === scopedAccountId);
  }, [caarState, scopedAccountId, session]);

  const visibleUploadModules = useMemo(() => {
    if (!session) return [];
    if (!scopedAccountId) return session.role === "WGS Manager" ? uploadState : [];
    return uploadState.filter((module) => module.accountId === scopedAccountId);
  }, [scopedAccountId, session, uploadState]);

  const visibleSchemaWorkspaces = useMemo(() => {
    if (!session) return [];
    if (!scopedAccountId) return session.role === "WGS Manager" ? schemaState : [];
    return schemaState.filter((workspace) => workspace.accountId === scopedAccountId);
  }, [schemaState, scopedAccountId, session]);

  const averageTrust = Math.round(
    visibleLocations.reduce((sum, location) => sum + (location.m01 + location.m02) / 2, 0) /
      Math.max(visibleLocations.length, 1),
  );

  const totalRecovery = formatCurrency(
    visibleCaars.reduce((sum, record) => sum + parseCurrency(record.amount), 0),
  );
  const totalCaars = visibleCaars.filter((record) => record.status === "Court Admissible").length;

  const filteredLogs = useMemo(() => {
    const scoped = !session
      ? []
      : !scopedAccountId
        ? session.role === "WGS Manager"
          ? logState
          : []
        : logState.filter((entry) => entry.accountId === scopedAccountId);
    if (logFilter === "immutable") return scoped.filter((entry) => entry.immutable);
    if (logFilter === "editable") return scoped.filter((entry) => !entry.immutable);
    return scoped;
  }, [logFilter, logState, scopedAccountId, session]);

  const filteredFaq = useMemo(() => {
    const query = deferredFaqQuery.trim().toLowerCase();
    if (!query) return faqSource;
    return faqSource.filter((item) =>
      [item.question, item.answer, item.topic].some((value) => value.toLowerCase().includes(query)),
    );
  }, [deferredFaqQuery, faqSource]);

  return {
    averageTrust,
    filteredFaq,
    filteredLogs,
    totalCaars,
    totalRecovery,
    visibleCaars,
    visibleLocations,
    visibleSchemaWorkspaces,
    visibleUploadModules,
  };
}
