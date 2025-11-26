import { randomBytes } from "crypto";

export const checkUserExists = async (user: any) => {
  if (user) {
    const error: any = new Error("User already exists");
    error.status = 409;
    error.code = "Error_User_Exists";
    throw error;
  }
};

export const checkOtpExists = async (otpRow: any) => {
  if (!otpRow) {
    const error: any = new Error("OTP not found for the provided phone number");
    error.status = 404;
    error.code = "Error_OTP_Not_Found";
    throw error;
  }
};

export const generateOtp = () => {
  return (parseInt(randomBytes(3).toString("hex"), 16) % 900000) + 100000;
};

export const generateToken = () => {
  return randomBytes(32).toString("hex");
};

export const checkOtpErrorIfSameDate = (isSameDate: boolean, error: number) => {
  if (isSameDate && error >= 5) {
    const error: any = new Error("OTP request limit reached for today");
    error.status = 429;
    error.code = "Error_OTP_Limit_Reached";
    throw error;
  }
};
