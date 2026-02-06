import { body, check, param, query, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";
import { checkUserExists, checkUserIfNotExists } from "../../utils/auth";
import { getUserById } from "../../services/auth";
import { getPostOptions, getPostsWithRelations } from "../../services/post";
import { get } from "http";
import { getOrSetCache } from "../../utils/cache";

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

// OffSet Pagination
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

    const posts = await getPostOptions(options);

    const hasNextPage = posts.length > +limit;
    if (hasNextPage) {
      posts.pop();
    }
    const nextPage = hasNextPage ? +page + 1 : null;
    res.status(201).json({
      message: "Post retrieved successfully",
      currentPage: +page,
      hasNextPage,
      nextPage,
      posts,
    });
  },
];

// export const getInfinitePostsByPagination = [
//   query("cursor", "Page must be a positive integer")
//     .optional()
//     .isInt({ gt: 0 }),
//   query("limit", "Limit must be a positive integer")
//     .optional()
//     .isInt({ gt: 4 }),
//   async (req: CustomRequest, res: Response, next: NextFunction) => {
//     // Registration logic here
//     const errors = validationResult(req).array({ onlyFirstError: true });
//     //if vlidation error occurs
//     if (errors.length > 0) {
//       const error: any = new Error(errors[0].msg);
//       error.status = 400;
//       error.code = "Error_Invalid";
//       return next(error);
//     }
//     const lastCursor = req.query.cursor;
//     const limit = req.query.limit || 5;
//     const userId = req.userId;
//     const user = await getUserById(userId!);
//     checkUserIfNotExists(user);

//     const options = {
//       take: +limit + 1,
//       skip: lastCursor ? 1 : 0,
//       cursor: lastCursor ? { id: +lastCursor } : undefined,
//       select: {
//         id: true,
//         title: true,
//         content: true,
//         image: true,
//         updatedAt: true,
//         author: {
//           select: {
//             fullName: true,
//           },
//         },
//       },
//       orderBy: {
//         id: "desc",
//       },
//     };
//     const posts = await getPostOptions(options);

//     const hasNextPage = posts.length > +limit;

//     if (hasNextPage) {
//       posts.pop();
//     }

//     const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

//     res.status(200).json({
//       message: "Get All infinite posts",
//       hasNextPage,
//       nextCursor,
//       prevCursor: lastCursor,
//       posts,
//     });
//   },
// ];

export const getInfinitePostsByPagination = [
  query("cursor", "Cursor must be Post ID.").isInt({ gt: 0 }).optional(),
  query("limit", "Limit number must be unsigned integer.")
    .isInt({ gt: 2 })
    .optional(),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    console.log("Fetching infinite posts with cursor pagination...");
    const errors = validationResult(req).array({ onlyFirstError: true });
    // If validation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const lastCursor = req.query.cursor;
    const limit = req.query.limit || 5;

    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExists(user);
    console.log("Last Cursor:", lastCursor);

    const options = {
      take: +limit + 1,
      skip: lastCursor ? 1 : 0,
      cursor: lastCursor ? { id: +lastCursor } : undefined,
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
        id: "desc",
      },
    };

    try {
      // const posts = await getPostOptions(options);
      const cacheKey = `posts:${JSON.stringify(req.query)}`;
      const posts = await getOrSetCache(cacheKey, async () => {
        return await getPostOptions(options);
      });
      const hasNextPage = posts.length > +limit;

      if (hasNextPage) {
        posts.pop();
      }

      const nextCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

      res.status(200).json({
        message: "Get All infinite posts",
        hasNextPage,
        nextCursor,
        prevCursor: lastCursor,
        posts,
      });
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Internal server error" });
    }

    // const cacheKey = `posts:${JSON.stringify(req.query)}`;
    // const posts = await getOrSetCache(cacheKey, async () => {
    //   return await getPostsList(options);
    // });
  },
];
