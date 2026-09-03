import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getWorkOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as Parameters<typeof service.getWorkOrders>[0];
    const result = await service.getWorkOrders(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createWorkOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body;
    const result = await service.createWorkOrder(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getWorkOrderByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getWorkOrderById(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateWorkOrderStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { status } = req.body;
    const result = await service.updateWorkOrderStatus(req.params.id as string, status);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
