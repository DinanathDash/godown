import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getTransfersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as Parameters<typeof service.getTransfers>[0];
    const result = await service.getTransfers(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createTransferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = req.body;
    const result = await service.createTransfer(userId, data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function dispatchTransferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const transferId = req.params.id as string;
    const result = await service.dispatchTransfer(transferId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function receiveTransferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const transferId = req.params.id as string;
    const result = await service.receiveTransfer(transferId, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelTransferHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const transferId = req.params.id as string;
    const result = await service.cancelTransfer(transferId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
