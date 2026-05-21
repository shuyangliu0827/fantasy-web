// lib/auth/use-current-user-roles.ts
//
// Client-side hook that resolves the current user's RoleContext via
// /api/me/roles. Backed by a module-level cache so multiple components
// (e.g. LightHeader, SideNav, AccessDenied) trigger a single fetch per
// session. Non-fatal — failures resolve to the anonymous default.

"use client";

import { useEffect, useState } from "react";
import { basketballFetch } from "@/lib/basketball/client";
import {
  EMPTY_ROLE_CONTEXT,
  type RoleContext,
} from "@/lib/auth/getCurrentUserRole";

let cached: RoleContext | null = null;
let inFlight: Promise<RoleContext> | null = null;
const listeners = new Set<(ctx: RoleContext) => void>();

async function fetchRoles(): Promise<RoleContext> {
  try {
    const res = await basketballFetch("/api/me/roles");
    if (!res.ok) return EMPTY_ROLE_CONTEXT;
    const body = (await res.json()) as Partial<RoleContext> | null;
    if (!body || typeof body !== "object") return EMPTY_ROLE_CONTEXT;
    return { ...EMPTY_ROLE_CONTEXT, ...body };
  } catch {
    return EMPTY_ROLE_CONTEXT;
  }
}

function loadRoles(): Promise<RoleContext> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = fetchRoles().then((ctx) => {
    cached = ctx;
    inFlight = null;
    listeners.forEach((fn) => fn(ctx));
    return ctx;
  });
  return inFlight;
}

/** Invalidate the cached role context (call after login/logout). */
export function resetCurrentUserRoles(): void {
  cached = null;
  inFlight = null;
  listeners.forEach((fn) => fn(EMPTY_ROLE_CONTEXT));
}

export function useCurrentUserRoles(): {
  roles: RoleContext;
  loading: boolean;
} {
  const [roles, setRoles] = useState<RoleContext>(cached ?? EMPTY_ROLE_CONTEXT);
  const [loading, setLoading] = useState<boolean>(cached === null);

  useEffect(() => {
    let active = true;
    const handler = (ctx: RoleContext) => {
      if (!active) return;
      setRoles(ctx);
      setLoading(false);
    };
    listeners.add(handler);

    if (!cached) {
      loadRoles().then((ctx) => {
        if (!active) return;
        setRoles(ctx);
        setLoading(false);
      });
    }

    return () => {
      active = false;
      listeners.delete(handler);
    };
  }, []);

  return { roles, loading };
}
