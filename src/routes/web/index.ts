import express from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import userRouter from "../v1/admin";
import profileRouter from "../v1/api";
import { authorise } from "../../middlewares/authorise";
import { auth } from "../../middlewares/auth";
import app from "../../app";

const router = express.Router();

// router.use("/api/v1", healthRouter);
router.use("/api/v1", authRouter);
router.use("/api/v1/admin", auth, authorise(true, "ADMIN"), userRouter);
router.use("/api/v1/profile", profileRouter);

export default router;
