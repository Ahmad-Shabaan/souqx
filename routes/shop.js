const path = require("path");
const isAuth = require("../middleware/is-auth");
const express = require("express");

const shopController = require("../controllers/shop");

const router = express.Router();

router.get("/", shopController.getIndex);

router.get("/products", shopController.getProducts);

router.get("/products/:productId", shopController.getProduct);

router.get("/cart", isAuth, shopController.getCart);

router.post("/cart", isAuth, shopController.postCart);

router.get("/checkout", isAuth, shopController.getCheckout);

router.get("/checkout/success", isAuth, shopController.getCheckoutSuccess);      ///// you should edit this after deploying as stripe need your web page on internet to sent to it a url behind the sene

router.get("/checkout/cancel", isAuth, shopController.getCheckout);


router.post("/cart-delete-item", isAuth, shopController.postCartDeleteProduct);

// router.post("/create-order", isAuth, shopController.postOrder);

router.get("/orders", isAuth, shopController.getOrders);

router.get('/invoice/:orderId',isAuth , shopController.getInvoice)

module.exports = router;
