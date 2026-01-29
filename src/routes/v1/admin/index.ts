import express from "express";

import { getAllUsers } from "../../../controllers/admin/userController";
import { auth } from "../../../middlewares/auth";
import upload from "../../../middlewares/uploadeFile";
import {
  createPost,
  deletePost,
  updatePost,
} from "../../../controllers/admin/postController";
const router = express.Router();

router.get("/users", auth, getAllUsers);

router.post("/posts", upload.single("image"), createPost);
router.patch("/posts", upload.single("image"), updatePost);
router.delete("posts", deletePost);

export default router;
