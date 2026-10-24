"use client";

import { createAuthClient } from "better-auth/react";

// Better Auth in the browser. Same-origin, so no baseURL: requests go to this
// app's /api/auth. Only used when isBetterAuthEnabled().
export const authClient = createAuthClient({ basePath: "/api/auth" });
