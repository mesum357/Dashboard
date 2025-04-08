// REQUIRES
require('dotenv').config();
const express = require('express');
const app = express();
const expressLayouts = require('express-ejs-layouts');

const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const findOrCreate = require('mongoose-findorcreate');
const passportLocalMongoose = require('passport-local-mongoose');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// MONGOOSE
mongoose.connect('mongodb+srv://mesum357:pDliM118811@cluster0.h3knh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true
}).then(() => {
    console.log("Connected to MongoDB Atlas");
}).catch((err) => {
    console.log("Error connecting to MongoDB Atlas:", err);
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    email: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

// Passport configuration
passport.use(User.createStrategy());

// Serialize and deserialize user
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    try {
        const user = await User.findById(id);
        done(null, user); // Success: pass the user object
    } catch (err) {
        done(err, null); // Error: pass the error
    }
});

// Google Strategy (Sets username from Google email)
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/homepage",
    passReqToCallback: true
},
function(req, accessToken, refreshToken, profile, done) {
    User.findOrCreate({ googleId: profile.id }, { username: profile.emails[0].value }, function(err, user) {
        if (err) return done(err);
        done(null, user);
    });
}));

// Set up layout
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');

// Routes
app.get("/", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("index", {
            user: req.user,
            isAuthenticated: true,
            title: "Dashboard",
            path: "/"
        });
    } else {
        res.redirect("/login");
    }
});

// Add middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Protected routes
app.get("/dashboard", ensureAuthenticated, function(req, res) {
    res.render("index", {
        user: req.user,
        isAuthenticated: true,
        title: "Dashboard",
        path: "/dashboard"
    });
});

// Prevent authenticated users from accessing login and register pages
app.get("/login", function(req, res) {
    res.render("login", {
        isAuthenticated: req.isAuthenticated(),
        title: "Login"
    });
});

app.get("/register", function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/");
    } else {
        res.render("register", {
            isAuthenticated: req.isAuthenticated(),
            title: "Register"
        });
    }
});


// POST Routes
app.post("/register", function(req, res) {
    const username = req.body.username;
    const password = req.body.password;
    User.register({ username: username }, password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            req.login(user, function(err) {
                if (err) {
                    console.log(err);
                    res.redirect("/register");
                } else {
                    res.redirect("/login");
                }
            });
        }
    });
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}));

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/homepage',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
        res.redirect('/');
    });

// Logout route
app.get('/logout', function(req, res) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Profile route
app.get("/profile", ensureAuthenticated, function(req, res) {
    res.render("profile", {
        user: req.user,
        title: "Profile",
        path: "/profile"
    });
});

// Settings route
app.get("/settings", ensureAuthenticated, function(req, res) {
    res.render("settings", {
        user: req.user,
        title: "Settings",
        path: "/settings"
    });
});

// Analytics route
app.get("/analytics", ensureAuthenticated, function(req, res) {
    res.render("analytics", {
        user: req.user,
        title: "Analytics",
        path: "/analytics"
    });
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
});