import { Request, Response, NextFunction } from 'express';
import * as authService from './service';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const user = await authService.getMe(userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};
