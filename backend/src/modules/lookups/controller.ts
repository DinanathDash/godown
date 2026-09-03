import { Request, Response } from 'express';
import * as LookupService from './service';

export const listLocations = async (_req: Request, res: Response) => {
  res.json({ data: await LookupService.getLocations() });
};

export const listCategories = async (_req: Request, res: Response) => {
  res.json({ data: await LookupService.getCategories() });
};

export const listItems = async (_req: Request, res: Response) => {
  res.json({ data: await LookupService.getItems() });
};

export const listBatches = async (req: Request, res: Response) => {
  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
  res.json({ data: await LookupService.getBatches(itemId) });
};

export const listCustomers = async (_req: Request, res: Response) => {
  res.json({ data: await LookupService.getCustomers() });
};

export const listUsers = async (_req: Request, res: Response) => {
  res.json({ data: await LookupService.getUsers() });
};
