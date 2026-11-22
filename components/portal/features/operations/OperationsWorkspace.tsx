'use client';
import LegacyOperationsWorkspace from '../../legacy-aolms/LegacyOperationsWorkspace.jsx';

type Role = 'admin' | 'controller';

/**
 * The operational backend was migrated intact. Render its established UI here
 * so the portal retains tables, charts, validation and final-output workflows.
 */
export default function OperationsWorkspace({ role }: { role: Role }) {
  return <LegacyOperationsWorkspace role={role} />;
}
