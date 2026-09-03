import { Request, Response, NextFunction } from 'express';
import * as productService from './service';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productService.getProducts(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getLowStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productService.getLowStock();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await productService.getProductById(id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body };
    const result = await productService.createProduct(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    const result = await productService.updateProduct(id as string, data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { type, quantity, reason } = req.body;

    const result = await productService.adjustStock(
      id as string,
      type,
      quantity,
      reason,
      req.user!.id,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
