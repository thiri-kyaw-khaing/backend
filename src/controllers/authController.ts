import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";

export const register = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 10, max: 15 })
    .withMessage("Phone number must be between 10 to 15 digits"),
  (req: Request, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log({ errors: errors.array() });
      //   return res.status(400).json({ errors: errors.array() });
    }
    res.status(200).json({ message: "User registered successfully" });
  },
];

export const verifyOtp = (req: Request, res: Response, next: NextFunction) => {
  // OTP verification logic here
  res.status(200).json({ message: "OTP verified successfully" });
};

export const comfirmPassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Password confirmation logic here
  res.status(200).json({ message: "Password confirmed successfully" });
};

export const login = (req: Request, res: Response, next: NextFunction) => {
  // Login logic here
  res.status(200).json({ message: "User logged in successfully" });
};
