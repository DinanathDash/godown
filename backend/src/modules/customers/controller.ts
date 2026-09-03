import { Request, Response, NextFunction } from 'express';
import * as customerService from './service';

export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.getCustomers(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getFollowUps = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await customerService.getFollowUps();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await customerService.getCustomerById(id as string);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body, createdById: req.user!.id };
    // Optionally transform followUpDate if provided
    if (data.followUpDate) data.followUpDate = new Date(data.followUpDate);
    const result = await customerService.createCustomer(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.followUpDate) data.followUpDate = new Date(data.followUpDate);
    if (data.followUpDate === null) data.followUpDate = null;
    const result = await customerService.updateCustomer(id as string, data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await customerService.deleteCustomer(id as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const addNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { note, status, followUpDate } = req.body;

    let parsedFollowUpDate = undefined;
    if (followUpDate) parsedFollowUpDate = new Date(followUpDate);
    else if (followUpDate === null) parsedFollowUpDate = null;

    const result = await customerService.addCustomerNote(
      id as string,
      note,
      req.user!.id,
      status,
      parsedFollowUpDate,
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
