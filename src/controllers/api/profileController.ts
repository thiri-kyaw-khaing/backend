import { NextFunction, Request, Response } from "express";
import { check, query, validationResult } from "express-validator";
import { getUserById, updateUser } from "../../services/auth";
import { checkUserIfNotExists } from "../../utils/auth";
import { checkUploadFile } from "../../utils/check";
import path from "path";
import { unlink } from "node:fs/promises";
interface CustomRequest extends Request {
  userId?: number;
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
