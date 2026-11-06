'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Feature Decommissioned
 * Redirects users back to the Command Center to ensure build stability.
 */
export default function RemovedNotificationPage() {
  useEffect(() => {
    redirect('/admin');
  }, []);

  return null;
}
