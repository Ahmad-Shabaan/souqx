const path = require("path");
const csrf = require("csurf");
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("connect-flash");
const MongoDBStore = require("connect-mongodb-session")(session);
const multer = require("multer");
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");
const errorController = require("./controllers/error");
const User = require("./models/user");
const helmet = require("helmet");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/svg" ||
    file.mimetype === "image/gif"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.cfnbgsh.mongodb.net/${process.env.MONGODB_DATABASE}`;
const app = express();

app.use(helmet()); // add some headers in res for more security

const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});


const csrfToken = csrf();
app.set("view engine", "ejs");
app.set("views", "views");

app.use(bodyParser.urlencoded({ extended: false }));
// you will need another package like multer it will parse mix data url encoded data and binary data it will looking for incoming req with type of data mutlipart/form-data this field in form
// multer will store data after parse it in property in req (file) it recive a stream of data and store it in buffer (bus stop) and will turn it into main format
app.use(multer({ storage: storage, fileFilter: fileFilter }).single("image"));

app.use(express.static(path.join(__dirname, "public"))); // we serve the public folder with the static express middleware
app.use("/images", express.static(path.join(__dirname, "images"))); // we serve the images folder with the static express middleware
// this mean that requests to files in that folder will be handled automatically and the files will be returned
// the reason from add /images =>  the reason for that is that express assumes that the files in the images folder are served as if they were in the root folder, so slash nothing.
// Of course we want to keep them in the images folder

app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfToken);
app.use(flash());
app.use((req, res, next) => {
  (res.locals.isAuthenticated = req.session.isLoggedIn), // add variable to all views
    (res.locals.csrfToken = req.csrfToken());
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => next(new Error(err)));
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use("/500", errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
  console.log(error);
  // res.status(error.httpStatusCode).render("/500");
  // res.redirect("/500"); // this will make infinite loop
  const httpStatusCode = error.httpStatusCode || 500;
  res.status(httpStatusCode).render("500", {
    pageTitle: "Error",
    path: "/500",
  });
});
// you can add more error handling middleware and will execute from top to button
mongoose

  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    app.listen(process.env.PORT);
  })
  .catch((err) => {
    console.log(err);
  });
