import express from "express";
import {
  comfirmPassword,
  login,
  register,
  verifyOtp,
} from "../../controllers/authController";
const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/comfirm-password", comfirmPassword);
router.post("/login", login);

export default router;
