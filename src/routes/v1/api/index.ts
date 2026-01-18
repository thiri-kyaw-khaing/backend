import express from "express";
import { auth } from "../../../middlewares/auth";
import {
  changeLanguage,
  uploadProfile,
} from "../../../controllers/api/profileController";
import upload from "../../../middlewares/uploadeFile";
const router = express.Router();

router.get("/change-language", changeLanguage);

router.patch("/profile/upload", auth, upload.single("image"), uploadProfile);

export default router;
