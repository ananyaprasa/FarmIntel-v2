import { useCallback, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getCurrentUser, logout } from "./api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./auth-context";

const currentUserQueryKey = ["auth", "me"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const currentUserQuery = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: Infinity,
  });

  const status: AuthStatus = currentUserQuery.isPending
    ? "loading"
    : currentUserQuery.isError
      ? "error"
      : currentUserQuery.data
        ? "authenticated"
        : "unauthenticated";

  const retry = useCallback(() => {
    setSignOutError(null);
    void currentUserQuery.refetch();
  }, [currentUserQuery]);

  const signOut = useCallback(async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await logout();
      queryClient.setQueryData(currentUserQueryKey, null);
    } catch {
      setSignOutError("Sign out failed. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    status,
    user: status === "authenticated" ? (currentUserQuery.data ?? null) : null,
    error: status === "error" ? "Unable to check your sign-in status." : null,
    retry,
    signOut,
    isSigningOut,
    signOutError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
