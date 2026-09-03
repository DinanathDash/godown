import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './service';

export const getSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await dashboardService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
};
