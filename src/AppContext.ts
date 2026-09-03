import { createContext, useContext } from "react";
import { App } from "obsidian";
import { DatabaseModel } from "./types";

export const AppContext = createContext<App>(null!);

export function useApp(): App {
  return useContext(AppContext);
}

export const DatabasePathContext = createContext<string>("");

export function useDatabasePath(): string {
  return useContext(DatabasePathContext);
}

export const DatabaseModelContext = createContext<DatabaseModel | null>(null);

export function useDatabaseModel(): DatabaseModel | null {
  return useContext(DatabaseModelContext);
}

export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement {
  const container = useContext(PortalContainerContext);
  return container ?? activeDocument.body;
}
