// ===== Jotai atoms for app state (v2 — with auth) =====

import { atom } from 'jotai';
import type { DealerInfo, ActivationResponse, AuthUser } from '@/types';

/** Dealer code entered by user */
export const dealerCodeAtom = atom<string | null>(null);

/** Dealer info fetched from API */
export const dealerInfoAtom = atom<DealerInfo | null>(null);

/** Last activation result */
export const lastActivationAtom = atom<ActivationResponse | null>(null);

/** Customer name */
export const customerNameAtom = atom<string>('');

/** Customer phone */
export const customerPhoneAtom = atom<string>('');

// ── Auth atoms ─────────────────────────────────────────────────

/** Access token (JWT) */
export const accessTokenAtom = atom<string | null>(null);

/** Refresh token */
export const refreshTokenAtom = atom<string | null>(null);

/** Logged-in user */
export const authUserAtom = atom<AuthUser | null>(null);

/** Whether the user is authenticated */
export const isAuthenticatedAtom = atom<boolean>(
  (get) => get(authUserAtom) !== null,
);