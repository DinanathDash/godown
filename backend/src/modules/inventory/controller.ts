import { Request, Response } from 'express';
import * as InventoryService from './service';
import { AppError } from '../../utils/AppError';

export const getInventory = async (req: Request, res: Response) => {
  const result = await InventoryService.getInventory(
    req.query as unknown as Parameters<typeof InventoryService.getInventory>[0],
  );
  res.json(result);
};

export const adjustStock = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  const result = await InventoryService.adjustStock(req.user.id, req.body);
  res.json({ data: result });
};
