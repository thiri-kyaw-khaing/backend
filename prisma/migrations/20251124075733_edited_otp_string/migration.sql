-- DropIndex
DROP INDEX "public"."Otp_otp_key";

-- AlterTable
ALTER TABLE "Otp" ALTER COLUMN "otp" SET DATA TYPE TEXT;
