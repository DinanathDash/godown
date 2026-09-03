import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as Parameters<typeof service.getOrders>[0];
    const result = await service.getOrders(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = {
      ...req.body,
      createdById: req.user!.id,
    };
    const result = await service.createOrder(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function reserveOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.reserveOrder(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.cancelOrder(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
