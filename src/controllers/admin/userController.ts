import { NextFunction, Request, Response } from "express";

interface CustomRequest extends Request {
  user?: any;
}

export const getAllUsers = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  res
    .status(200)
    .json({ message: req.t("welcome"), currentUserRole: req.user?.role });
};
