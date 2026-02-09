import { body, check, param, query, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import { checkUserExists, checkUserIfNotExists } from "../../utils/auth";
import { getUserById } from "../../services/auth";
import { getPostOptions, getPostsWithRelations } from "../../services/post";
import { get } from "http";
import { getOrSetCache } from "../../utils/cache";
import { getProductsWithRelations } from "../../services/product";

interface CustomRequest extends Request {
  userId?: number;
}
export const getProduct = [
  param("id", "Product ID is not valid").isInt({ gt: 0 }),
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
    let productId = req.params.id;
    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExists(user);

    // const post = await getPostsWithRelations(+postId);
    const cacheKey = `products:${JSON.stringify(+productId)}`;
    const product = await getOrSetCache(cacheKey, async () => {
      return await getProductsWithRelations(+productId);
    });

    res
      .status(201)
      .json({ message: "Product retrieved successfully", product });
  },
];
