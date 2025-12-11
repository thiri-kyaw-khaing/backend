import { NextFunction, Request, Response } from "express";

interface CustomRequest extends Request {
  userId?: number;
}

export const getAllUsers = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  res.status(200).json({ message: "All Users" });
};
