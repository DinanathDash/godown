import { prisma } from '../../lib/prisma';
import { CustomerStatus, ChallanStatus } from '@prisma/client';
import { getLowStock } from '../products/service';
import { getFollowUps } from '../customers/service';
import { startOfMonth, subMonths, format } from 'date-fns';

export const getDashboardSummary = async () => {
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [
    totalCustomers,
    activeCustomers,
    leadCustomers,
    totalProducts,
    draftChallans,
    confirmedChallans,
    cancelledChallans,
    todayChallans,
    lowStockItems,
    followUpsDue,
    monthlyChallansRaw,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null, status: CustomerStatus.ACTIVE } }),
    prisma.customer.count({ where: { deletedAt: null, status: CustomerStatus.LEAD } }),
    prisma.product.count({ where: { deletedAt: null, isActive: true } }),
    prisma.challan.count({ where: { status: ChallanStatus.DRAFT } }),
    prisma.challan.count({ where: { status: ChallanStatus.CONFIRMED } }),
    prisma.challan.count({ where: { status: ChallanStatus.CANCELLED } }),
    prisma.challan.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    getLowStock(),
    getFollowUps(),
    prisma.challan.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, status: true },
    }),
  ]);

  // Determine number of low stock products
  const lowStockCount = Array.isArray(lowStockItems) ? lowStockItems.length : 0;

  // Aggregate monthly challan stats
  const monthMap = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const monthStr = format(d, 'MMM');
    monthMap.set(monthStr, { month: monthStr, draft: 0, confirmed: 0, cancelled: 0 });
  }

  for (const c of monthlyChallansRaw) {
    const monthStr = format(c.createdAt, 'MMM');
    const entry = monthMap.get(monthStr);
    if (entry) {
      if (c.status === ChallanStatus.DRAFT) entry.draft++;
      if (c.status === ChallanStatus.CONFIRMED) entry.confirmed++;
      if (c.status === ChallanStatus.CANCELLED) entry.cancelled++;
    }
  }

  const monthlyChallans = Array.from(monthMap.values());

  return {
    customers: {
      total: totalCustomers,
      active: activeCustomers,
      lead: leadCustomers,
    },
    products: {
      total: totalProducts,
      lowStock: lowStockCount,
    },
    challans: {
      draft: draftChallans,
      confirmed: confirmedChallans,
      cancelled: cancelledChallans,
      todayCount: todayChallans,
    },
    monthlyChallans,
    lowStockItems,
    followUpsDue,
  };
};
