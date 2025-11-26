import { NextFunction, Request, Response } from "express";
import { body, check, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { get } from "http";
import {
  createOtp,
  getOtpByPhone,
  getUserByPhone,
  updateOtp,
} from "../services/auth";
import {
  checkOtpErrorIfSameDate,
  checkOtpExists,
  checkUserExists,
  generateOtp,
  generateToken,
} from "../utils/auth";
import moment from "moment";
import { verify } from "crypto";
import { error } from "console";

export const register = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 to 12 digits"),
  async (req: Request, res: Response, next: NextFunction) => {
    // Registration logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    let phone = req.body.phone; //09123456789
    console.log("Original phone:", phone);

    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    } //123456789
    const user = await getUserByPhone(phone);
    console.log("user", user);
    await checkUserExists(user);
    //OTP sending logic here
    //Generate OTP and call external service to send OTP
    //if otp sending fails, throw error
    //save OTP to database with expiration time
    // const otp = generateOtp();
    const otp = 123456; //for testing purpose
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    const token = generateToken();

    const otpRow = await getOtpByPhone(phone);
    let result: any;
    //never request otp before
    if (!otpRow) {
      const otpData = {
        phone: phone,
        otp: hashedOtp,
        rememberToken: token,
      };
      const result = await createOtp(otpData);
    } else {
      //if requested before, check the date
      const lastOtpRequest = new Date(otpRow.updatedAt).toLocaleString();
      const today = new Date().toLocaleString();
      const isSameDate = lastOtpRequest === today;
      checkOtpErrorIfSameDate(isSameDate, otpRow.error);
      //if date is different, update otp row
      if (!isSameDate) {
        const otpData = {
          otp: hashedOtp,
          rememberToken: token,
          count: 1,
          error: 0,
        };
        try {
          result = await updateOtp(otpRow.id, otpData);
        } catch (error) {
          console.log("Error updating OTP:", error);
        }
        // result = await updateOtp(phone, otpData);
      } else {
        //if date is same,but over limit for request otp
        if (otpRow.count === 3) {
          const error: any = new Error("OTP request limit reached for today");
          error.status = 429;
          error.code = "Error_OTP_Limit_Reached";
          return next(error);
        } else {
          //if date is same,but under limit for request otp
          const otpData = {
            otp: hashedOtp,
            rememberToken: token,
            count: otpRow.count + 1,
          };
          // result = await updateOtp(otpRow.id, otpData);
          try {
            result = await updateOtp(otpRow.id, otpData);
          } catch (error) {
            console.log("Error updating OTP:", error);
          }
        }
      }
    }
    res.status(200).json({
      message: "OTP sent successfully",
      phone: result.phone,
      token: result.rememberToken,
    });
  },
];

export const verifyOtp = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 to 12 digits"),
  body("otp", "OTP is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
  body("token", "Token is required").notEmpty().escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    // OTP verification logic here
    const { phone, otp, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserExists(user);
    const otpRow = await getOtpByPhone(phone);
    checkOtpExists(otpRow);

    const lastOtpVerify = new Date(otpRow!.updatedAt).toLocaleString();
    const today = new Date().toLocaleString();
    const isSameDate = lastOtpVerify === today;
    //if otp verify is in same date and over limit, throw error
    checkOtpErrorIfSameDate(isSameDate, otpRow!.error);
    let result;
    if (otpRow!.rememberToken !== token) {
      const otpData = {
        error: 5,
      };
      result = await updateOtp(otpRow!.id, otpData);
      const error: any = new Error("Invalid token provided");
      error.status = 400;
      error.code = "Error_Invalid_Token";
      return next(error);
    }
    const isExpired = moment().diff(moment(otpRow!.updatedAt), "minutes") > 2;
    if (isExpired) {
      const error: any = new Error("OTP has expired");
      error.status = 400;
      error.code = "Error_OTP_Expired";
      return next(error);
    }
    const isMatchOtp = await bcrypt.compare(otp, otpRow!.otp);
    if (!isMatchOtp) {
      //if otp not match,but first time for today
      if (!isSameDate) {
        const otpData = {
          error: 1,
        };
        result = await updateOtp(otpRow!.id, otpData);
      } else {
        //if otp not match,and in same date
        const otpData = {
          error: { increment: 1 },
        };
        result = await updateOtp(otpRow!.id, otpData);
      }
    }
    //All OK
    const verifyToken = generateToken();
    const otpData = {
      error: 0,
      count: 1,
      token: verifyToken,
    };
    result = await updateOtp(otpRow!.id, otpData);
    res.status(200).json({
      message: "OTP verified successfully",
      phone: result.phone,
      token: result.verifyToken,
    });
  },
];

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
