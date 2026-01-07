import { NextFunction, Request, Response } from "express";
import { body, check, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { get } from "http";
import jwt from "jsonwebtoken";
import {
  createOtp,
  createUser,
  getOtpByPhone,
  getUserById,
  getUserByPhone,
  updateOtp,
  updateUser,
} from "../services/auth";
import {
  checkOtpErrorIfSameDate,
  checkOtpExists,
  checkUserExists,
  checkUserIfNotExists,
  generateOtp,
  generateToken,
} from "../utils/auth";
import moment from "moment";

import { error } from "console";
import { stat } from "fs";
import { errorCode } from "../config/errorCode";

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
      result = await createOtp(otpData);
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
    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 2;

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
        await updateOtp(otpRow!.id, otpData);
      } else {
        //if otp not match,and in same date
        const otpData = {
          error: { increment: 1 },
        };
        await updateOtp(otpRow!.id, otpData);
      }
    }
    //All OK
    const verifyToken = generateToken();
    const otpData = {
      error: 0,
      count: 1,
      verifyToken: verifyToken,
    };
    result = await updateOtp(otpRow!.id, otpData);
    res.status(200).json({
      message: "OTP verified successfully",
      phone: result.phone,
      verifyToken: result.verifyToken,
    });
  },
];

export const confirmPassword = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 to 12 digits"),
  body("password", "Password is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 })
    .withMessage("Password must be 8 digits"),
  body("token", "Token is required").notEmpty().escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    // Password confirmation logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const { phone, password, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserExists(user);
    const otpRow = await getOtpByPhone(phone);
    checkOtpExists(otpRow);
    //otp error count is over limit
    if (otpRow!.error === 5) {
      const error: any = new Error(
        "Too many failed attempts. Please request OTP again."
      );
      error.status = 429;
      error.code = "Error_Too_Many_Attempts";
      return next(error);
    }
    //if token is wrong
    if (otpRow!.verifyToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);
      const error: any = new Error("Invalid token provided");
      error.status = 400;
      error.code = "Error_Invalid_Token";
      return next(error);
    }

    // if requests is expired
    const isExpired = moment().diff(moment(otpRow!.updatedAt), "minutes") > 10;
    if (isExpired) {
      const error: any = new Error(
        "Request has expired. Please verify OTP again."
      );
      error.status = 403;
      error.code = "Error_Request_Expired";
      return next(error);
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password.toString(), salt);
    const randtoken = "I will replace later";

    const userData = {
      password: hashedPassword,
      randToken: randtoken,
      phone: phone,
    };
    const newUser = await createUser(userData);
    const accessTokenPayload = { id: newUser.id };
    const refreshTokenPayload = { id: newUser.id, phone: newUser.phone };
    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "30d" }
    );

    const updateUserData = {
      randToken: refreshToken,
    };
    await updateUser(newUser.id, updateUserData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      })
      .status(201)
      .json({
        message: "Successfully created an account",
        userId: newUser.id,
      });
  },
];

export const login = [
  body("phone", "Phone number is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 to 12 digits"),
  body("password", "Password is not valid")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 })
    .withMessage("Password must be 8 digits"),
  async (req: Request, res: Response, next: NextFunction) => {
    // Login logic here
    const errors = validationResult(req).array({ onlyFirstError: true });
    //if vlidation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const password = req.body.password;
    let phone = req.body.phone;
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }

    const user = await getUserByPhone(phone);
    checkUserIfNotExists(user);
    //if password is incorrect over limit
    if (user?.status === "FREEZE") {
      const error: any = new Error(
        "Account is frozen due to multiple incorrect password attempts"
      );
      error.status = 403;
      error.code = "Error_Account_Frozen";
      return next(error);
    }
    const isMatchPassword = await bcrypt.compare(password, user!.password);
    if (!isMatchPassword) {
      //Start to record wrong times
      const lastRequest = new Date(user!.updatedAt).toLocaleString();
      const isSameDate = lastRequest === new Date().toLocaleString();
      //if not same date(password wrong for just today), reset wrong count to 1]
      if (!isSameDate) {
        const userData = {
          errorLoginCount: 1,
        };
        await updateUser(user!.id, userData);
      } else {
        //if password is wrong same date over 2 times, increment wrong count
        if (user!.errorLoginCount >= 2) {
          const userData = {
            status: "FREEZE",
          };
          await updateUser(user!.id, userData);
        } else {
          const userData = {
            errorLoginCount: { increment: 1 },
          };
          await updateUser(user!.id, userData);
        }
        ///End of recording wrong times
      }
      const error: any = new Error("Incorrect password");
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    //All OK(authorization token)
    const accessTokenPayload = { id: user!.id };
    const refreshTokenPayload = { id: user!.id, phone: user!.phone };
    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "30d" }
    );

    const updateUserData = {
      randToken: refreshToken,
      errorLoginCount: 0, //reset error login count
      status: "ACTIVE",
    };
    await updateUser(user!.id, updateUserData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      })
      .status(200)
      .json({ message: "User logged in successfully", userId: user!.id });
  },
];

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;
  if (!refreshToken) {
    const error: any = new Error("Invalid token provided");
    error.status = 400;
    error.code = "Error_Invalid_Token";
    return next(error);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
      id: number;
      phone: string;
    };
  } catch (err) {
    const error: any = new Error("Invalid  provided");
    error.status = 400;
    error.code = "Error_Invalid_Token";
    return next(error);
  }

  if (isNaN(decoded.id)) {
    const error: any = new Error(" token provided");
    error.status = 400;
    error.code = "Error_Invalid_Token";
    return next(error);
  }

  const user = await getUserById(decoded.id);
  checkUserIfNotExists(user);

  if (user!.phone !== decoded.phone) {
    const error: any = new Error("provided");
    error.status = 400;
    error.code = "Error_Invalid_Token";
    return next(error);
  }

  const userData = {
    randToken: generateToken(),
  };
  await updateUser(user!.id, userData);

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    path: "/",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    path: "/",
  });

  res.status(200).json({ message: "Successfully logged out. See you soon." });
};

export const forgetPassword = [
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
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    } //123456789
    const user = await getUserByPhone(phone);
    checkUserIfNotExists(user);

    const otp = 123456; //for testing purpose
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    const token = generateToken();

    const otpRow = await getOtpByPhone(phone);
    let result;

    const lastOtpRequest = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDate = lastOtpRequest === today;
    checkOtpErrorIfSameDate(isSameDate, otpRow!.error);
    // If OTP request is not in the same date
    if (!isSameDate) {
      const otpData = {
        otp: hashedOtp,
        rememberToken: token,
        count: 1,
        error: 0,
      };
      result = await updateOtp(otpRow!.id, otpData);
    } else {
      // If OTP request is in the same date and over limit
      if (otpRow!.count === 3) {
        const error: any = new Error(
          "OTP is allowed to request 3 times per day"
        );
        error.status = 429;
        error.code = "Error_OTP_Limit_Reached";
        return next(error);
      } else {
        // If OTP request is in the same date but not over limit
        const otpData = {
          otp: hashedOtp,
          rememberToken: token,
          count: otpRow!.count + 1,
        };
        result = await updateOtp(otpRow!.id, otpData);
      }
    }
    res.status(200).json({
      message: `We are sending OTP to 09${result.phone} to reset password.`,
      phone: result.phone,
      token: result.rememberToken,
    });
  },
];

export const verify = [
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

    const { phone, otp, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserIfNotExists(user);
    const otpRow = await getOtpByPhone(phone);

    const lastOtpVerify = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDate = lastOtpVerify === today;
    // If OTP error is in the same date and over limit
    checkOtpErrorIfSameDate(isSameDate, otpRow!.error);

    // Token is wrong
    if (otpRow?.rememberToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);

      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Invalid_Token";
      return next(error);
    }

    // OTP is expired
    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 2;
    if (isExpired) {
      const error: any = new Error(errors[0].msg);
      error.status = 403;
      error.code = "Otp_Expired";
      return next(error);
    }

    const isMatchOtp = await bcrypt.compare(otp, otpRow!.otp);
    // OTP is wrong
    if (!isMatchOtp) {
      // If OTP error is first time today
      if (!isSameDate) {
        const otpData = {
          error: 1,
        };
        await updateOtp(otpRow!.id, otpData);
      } else {
        // If OTP error is not first time today
        const otpData = {
          error: { increment: 1 },
        };
        await updateOtp(otpRow!.id, otpData);
      }

      const error: any = new Error(errors[0].msg);
      error.status = 401;
      error.code = "Otp_Incorrect";
      return next(error);
    }

    // All are OK
    const verifyToken = generateToken();
    const otpData = {
      verifyToken,
      error: 0,
      count: 1,
    };
    const result = await updateOtp(otpRow!.id, otpData);

    res.status(200).json({
      message: "OTP is successfully verified to reset password",
      phone: result.phone,
      token: result.verifyToken,
    });
  },
];

export const resetPassword = [
  // Validate and sanitize fields.
  body("token", "Token must not be empty.").trim().notEmpty().escape(),
  body("phone", "Invalid Phone Number.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 5, max: 12 }),
  body("password", "Password must be 8 digits.")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 }),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    // If validation error occurs
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    const { token, phone, password } = req.body;

    const user = await getUserByPhone(phone);
    checkUserIfNotExists(user);

    const otpRow = await getOtpByPhone(phone);
    if (otpRow!.error === 5) {
      const error: any = new Error(
        "Too many failed attempts. Please request OTP again."
      );
      error.status = 429;
      error.code = "Error_Too_Many_Attempts";
      return next(error);
    }

    if (otpRow!.verifyToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);

      const error: any = new Error("Invalid token provided");
      error.status = 400;
      error.code = "Error_Invalid_Token";
      return next(error);
    }

    // request is expired
    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 5;
    if (isExpired) {
      const error: any = new Error(
        "Request has expired. Please verify OTP again."
      );
      error.status = 403;
      error.code = "Error_Request_Expired";
      return next(error);
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // jwt token
    const accessPayload = { id: user!.id };
    const refreshPayload = { id: user!.id, phone: user!.phone };

    const accessToken = jwt.sign(
      accessPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      {
        expiresIn: 60 * 15, // 15 mins
      }
    );

    const refreshToken = jwt.sign(
      refreshPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: "30d", // "30d" in production
      }
    );

    const userUpdateData = {
      password: hashPassword,
      randToken: refreshToken,
    };
    await updateUser(user!.id, userUpdateData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000, // 15 mins
        path: "/",
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
      })
      .status(200)
      .json({
        message: "Successfully reset your password.",
        userId: user!.id,
      });
  },
];
