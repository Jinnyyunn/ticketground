"use client";

import { useCallback, useEffect, useState } from "react";
import { clearSessionUser, getSession, SESSION_USER_CHANGED_EVENT, storedSessionUserId, TicketgroundApiError } from "@/lib/ticketground-api";

export function useSessionAuth() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const syncAuthState = () => {
      const userId = storedSessionUserId();
      if (!userId) {
        setSignedIn(false);
        return;
      }
      void getSession(userId)
        .then(() => {
          if (active) setSignedIn(storedSessionUserId() === userId);
        })
        .catch((error: unknown) => {
          if (error instanceof TicketgroundApiError && error.code === "USER_NOT_FOUND") clearSessionUser();
          if (active) setSignedIn(false);
        });
    };
    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener(SESSION_USER_CHANGED_EVENT, syncAuthState);
    return () => {
      active = false;
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener(SESSION_USER_CHANGED_EVENT, syncAuthState);
    };
  }, []);

  const signOut = useCallback(() => {
    clearSessionUser();
    setSignedIn(false);
  }, []);

  return { signedIn, signOut };
}
