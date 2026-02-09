import { body, check, param, query, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import { checkUserIfNotExists } from "../../utils/auth";
import { getUserById } from "../../services/auth";

import { getOrSetCache } from "../../utils/cache";
import {
  getProductsList,
  getProductsWithRelations,
} from "../../services/product";
import { createError } from "../../utils/error";
import { errorCode } from "../../config/errorCode";

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

export const getProductsByPagination = [
  query("cursor", "Cursor must be Post ID.").isInt({ gt: 0 }).optional(),
  query("limit", "Limit number must be unsigned integer.")
    .isInt({ gt: 3 })
    .optional(),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    // If validation error occurs
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const lastCursor = req.query.cursor;
    const limit = req.query.limit || 5;
    const category = req.query.category;
    const type = req.query.type;

    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExists(user);

    let categoryList: number[] = [];
    let typeList: number[] = [];

    if (category) {
      categoryList = category
        .toString()
        .split(",")
        .map((c) => Number(c))
        .filter((c) => c > 0);
    }

    if (type) {
      typeList = type
        .toString()
        .split(",")
        .map((t) => Number(t))
        .filter((t) => t > 0);
    }

    console.log("categoryList -----", categoryList);

    const where = {
      AND: [
        categoryList.length > 0 ? { categoryId: { in: categoryList } } : {},
        typeList.length > 0 ? { typeId: { in: typeList } } : {},
      ],
    };

    const options = {
      where,
      take: +limit + 1,
      skip: lastCursor ? 1 : 0,
      cursor: lastCursor ? { id: +lastCursor } : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        discount: true,
        status: true,
        images: {
          select: {
            id: true,
            path: true,
          },
          take: 1, // Limit to the first image
        },
      },
      orderBy: {
        id: "desc",
      },
    };

    const cacheKey = `products:${JSON.stringify(req.query)}`;
    const products = await getOrSetCache(cacheKey, async () => {
      return await getProductsList(options);
    });

    const hasNextPage = products.length > +limit;

    if (hasNextPage) {
      products.pop();
    }

    const nextCursor =
      products.length > 0 ? products[products.length - 1].id : null;

    res.status(200).json({
      message: "Get All infinite products",
      hasNextPage,
      nextCursor,
      prevCursor: lastCursor,
      products,
    });
  },
];
