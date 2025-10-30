import { Request, Response, NextFunction } from "express";

interface CustomRequest extends Request {
  userId?: number;
}
export const check = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const err: any = new Error("Unauthorized");
  err.status = 401;
  err.code = "Token_expired";
  return next(err);
  // Perform your checks here
  req.userId = 12345; // Example: attach a user ID to the request
  next();
};
