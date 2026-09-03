import { Prisma, CustomerStatus, CustomerType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { parseCustomerSort } from './schema';

export const getCustomers = async (params: {
  page?: number;
  limit?: number;
  q?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  /** Raw query string, e.g. "name:asc,businessName:desc". */
  sort?: string;
}) => {
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 50;
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = { deletedAt: null };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { mobile: { contains: params.q } },
      { businessName: { contains: params.q, mode: 'insensitive' } },
    ];
  }

  if (params.status) where.status = params.status;
  if (params.type) where.type = params.type;

  // Sorting is server-side because the list is paginated — ordering only the
  // current page would sort 10 of N rows and read as broken. Prisma applies an
  // orderBy array in sequence, so the caller's column order is the tie-break
  // precedence.
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = parseCustomerSort(
    params.sort,
  ).map(
    (entry) =>
      entry.field === 'businessName'
        ? // businessName is nullable; keep the blanks at the bottom either way
          // rather than letting them lead the list when sorting descending.
          { businessName: { sort: entry.order, nulls: 'last' } }
        : { name: entry.order },
  );

  if (orderBy.length === 0) orderBy.push({ createdAt: 'desc' });

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getFollowUps = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const data = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      followUpDate: {
        lte: endOfWeek,
      },
      status: {
        not: CustomerStatus.INACTIVE,
      },
    },
    orderBy: { followUpDate: 'asc' },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });

  return data;
};

export const getCustomerById = async (id: string) => {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      followUpNotes: {
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } } },
      },
      challans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          challanNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!customer || customer.deletedAt) {
    throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  }

  const { followUpNotes, challans, ...customerData } = customer;

  return {
    customer: customerData,
    recentNotes: followUpNotes,
    recentChallans: challans,
  };
};

export const createCustomer = async (data: Prisma.CustomerUncheckedCreateInput) => {
  return prisma.customer.create({
    data,
  });
};

export const updateCustomer = async (id: string, data: Prisma.CustomerUncheckedUpdateInput) => {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  }

  return prisma.customer.update({
    where: { id },
    data,
  });
};

export const deleteCustomer = async (id: string) => {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  }

  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

export const addCustomerNote = async (
  customerId: string,
  note: string,
  createdById: string,
  status?: CustomerStatus,
  followUpDate?: Date | null,
) => {
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  }

  return prisma.$transaction(
    async (tx) => {
      const customerNote = await tx.customerNote.create({
        data: {
          customerId,
          note,
          createdById,
          followUpDate,
        },
      });

      if (status || followUpDate !== undefined) {
        const updateData: Prisma.CustomerUpdateInput = {};
        if (status) updateData.status = status;
        if (followUpDate !== undefined) updateData.followUpDate = followUpDate;

        await tx.customer.update({
          where: { id: customerId },
          data: updateData,
        });
      }

      return customerNote;
    },
    { timeout: 20000, maxWait: 15000 },
  );
};
