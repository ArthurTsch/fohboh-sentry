import { useMemo } from "react";
import { faqItems } from "../data";
import type {
  CaarRecord,
  LocationRecord,
  LogRecord,
  SchemaWorkspace,
  SupportModeState,
  UploadModule,
} from "../types";
import { formatCurrency, parseCurrency } from "../utils";

export function useSentryDerivedState({
  deferredFaqQuery,
  faqSource = faqItems,
  logFilter,
  logState,
  locationState,
  schemaState,
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
  supportMode: SupportModeState;
  uploadState: UploadModule[];
}) {
  const visibleLocations = useMemo(() => {
    if (!supportMode.active || !supportMode.accountId) return locationState;
    return locationState.filter((location) => location.accountId === supportMode.accountId);
  }, [locationState, supportMode]);

  const visibleCaars = useMemo(() => {
    if (!supportMode.active || !supportMode.accountId) return caarState;
    return caarState.filter((record) => record.accountId === supportMode.accountId);
  }, [caarState, supportMode]);

  const visibleUploadModules = useMemo(() => {
    if (!supportMode.active || !supportMode.accountId) return uploadState;
    return uploadState.filter((module) => module.accountId === supportMode.accountId);
  }, [supportMode, uploadState]);

  const visibleSchemaWorkspaces = useMemo(() => {
    if (!supportMode.active || !supportMode.accountId) return schemaState;
    return schemaState.filter((workspace) => workspace.accountId === supportMode.accountId);
  }, [schemaState, supportMode]);

  const averageTrust = Math.round(
    visibleLocations.reduce((sum, location) => sum + (location.m01 + location.m02) / 2, 0) /
      Math.max(visibleLocations.length, 1),
  );

  const totalRecovery = formatCurrency(
    visibleCaars.reduce((sum, record) => sum + parseCurrency(record.amount), 0),
  );
  const totalCaars = visibleCaars.filter((record) => record.status === "Court Admissible").length;

  const filteredLogs = useMemo(() => {
    const scoped =
      supportMode.active && supportMode.accountId
        ? logState.filter((entry) => entry.accountId === supportMode.accountId)
        : logState;
    if (logFilter === "immutable") return scoped.filter((entry) => entry.immutable);
    if (logFilter === "editable") return scoped.filter((entry) => !entry.immutable);
    return scoped;
  }, [logFilter, logState, supportMode]);

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
