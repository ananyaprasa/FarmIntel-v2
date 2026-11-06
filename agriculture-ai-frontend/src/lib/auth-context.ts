import { createContext, useContext } from "react";

import type { AuthenticatedUser } from "./api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  error: string | null;
  retry: () => void;
  signOut: () => Promise<void>;
  isSigningOut: boolean;
  signOutError: string | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
