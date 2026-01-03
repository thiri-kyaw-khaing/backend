import express from "express";
import { auth } from "../../../middlewares/auth";
import { changeLanguage } from "../../../controllers/api/profileController";
const router = express.Router();

router.get("/change-language", changeLanguage);

export default router;
