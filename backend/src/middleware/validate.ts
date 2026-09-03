import { Request, Response, NextFunction } from 'express';
import { ZodObject } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);

      next();
    } catch (error) {
      next(error);
    }
  };
};
