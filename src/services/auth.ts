import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export const getUserByPhone = async (phone: string) => {
  return await prisma.user.findUnique({
    where: { phone },
  });
};

export const createOtp = async (otpData: any) => {
  return await prisma.otp.create({
    data: otpData,
  });
};

export const getOtpByPhone = async (phone: string) => {
  return await prisma.otp.findUnique({
    where: { phone },
  });
};

export const updateOtp = async (id: number, otpData: any) => {
  return await prisma.otp.update({
    where: { id },
    data: otpData,
  });
};
