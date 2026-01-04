import { Request, Response, NextFunction } from "express";
interface CustomRequest extends Request {
  userId?: number;
}
export const authorise = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  next();
};
