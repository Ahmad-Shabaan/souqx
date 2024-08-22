// const { resolveContent } = require("nodemailer/lib/shared");
const fileHelper = require("../util/file");
const Product = require("../models/product");
const Category = require("../models/category");
const { validationResult } = require("express-validator");
exports.getAddProduct = (req, res, next) => {
  Category.find()
    .then((categories) => {
      if (!categories) {
        throw new Error("No categories found");
      }
      res.render("admin/edit-product", {
        pageTitle: "Add Product",
        path: "/admin/add-product",
        editing: false,
        errorMessage: null,
        errorsMessage: [],
        hasErrors: false,
        categories: categories,
        selectedCategory: "",
      });
    })
    .catch((err) => next(err));
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  const category = req.body.category;
  let _categories = [];
  const errors = validationResult(req);
  if (!image || !errors.isEmpty()) {
    return Category.find()
      .then((categories) => {
        if (!categories) {
          throw new Error("No categories found");
        }
        _categories = categories;
        return res.status(422).render("admin/edit-product", {
          pageTitle: "Add Product",
          path: "/admin/add-product",
          editing: false,
          errorMessage: !image
            ? "Attached file is not accepted"
            : errors.array()[0].msg,
          errorsMessage: !image ? [] : errors.array(),
          hasErrors: true,
          product: {
            title: title,
            description: description,
            price: price,
          },
          selectedCategory: category,
          categories: categories,
        });
      })
      .catch((err) => next(err));
  }

  // if (!errors.isEmpty()) {
  //   return res.status(422).render("admin/edit-product", {
  //     pageTitle: "Add Product",
  //     path: "/admin/add-product",
  //     editing: false,
  //     errorMessage: errors.array()[0].msg,
  //     errorsMessage: errors.array(),
  //     hasErrors: true,
  //     product: {
  //       title: title,
  //       description: description,
  //       price: price,
  //     },
  //     selectedCategory: category,
  //   });
  // }
  const imageUrl = image.path;
  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    userId: req.user,
    categoryId: category,
  });
  product
    .save()
    .then((result) => {
      // console.log(result);
      console.log("Created Product");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      // or you can render same page with error info
      // res.redirect("500");
      // you can use express error handling
      const error = new Error(err);
      error.httpStatusCode = 500;
      console.log(err);
      return next(error);
    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product | (product.userId.toString() !== req.user._id.toString())) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode === "true",
        product: product,
        errorMessage: null,
        errorsMessage: [],
        hasErrors: false,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      errorMessage: errors.array()[0].msg,
      errorsMessage: errors.array(),
      hasErrors: true,
      product: {
        _id: prodId,
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
      },
    });
  }

  Product.findById(prodId)
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect("/");
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        fileHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;
      }
      return product.save().then((result) => {
        console.log("UPDATED PRODUCT!");
        res.redirect("/admin/products");
      });
    })

    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    // .select('title price -_id')
    // .populate('userId', 'name')
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.prodId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        throw new Error("Product not found!");
      }
      fileHelper.deleteFile(product.imageUrl);
      return Product.deleteOne({ _id: prodId, userId: req.user._id });
    })
    .then(() => {
      console.log("DESTROYED PRODUCT");
      // res.redirect("/admin/products");
      res.status(200).json({
        message: "Success",
      });
    })
    .catch((err) =>
      res.status(500).json({
        message: "Deleting product failed",
      })
    );
};

// categories
exports.getCategories = (req, res, next) => {
  Category.find()
    .then((categories) => {
      if (!categories) {
        throw new Error("Categories not found!");
      }
      res.render("admin/categories", {
        pageTitle: "Categories",
        path: "/admin/categories",
        categories: categories,
      });
    })

    .catch((err) => next(err));
};
exports.getAddCategory = (req, res, next) => {
  res.render("admin/edit-category", {
    pageTitle: "Add Category",
    path: "/admin/add-category",
    editing: false,
    errorMessage: null,
    errorsMessage: [],
    hasErrors: false,
  });
};

exports.postAddCategory = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  if (!image) {
    return res.status(422).render("admin/edit-category", {
      pageTitle: "Add Category",
      path: "/admin/add-category",
      editing: false,
      errorMessage: "Attached file is not accepted",
      errorsMessage: [],
      hasErrors: true,
      category: {
        title: title,
      },
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-category", {
      pageTitle: "Add Category",
      path: "/admin/add-category",
      editing: false,
      errorMessage: errors.array()[0].msg,
      errorsMessage: errors,
      hasErrors: true,
      category: {
        title: title,
      },
    });
  }
  const imageUrl = image.path;
  const category = new Category({
    title: title,
    imageUrl: imageUrl,
  });
  category
    .save()
    .then((result) => {
      // console.log(result);
      console.log("Created Category");
      res.redirect("/admin/categories");
    })
    .catch((err) => {
      // or you can render same page with error info
      // res.redirect("500");
      // you can use express error handling
      console.log(err);
      const error = new Error(err);
      console.log(error);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getEditCategory = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const categoryId = req.params.categoryId;
  Category.findById(categoryId)
    .then((category) => {
      return res.render("admin/edit-category", {
        pageTitle: "Edit Category",
        path: "/admin/edit-category",
        editing: editMode === "true",
        errorMessage: null,
        errorsMessage: [],
        hasErrors: false,
        category: category,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.postEditCategory = (req, res, next) => {
  const updatedTitle = req.body.title;
  const image = req.file;
  const categoryId = req.body.categoryId;
  Category.findById(categoryId)
    .then((category) => {
      category.title = updatedTitle;
      if (image) {
        fileHelper.deleteFile(category.imageUrl);
        category.imageUrl = image.path;
      }
      return category.save().then((result) => {
        console.log("UPDATED CATEGORY!");
        res.redirect("/admin/categories");
      });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.postDeleteCategory = (req, res, next) => {
  const categoryId = req.body.categoryId;
  Category.deleteOne({ _id: categoryId })
    .then((result) => {
      return Product.deleteMany({ categoryId: categoryId });
    })
    .then(() => {
      console.log("DESTROYED CATEGORY");
      res.redirect("/admin/categories");
    })
    .catch((err) => next(err));
};
