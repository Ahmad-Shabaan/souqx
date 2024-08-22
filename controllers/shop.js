const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const NUM_ITEMS_PAGE = 1;
exports.getProducts = (req, res, next) => {
  const page = req.query.page || 1;
  let totalNumOfProducts;
  Product.countDocuments()
    .then((numProducts) => {
      totalNumOfProducts = numProducts;
      return Product.find()
        .skip((page - 1) * NUM_ITEMS_PAGE)
        .limit(NUM_ITEMS_PAGE);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
        currentPage: page,
        nextPage: +page + 1,
        prevPage: +page - 1,
        hasNextPage: NUM_ITEMS_PAGE * page < totalNumOfProducts,
        hasPrevPage: page > 1,
        lastPage: Math.ceil(totalNumOfProducts / NUM_ITEMS_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = req.query.page || 1;
  let totalNumOfProducts;
  Product.countDocuments()
    .then((numProducts) => {
      totalNumOfProducts = numProducts;
      return Product.find()
        .skip((page - 1) * NUM_ITEMS_PAGE)
        .limit(NUM_ITEMS_PAGE);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        nextPage: +page + 1,
        prevPage: +page - 1,
        hasNextPage: NUM_ITEMS_PAGE * page < totalNumOfProducts,
        hasPrevPage: page > 1,
        lastPage: Math.ceil(totalNumOfProducts / NUM_ITEMS_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      console.log("lk", products);
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      console.log(err);
      error.code = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;

  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const _products = user.cart.items;
      products = _products;
      _products.forEach((p) => {
        total += p.quantity * p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: products.map((p) => ({
          price_data: {
            currency: "usd",
            product_data: {
              name: p.productId.title,
              description: p.productId.description,
            },
            unit_amount: p.productId.price * 100,
          },
          quantity: p.quantity,
        })),
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/checkout/success`,
        cancel_url: `${req.protocol}://${req.get("host")}/checkout/cancel`,
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
        sessionId: session.id,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  const invoiceName = "invoice-" + orderId + ".pdf";
  const invoicePath = path.join("data", "invoices", invoiceName);
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        const error = new Error("No order found!");
        error.httpStatusCode = 404;
        throw error;
      }
      if (order.user.userId.toString() === req.session.user._id.toString()) {
        // this way not good for big files as it requires read file in memory and send it in response
        // fs.readFile(invoicePath, (err, data) => {
        //   if (err) {
        //     return next(err);
        //   }
        //   res.setHeader("Content-Type", "application/pdf");
        //   res.setHeader(
        //     "Content-Disposition",
        //     'inline ; filename="' + invoiceName + '"' // inline open file in browser | attachment download file in pc
        //   );
        //   res.send(data);
        // });

        // you must read file as stream and sent it as a stream in res which is writable stream obj
        // const file = fs.createReadStream(invoicePath);
        // res.setHeader("Content-Type", "application/pdf");
        // res.setHeader(
        //   "Content-Disposition",
        //   'inline ; filename="' + invoiceName + '"' // inline open file in browser | attachment download file in pc
        // );
        // file.pipe(res);

        // i need create pdf in server by using pdfkit
        const doc = new PDFDocument();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'inline ; filename="' + invoiceName + '"' // inline open file in browser | attachment download file in pc
        );
        doc.pipe(fs.createWriteStream(invoicePath)); // write to PDF this output       config
        doc.pipe(res); // this output

        doc.fontSize(24).text("Your Invoice");
        doc.text("---------------------------------");
        let totalPrice = 0;
        order.products.map((product, index) => {
          // 2 product  // 0 , 1
          totalPrice += product.product.price * product.quantity;
          doc.fontSize(14).text(`-Product: ${product.product.title}.`);
          doc.fontSize(14).text(`-Quantity: ${product.quantity}.`);
          doc.fontSize(14).text(`-Price: ${product.product.price}`);
          index >= order.products.length - 1
            ? null
            : doc.text("**********************");
        });

        doc.text("____________________");
        doc.fontSize(20).text("TotalPrice: " + totalPrice);
        doc.end();
      } else {
        const error = new Error("Forbidden");
        error.httpStatusCode = 403;
        throw error;
      }
    })
    .catch((error) => next(error));
};
