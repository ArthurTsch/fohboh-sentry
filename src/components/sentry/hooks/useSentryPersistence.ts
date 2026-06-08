import { useEffect } from "react";
import type {
  CaarRecord,
  IntakeState,
  LocationRecord,
  LogRecord,
  PersistedSentryState,
  SchemaWorkspace,
  SupportModeState,
  UploadModule,
  WgsApproval,
  WgsOnboardingProgress,
  WgsQueueItem,
  WgsUser,
} from "../types";

export const SENTRY_PERSISTENCE_KEY = "fohboh-sentry-state-v1";

type PersistedStateValues = Omit<PersistedSentryState, never>;

type PersistedStateSetters = {
  setArtifactContractState: (value: Record<string, Record<string, string>>) => void;
  setArtifactIntakeState: (value: Record<string, IntakeState>) => void;
  setCaarState: (value: CaarRecord[]) => void;
  setLocationState: (value: LocationRecord[]) => void;
  setLogState: (value: LogRecord[]) => void;
  setOnboardingState: (value: Record<string, boolean[]>) => void;
  setSchemaState: (value: SchemaWorkspace[]) => void;
  setSupportMode: (value: SupportModeState) => void;
  setUploadState: (value: UploadModule[]) => void;
  setWgsApprovalState: (value: WgsApproval[]) => void;
  setWgsOnboardingState: (value: Record<string, WgsOnboardingProgress>) => void;
  setWgsQueueState: (value: WgsQueueItem[]) => void;
  setWgsUserState: (value: WgsUser[]) => void;
};

export function useSentryPersistence(state: PersistedStateValues, setters: PersistedStateSetters) {
  const {
    setArtifactContractState,
    setArtifactIntakeState,
    setCaarState,
    setLocationState,
    setLogState,
    setOnboardingState,
    setSchemaState,
    setSupportMode,
    setUploadState,
    setWgsApprovalState,
    setWgsOnboardingState,
    setWgsQueueState,
    setWgsUserState,
  } = setters;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SENTRY_PERSISTENCE_KEY);
      if (!raw) return;

      const persisted = JSON.parse(raw) as Partial<PersistedSentryState>;
      if (persisted.caarState) setCaarState(persisted.caarState);
      if (persisted.locationState) setLocationState(persisted.locationState);
      if (persisted.logState) setLogState(persisted.logState);
      if (persisted.uploadState) setUploadState(persisted.uploadState);
      if (persisted.schemaState) setSchemaState(persisted.schemaState);
      if (persisted.wgsQueueState) setWgsQueueState(persisted.wgsQueueState);
      if (persisted.wgsApprovalState) setWgsApprovalState(persisted.wgsApprovalState);
      if (persisted.wgsUserState) setWgsUserState(persisted.wgsUserState);
      if (persisted.wgsOnboardingState) setWgsOnboardingState(persisted.wgsOnboardingState);
      if (persisted.onboardingState) setOnboardingState(persisted.onboardingState);
      if (persisted.artifactIntakeState) setArtifactIntakeState(persisted.artifactIntakeState);
      if (persisted.artifactContractState) setArtifactContractState(persisted.artifactContractState);
      if (persisted.supportMode) setSupportMode(persisted.supportMode);
    } catch {
      // Ignore invalid local persistence and fall back to defaults.
    }
  }, [
    setArtifactContractState,
    setArtifactIntakeState,
    setCaarState,
    setLocationState,
    setLogState,
    setOnboardingState,
    setSchemaState,
    setSupportMode,
    setUploadState,
    setWgsApprovalState,
    setWgsOnboardingState,
    setWgsQueueState,
    setWgsUserState,
  ]);

  useEffect(() => {
    window.localStorage.setItem(SENTRY_PERSISTENCE_KEY, JSON.stringify(state));
  }, [state]);
}
