import { NextFunction, Request, Response } from "express";

interface CustomRequest extends Request {
  userId?: number;
}

export const changeLanguage = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {};
