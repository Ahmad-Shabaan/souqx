const bcrypt = require("bcryptjs");
const User = require("../models/user");
const { validationResult } = require("express-validator");

const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.getLogin = (req, res, next) => {
  let message = req.flash("error");
  let _message;
  if (message.length > 0) {
    _message = message[0];
  } else {
    _message = null;
  }
  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: _message,
    oldInputs: {
      email: "",
      password: "",
    },
    errorsMessage: [],
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash("error");
  let _message;
  if (message.length > 0) {
    _message = message[0];
  } else {
    _message = null;
  }
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errorMessage: _message,
    oldInputs: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    errorsMessage: [],
  });
};

exports.postLogin = (req, res, next) => {
  const { email, password } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errorMessage: errors.array()[0].msg,
      oldInputs: {
        email: email,
        password: password,
      },
      errorsMessage: errors.array(),
    });
  }
  User.findOne({ email: email })
    .then((user) => {
      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            req.session.save((err) => {
              res.redirect("/");
            });
          } else {
            req.flash("error", "The password is not correct");
            return res.status(400).render("auth/login", {
              path: "/login",
              pageTitle: "Login",
              errorMessage: "The password is not correct",
              oldInputs: {
                email: email,
                password: password,
              },
              errorsMessage: [{ path: "password" }],
            });
          }
        })
        .catch((err) => {
          console.log(err);
          return res.redirect("/login");
        });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const { email, password, confirmPassword } = req.body;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      errorMessage: errors.array()[0].msg,
      oldInputs: {
        email: email,
        password: password,
        confirmPassword: confirmPassword,
      },
      errorsMessage: errors.array(),
    });
  }
  return bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });
      return user.save();
    })
    .then((result) => {
      res.redirect("/login");
      const msg = {
        to: email, // Change to your recipient
        from: "ashabaan887@gmail.com", // Change to your verified sender
        subject: "Sending with SendGrid is Fun",
        text: "and easy to do anywhere, even with Node.js",
        html: "<strong>and easy to do anywhere, even with Node.js</strong>",
      };
      sgMail
        .send(msg)
        .then(() => {
          console.log("Email sent");
        })
        .catch((err) => {
          const error = new Error(err);
          error.code = 500;
          return next(error);
        });
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

// reset password
module.exports.getResetPassword = (req, res, next) => {
  let message = req.flash("error");
  let _message;
  if (message.length > 0) {
    _message = message[0];
  } else {
    _message = null;
  }
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: _message,
  });
};

module.exports.postResetPassword = (req, res, next) => {
  const email = req.body.email;
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        req.flash("error", "This E-mail does not exist, check your email");
        return res.redirect("/reset");
      }
      crypto.randomBytes(32, (err, buffer) => {
        if (err) {
          console.log(err);
          return res.redirect("/reset");
        }
        const token = buffer.toString("hex");
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        user.save().then((result) => {
          res.redirect("/");
          const msg = {
            to: email, // Change to your recipient
            from: "ashabaan887@gmail.com", // Change to your verified sender
            subject: "Password Reset",
            html: `
                  <p>You requested a password reset</p>
                  <strong>Click this <a href='localhost:3000/reset/${token}'>link</a> to reset your password</strong>
                `,
          };
          sgMail
            .send(msg)
            .then(() => {
              console.log("Email sent");
            })
            .catch((err) => {
              const error = new Error(err);
              error.code = 500;
              return next(error);
            });
        });
      });
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/reset");
    });
};

module.exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      let message = req.flash("error");
      let _message;
      if (message.length > 0) {
        _message = message[0];
      } else {
        _message = null;
      }
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        errorMessage: _message,
        userId: user._id.toString(),
        resetToken: token,
      });
    })
    .catch((err) => res.redirect("/404"));
};
module.exports.postNewPassword = (req, res, next) => {
  const { userId, resetToken, password } = req.body;
  User.findOne({
    resetToken: resetToken,
    _id: userId,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        return res.redirect(`/reset/${resetToken}`);
      }
      bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
          user.password = hashedPassword;
          user.resetToken = undefined;
          user.resetTokenExpiration = undefined;
          return user.save();
        })
        .then((result) => {
          res.redirect("/login");
        })
        // .catch((err) => {
        //   const error = new Error(err);
        //   error.code = 500;
        //   return next(error);
        // });
    })
    .catch((err) => {
      const error = new Error(err);
      error.code = 500;
      return next(error);
    });
};
