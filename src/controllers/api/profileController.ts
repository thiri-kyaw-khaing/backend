import { NextFunction, Request, Response } from "express";
import { query, validationResult } from "express-validator";

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
