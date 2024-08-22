const path = require("path");
const isAuth = require("../middleware/is-auth");
const express = require("express");
const { body } = require("express-validator");
const adminController = require("../controllers/admin");

const router = express.Router();

// /admin/add-product => GET
router.get("/add-product", isAuth, adminController.getAddProduct);

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

// /admin/add-product => POST
router.post(
  "/add-product",
  isAuth,
  [
    body("title")
      .isLength({ min: 3 })
      .withMessage("The tile must be at least 3 characters"),
    body("price").isFloat().withMessage("The price must be number"),
    // body("imageUrl").isURL().withMessage("The image url must be in format"),
    body("description")
      .isLength({ min: 5, max: 500 })
      .withMessage("The description must be at least 5 characters"),
    body('category').isLength({min:1}).withMessage('Category is required')
  ],
  adminController.postAddProduct
);

router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

router.post(
  "/edit-product",
  isAuth,
  [
    body("title")
      .isLength({ min: 3 })
      .withMessage("The tile must be at least 3 characters"),
    body("price").isFloat().withMessage("The price must be number"),
    // body("imageUrl").isURL().withMessage("The image url must be in format"),
    body("description")
      .isLength({ min: 5, max: 500 })
      .withMessage("The description must be at least 5 characters"),
  ],
  adminController.postEditProduct
);

router.delete("/delete-product/:prodId", isAuth, adminController.deleteProduct);

// categories
router.get("/categories", isAuth, adminController.getCategories);
router.get("/add-category", isAuth, adminController.getAddCategory);
router.post(
  "/add-category",
  isAuth,
  [

    body("title")
      .isLength({ min: 3 })
      .withMessage("The tile must be at least 3 characters"),
  ],
  adminController.postAddCategory
);
router.get("/edit-category/:categoryId", isAuth, adminController.getEditCategory);
router.post("/edit-category", isAuth, adminController.postEditCategory);
router.post("/delete-category", isAuth, adminController.postDeleteCategory);

module.exports = router;
