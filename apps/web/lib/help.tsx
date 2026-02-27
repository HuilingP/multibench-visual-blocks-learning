"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type GlossaryEntryId =
  | "block"
  | "blockVersion"
  | "registry"
  | "semver"
  | "changelog"
  | "schema"
  | "permissions"
  | "tests"
  | "pipeline"
  | "node"
  | "edge"
  | "port"
  | "portType"
  | "batch"
  | "dataloader"
  | "modalityKey"
  | "dataset"
  | "encoder"
  | "fusion"
  | "objective"
  | "trainer"
  | "evaluator"
  | "spec"
  | "lockedBlocks"
  | "digest"
  | "run"
  | "runtimeEnv"
  | "performance"
  | "complexity"
  | "robustness"
  | "reviewFlow"
  | "paperCandidate";

export const GLOSSARY_ORDER: GlossaryEntryId[] = [
  "block",
  "blockVersion",
  "registry",
  "semver",
  "changelog",
  "schema",
  "permissions",
  "tests",
  "pipeline",
  "node",
  "edge",
  "port",
  "portType",
  "batch",
  "dataloader",
  "modalityKey",
  "dataset",
  "encoder",
  "fusion",
  "objective",
  "trainer",
  "evaluator",
  "spec",
  "lockedBlocks",
  "digest",
  "run",
  "runtimeEnv",
  "performance",
  "complexity",
  "robustness",
  "reviewFlow",
  "paperCandidate"
];

type HelpState = {
  beginnerMode: boolean;
  setBeginnerMode: (v: boolean) => void;

  glossaryOpen: boolean;
  openGlossary: (id?: GlossaryEntryId) => void;
  closeGlossary: () => void;
  activeGlossaryId: GlossaryEntryId;
  setActiveGlossaryId: (id: GlossaryEntryId) => void;
};

const LS_BEGINNER = "mb_beginner_mode";

const HelpContext = createContext<HelpState | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [activeGlossaryId, setActiveGlossaryId] = useState<GlossaryEntryId>("block");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_BEGINNER);
      if (raw === "0") setBeginnerMode(false);
      if (raw === "1") setBeginnerMode(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_BEGINNER, beginnerMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [beginnerMode]);

  const value = useMemo<HelpState>(
    () => ({
      beginnerMode,
      setBeginnerMode,
      glossaryOpen,
      openGlossary: (id?: GlossaryEntryId) => {
        if (id) setActiveGlossaryId(id);
        setGlossaryOpen(true);
      },
      closeGlossary: () => setGlossaryOpen(false),
      activeGlossaryId,
      setActiveGlossaryId
    }),
    [activeGlossaryId, beginnerMode, glossaryOpen]
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp(): HelpState {
  const v = useContext(HelpContext);
  if (!v) throw new Error("useHelp must be used within HelpProvider");
  return v;
}

