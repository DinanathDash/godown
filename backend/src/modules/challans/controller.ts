import { Request, Response, NextFunction } from 'express';
import * as challanService from './service';

export const getChallans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await challanService.getChallans(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getChallanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await challanService.getChallanById(id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createChallan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, items, notes, status } = req.body;
    const result = await challanService.createChallan(
      customerId,
      items,
      req.user!.id,
      notes,
      status,
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateChallan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { items, notes } = req.body;
    const result = await challanService.updateChallan(id as string, items, notes);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const confirmChallan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await challanService.confirmChallan(id as string, req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const cancelChallan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await challanService.cancelChallan(id as string, req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
