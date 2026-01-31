import { body, check, param, query, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import { checkUserExists, checkUserIfNotExists } from "../../utils/auth";
import { getUserById } from "../../services/auth";
import { getPostOffSet, getPostsWithRelations } from "../../services/post";
import { get } from "http";

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
  query("page", "Page must be a positive integer").optional().isInt({ gt: 0 }),
  query("limit", "Limit must be a positive integer")
    .optional()
    .isInt({ gt: 0 }),
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
    const page = req.query.page || 1;
    let limit = req.query.limit || 5;
    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExists(user);

    const skip = (+page - 1) * +limit;

    const options = {
      skip,
      take: +limit + 1,
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        updatedAt: true,
        author: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    };

    const posts = await getPostOffSet(options);

    const hasNextPage = posts.length > +limit;
    if (hasNextPage) {
      posts.pop();
    }
    const nextPage = hasNextPage ? +page + 1 : null;
    res
      .status(201)
      .json({
        message: "Post retrieved successfully",
        currentPage: +page,
        hasNextPage,
        nextPage,
        posts,
      });
  },
];
