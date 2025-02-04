import { Request, Response, NextFunction } from 'express';

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };

export default isAuthenticated;