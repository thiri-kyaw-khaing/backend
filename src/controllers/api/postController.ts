import { body, check, param, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import { checkUserExists, checkUserIfNotExists } from "../../utils/auth";
import { getUserById } from "../../services/auth";
import { getPostsWithRelations } from "../../services/post";

interface CustomRequest extends Request {
  userId?: number;
}
export const getPost = [
  param("id", "Post ID is not valid").isInt({ gt: 0 }),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    let postId = req.params.id;
    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExists(user);

    const post = await getPostsWithRelations(+postId);

    res.status(201).json({ message: "Post retrieved successfully", post });
  },
];

export const getPostsByPagination = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 to 12 digits"),
  async (req: Request, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    let phone = req.body.phone; //09123456789
    res.status(201).json({ message: "Post retrieved successfully" });
  },
];
