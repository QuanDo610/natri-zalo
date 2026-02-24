// ===== Jotai atoms for app state =====

import { atom } from 'jotai';
import type { DealerInfo, ActivationResponse } from '@/types';

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
