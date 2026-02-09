import express from "express";
import { auth } from "../../../middlewares/auth";
import {
  changeLanguage,
  uploadProfile,
  uploadProfileMultiple,
  uploadProfileOptimize,
} from "../../../controllers/api/profileController";
import upload from "../../../middlewares/uploadeFile";
import {
  getPost,
  getPostsByPagination,
  getInfinitePostsByPagination,
} from "../../../controllers/api/postController";
import { getProduct } from "../../../controllers/api/productController";
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

router.get("/post/:id", auth, getPost);
router.get("/posts", auth, getPostsByPagination); // OffSet Pagination
router.get("/post", auth, getInfinitePostsByPagination); // Cursor-based Pagination

router.get("/products/:id", auth, getProduct);
// router.get("/products", auth, getProductsByPagination);

export default router;
