import { Request, Response, NextFunction } from "express";
import { errorCode } from "../config/errorCode";
import { getUserById } from "../services/auth";
import { createError } from "../utils/error";

import { create } from "domain";
interface CustomRequest extends Request {
  userId?: number;
  user?: any;
}
export const authorise = (permission: boolean, ...roles: string[]) => {
  return async (req: CustomRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const user = await getUserById(userId!);
    if (!user) {
      return next(
        createError(
          "You are not an authenticated user.",
          401,
          errorCode.unauthenticated,
        ),
      );
    }

    const result = roles.includes(user.role);

    // permission && result

    if (permission && !result) {
      return next(
        createError(
          "This action is allowed for specific roles only.",
          403,
          errorCode.unauthorised,
        ),
      );
    }

    if (!permission && result) {
      return next(
        createError(
          "This action is not allowed for your role.",
          403,
          errorCode.unauthorised,
        ),
      );
    }

    req.user = user;
    next();
  };
};
