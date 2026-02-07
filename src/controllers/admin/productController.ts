import { body, check, validationResult } from "express-validator";

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
interface CustomRequest extends Request {
  userId?: number;
  user?: any;
}

const removeFiles = async (
  originalFile: string,
  optimizedFile: string | null,
) => {
  try {
    const originalFilePath = path.join(
      __dirname,
      "../../..",
      "/uploads/images",
      originalFile,
    );
    await unlink(originalFilePath);
    if (optimizedFile) {
      const optimizedFilePath = path.join(
        __dirname,
        "../../..",
        "/uploads/images",
        optimizedFile,
      );
      await unlink(optimizedFilePath);
    }
  } catch (error) {
    console.log(error);
  }
};

export const createProduct = [
  body("title", "Title is required.").trim().notEmpty().escape(),
  body("content", "Content is required.").trim().notEmpty().escape(),

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
    let { title, content, body, category, type, tags } = req.body;
    // const userId = req.userId;
    const image = req.file;
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
    checkUploadFile(image);

    const splitFileName = req.file?.filename.split(".")[0];

    await ImageQueue.add(
      "optimize-image",
      {
        filePath: req.file?.path,
        fileName: `${splitFileName}.webp`,
        width: 835,
        height: 577,
        quality: 50,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    );
    const data = {
      title,
      content,
      body,
      image: req.file!.filename,
      authorId: user.id,
      category,
      type,
      tags,
    };

    const post = await createOneProduct(data);
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
      .json({ message: "Post created successfully", postId: post.id });
  },
];
