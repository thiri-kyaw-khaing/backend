import express from "express";
import {
  confirmPassword,
  login,
  register,
  verifyOtp,
} from "../../controllers/authController";
const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/confirm-password", confirmPassword);
router.post("/login", login);

export default router;
