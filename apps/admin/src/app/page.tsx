'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AREA_DEFINITIONS } from '../lib/areas';
import { useSession } from '../lib/session';

/**
 * La radice non è una schermata: è uno smistamento. Chi non ha sessione va
 * all'accesso, chi ha già una veste entra nella sua area, chi ne ha più d'una
 * va a scegliere (`ux-proposals.md` §4.3).
 */
export default function Home(): null {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/accesso');
    else if (user.activeArea) router.replace(AREA_DEFINITIONS[user.activeArea].href);
    else router.replace('/scelta-area');
  }, [loading, user, router]);

  return null;
}
