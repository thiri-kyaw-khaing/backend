import { NextFunction, Request, Response } from "express";
import { check, query, validationResult } from "express-validator";
import { getUserById, updateUser } from "../../services/auth";
import { checkUserIfNotExists } from "../../utils/auth";
import { checkUploadFile } from "../../utils/check";
import path from "path";
import { unlink } from "node:fs/promises";
import ImageQueue from "../../jobs/queues/imageQueue";
interface CustomRequest extends Request {
  userId?: number;
  file?: any;
}

export const changeLanguage = [
  query("lang", "Language is not valid")
    .trim()
    .notEmpty()
    .matches("^[a-z]+$")
    .isLength({ min: 2, max: 3 }),
  (req: CustomRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const { lang } = req.query;
    res.cookie("i18next", lang);
    res.status(200).json({ message: req.t("changeLan", { lang }) });
  },
];

export const uploadProfile = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;
  const image = req.file;
  console.log("File ----", req.file);
  const user = await getUserById(userId!);
  checkUserIfNotExists(user);
  checkUploadFile(image);

  // console.log("Image -----", image);
  const fileName = image!.filename;
  // const filePath = image!.path;
  // const filePath = image!.path.replace("\\", "/");

  if (user?.image) {
    try {
      const filePath = path.join(
        __dirname,
        "../../..",
        "/uploads/images",
        user!.image!,
      );
      await unlink(filePath);
    } catch (error) {
      console.log(error);
    }
  }

  const userData = {
    image: fileName,
  };
  await updateUser(user?.id!, userData);

  res.status(200).json({
    message: "Profile picture uploaded successfully.",
    image: fileName,
  });
};

export const uploadProfileMultiple = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  console.log("req.files -------", req.files);

  res.status(200).json({
    message: "Multiple Profile pictures uploaded successfully.",
  });
};

export const uploadProfileOptimize = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;
  const image = req.file;
  const user = await getUserById(userId!);
  checkUserIfNotExists(user);
  checkUploadFile(image);

  const splitFileName = req.file?.filename.split(".")[0];

  const job = await ImageQueue.add(
    "optimize-image",
    {
      filePath: req.file?.path,
      fileName: `${splitFileName}.webp`,
      width: 200,
      height: 200,
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

  // const job = await ImageQueue.add(
  //   "optimize-image",
  //   {
  //     filePath: req.file?.path,
  //     fileName: `${splitFileName}.webp`,
  //     width: 200,
  //     height: 200,
  //     quality: 50,
  //   },
  //   {
  //     attempts: 3,
  //     backoff: {
  //       type: "exponential",
  //       delay: 1000,
  //     },
  //   }
  // );
  if (user?.image) {
    try {
      // Delete original image in database
      const originalFilePath = path.join(
        __dirname,
        "../../..",
        "/uploads/images",
        user!.image!,
      );
      // Delete optimized image in database
      const optimizedFilePath = path.join(
        __dirname,
        "../../..",
        "/uploads/optimize",
        user!.image!.split(".")[0] + ".webp",
      );

      await unlink(originalFilePath);
      await unlink(optimizedFilePath);
    } catch (error) {
      console.log(error);
    }
  }

  const userData = {
    image: req.file?.filename,
  };
  await updateUser(user?.id!, userData);

  res.status(200).json({
    message: "Profile picture uploaded successfully.",
    image: splitFileName + ".webp",
    jobId: job.id,
  });
};
