import { body, check, validationResult } from "express-validator";
import sanitizeHtml from "sanitize-html";
import { NextFunction, Request, Response } from "express";
import { getUserById } from "../../services/auth";
import { checkUserIfNotExists } from "../../utils/auth";
import { checkUploadFile } from "../../utils/check";
import ImageQueue from "../../jobs/queues/imageQueue";
import {
  createOnePost,
  deleteOnePost,
  getPostById,
  updateOnePost,
} from "../../services/post";
import path from "path";
import { unlink } from "fs/promises";
import { errorCode } from "../../config/errorCode";
import { createError } from "../../utils/error";
import { get } from "http";
import { checkModelExist } from "../../middlewares/check";
import { cacheQueue } from "../../jobs/queues/cacheQueue";
import { PostArgs } from "../../services/post";
interface CustomRequest extends Request {
  userId?: number;
  user?: any;
  files?: any;
}

const BASE_UPLOAD_DIR = path.join(__dirname, "../../..", "uploads");

const removeFiles = async (
  originalFile: string | null,
  optimizedFile: string | null,
) => {
  try {
    // ---- ORIGINAL IMAGE (uploads/images) ----
    if (originalFile) {
      const originalFileName = path.basename(originalFile);

      const originalPath = path.join(
        BASE_UPLOAD_DIR,
        "images",
        originalFileName,
      );

      console.log("Attempting to delete original file:", originalPath);

      try {
        await unlink(originalPath);
        console.log("Deleted original file:", originalPath);
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
        console.log("Original file not found, skipping:", originalPath);
      }
    }

    // ---- OPTIMIZED IMAGE (uploads/optimize) ----
    if (optimizedFile) {
      const optimizedFileName = path.basename(optimizedFile);

      const optimizedPath = path.join(
        BASE_UPLOAD_DIR,
        "optimize",
        optimizedFileName,
      );

      console.log("Attempting to delete optimized file:", optimizedPath);

      try {
        await unlink(optimizedPath);
        console.log("Deleted optimized file:", optimizedPath);
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
        console.log("Optimized file not found, skipping:", optimizedPath);
      }
    }
  } catch (error) {
    console.error("Error deleting files:", error);
  }
};

console.log("BASE_UPLOAD_DIR:", BASE_UPLOAD_DIR);

export const createPost = [
  body("title", "Title is required.").trim().notEmpty().escape(),
  body("content", "Content is required.").trim().notEmpty().escape(),
  body("body", "Body is required.")
    .trim()
    .notEmpty()
    .customSanitizer((value) => sanitizeHtml(value))
    .notEmpty(),
  body("category", "Category is required.").trim().notEmpty().escape(),
  body("type", "Type is required.").trim().notEmpty().escape(),
  body("tags", "Tag is invalid.")
    .optional({ nullable: true })
    .customSanitizer((value) => {
      if (value) {
        return value.split(",").filter((tag: string) => tag.trim() !== "");
      }
      return value;
    }),

  async (req: CustomRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    // If validation error occurs
    if (errors.length > 0) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { title, content, body, category, type, tags } = req.body;
    // const userId = req.userId;
    const user = req.user;
    checkUploadFile(req.file);
    // const user = await getUserById(userId!);
    // if (!user) {
    //   if (req.file) {
    //     await removeFiles(req.file.filename, null);
    //   }

    //   return next(
    //     createError(
    //       "This user has not registered.",
    //       401,
    //       errorCode.unauthenticated
    //     )
    //   );
    // }

    const splitFileName = req.file?.filename.split(".")[0];
    console.log("Split file name:", splitFileName);
    console.log("File path:", req.file?.path);
    console.log("File name:", req.file?.filename);

    await ImageQueue.add(
      "optimize-image",
      {
        filePath: req.file?.path,
        fileName: `${splitFileName}.webp`,
        width: 835,
        height: 577,
        quality: 100,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    );

    const data: PostArgs = {
      title,
      content,
      body,
      image: req.file!.filename,
      authorId: user!.id,
      category,
      type,
      tags,
    };

    const post = await createOnePost(data);

    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      },
    );

    res
      .status(201)
      .json({
        message: "Successfully created a new post.",
        postId: post.id,
        imagename: post.image,
      });
  },
];

export const updatePost = [
  body("postId", "Post ID is required.").trim().notEmpty().isInt({ min: 1 }),

  body("title", "Title is required.").trim().notEmpty().escape(),
  body("content", "Content is required.").trim().notEmpty().escape(),
  body("body", "Body is required.")
    .trim()
    .notEmpty()
    .customSanitizer((value) => sanitizeHtml(value))
    .notEmpty(),
  body("category", "Category is required.").trim().notEmpty().escape(),
  body("type", "Type is required.").trim().notEmpty().escape(),
  body("tags", "Tag is invalid.")
    .optional({ nullable: true })
    .customSanitizer((value) => {
      if (value) {
        return value.split(",").filter((tag: string) => tag.trim() !== "");
      }
      return value;
    }),
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }
    let { postId, title, content, body, category, type, tags } = req.body;
    // const userId = req.userId;
    const user = req.user;
    // const user = await getUserById(userId!);
    // if (!user) {
    //   if (req.file) {
    //     await removeFiles(req.file.filename, null);
    //   }
    //   return next(
    //     createError("User not found", 404, errorCode.unauthenticated),
    //   );
    // }
    //if post id are not the same
    const post = await getPostById(+postId);
    if (!post) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(
        createError("Post not found", 404, errorCode.unauthenticated),
      );
    }

    //if author id is not same as login user id
    if (post.authorId !== user.id) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(createError("Unauthorized", 403, errorCode.unauthorised));
    }

    //if update new image
    const data: any = {
      title,
      content,
      body,
      image: req.file,
      category,
      type,
      tags,
    };
    if (req.file) {
      data.image = req.file.filename;

      const splitFileName = req.file.filename.split(".")[0];

      await ImageQueue.add(
        "optimize-image",
        {
          filePath: req.file?.path,
          fileName: `${splitFileName}.webp`,
          width: 835,
          height: 577,
          quality: 100,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
        },
      );
      //remove old files
      const optimizedFile = post.image.split(".")[0] + ".webp";
      await removeFiles(post.image, optimizedFile);
    }

    const postUpdated = await updateOnePost(post.id, data);
    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      },
    );
    res
      .status(201)
      .json({ message: "Post created successfully", postId: postUpdated.id });
  },
];

export const deletePost = [
  body("postId", "Post ID is required.").trim().notEmpty().escape(),

  async (req: CustomRequest, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }
    let { postId } = req.body;
    // const userId = req.userId;
    // const user = await getUserById(userId!);
    const user = req.user;

    // if (!user) {
    //   return next(
    //     createError("User not found", 404, errorCode.unauthenticated),
    //   );
    // }
    //if post id are not the same
    const post = await getPostById(+postId);
    checkModelExist(post);

    //if author id is not same as login user id
    if (post!.authorId !== user.id) {
      return next(createError("Unauthorized", 403, errorCode.unauthorised));
    }

    //delete post
    const postDeleted = await deleteOnePost(post!.id);
    const optimizedFile = post!.image.split(".")[0] + ".webp";
    console.log("Post image from database:", post!.image);
    console.log("Optimized file name:", optimizedFile);
    console.log(
      "Full original path:",
      path.join(BASE_UPLOAD_DIR, "images", post!.image),
    );
    console.log(
      "Full optimized path:",
      path.join(BASE_UPLOAD_DIR, "optimize", optimizedFile),
    );
    await removeFiles(post!.image, optimizedFile);
    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      },
    );
    res
      .status(200)
      .json({ message: "Post deleted successfully", postId: postDeleted.id });
  },
];
