import express from "express";

import { getAllUsers } from "../../../controllers/admin/userController";
import { auth } from "../../../middlewares/auth";
import upload from "../../../middlewares/uploadeFile";
import {
  createPost,
  deletePost,
  updatePost,
} from "../../../controllers/admin/postController";
import {
  createProduct,
  deleteProduct,
} from "../../../controllers/admin/productController";
const router = express.Router();

router.get("/users", auth, getAllUsers);

router.post("/posts", upload.single("image"), createPost);
router.patch("/posts", upload.single("image"), updatePost);
router.delete("/posts", deletePost);

router.post("/products", upload.array("images"), createProduct);
// router.patch("/products", upload.array("images"), updateProduct);
router.delete("/products/", deleteProduct);

export default router;
