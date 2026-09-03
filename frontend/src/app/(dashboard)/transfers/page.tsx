'use client';

import { TransfersTable } from '@/features/transfers/components/TransfersTable';
import { CreateTransferDialog } from '@/features/transfers/components/CreateTransferDialog';
import { useAuthStore } from '@/store/useAuthStore';

export default function TransfersPage() {
  const { user } = useAuthStore();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'OPERATIONS';

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Internal Transfers</h2>
        <div className="flex items-center space-x-2">
          {canCreate && <CreateTransferDialog />}
        </div>
      </div>
      <TransfersTable />
    </div>
  );
}
