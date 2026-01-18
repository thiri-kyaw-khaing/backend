import express from "express";
import { auth } from "../../../middlewares/auth";
import {
  changeLanguage,
  uploadProfile,
  uploadProfileMultiple,
  uploadProfileOptimize,
} from "../../../controllers/api/profileController";
import upload from "../../../middlewares/uploadeFile";
const router = express.Router();

router.get("/change-language", changeLanguage);

router.patch("/upload", auth, upload.single("image"), uploadProfile);
router.patch(
  "/upload/multiple",
  auth,
  upload.array("images"),
  uploadProfileMultiple,
);

router.patch(
  "/upload/optimize",
  auth,
  upload.single("avatar"),
  uploadProfileOptimize,
);

export default router;
