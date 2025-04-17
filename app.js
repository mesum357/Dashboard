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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// MONGOOSE
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

if (process.env.NODE_ENV === 'production') {
    mongooseOptions.ssl = true;
    mongooseOptions.tls = true;
    mongooseOptions.tlsAllowInvalidCertificates = true;
    mongooseOptions.tlsAllowInvalidHostnames = true;
}

// Get MongoDB URI from environment or use default
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
    console.error("MONGODB_URI is not defined in environment variables");
    process.exit(1);
}

mongoose.connect(mongoURI, mongooseOptions)
    .then(() => {
        console.log("Connected to MongoDB Atlas");
    })
    .catch((err) => {
        console.error("Error connecting to MongoDB Atlas:", err);
        process.exit(1);
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
    callbackURL: process.env.NODE_ENV === 'production' 
        ? `${process.env.VERCEL_URL}/auth/google/homepage`
        : "http://localhost:3000/auth/google/homepage",
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
const tourists = [
    { name: "Samantha W.", country: "PKR", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
    { name: "John D.", country: "USA", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
    { name: "Samantha W.", country: "PKR", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
    { name: "John D.", country: "USA", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
    // Add more tourist data as needed
];
app.get("/", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("index", {
            user: req.user,
            isAuthenticated: true,
            title: "Dashboard",
            path: "/",
            tourists
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
app.get("/home", ensureAuthenticated, function(req, res) {
    res.render("profile", {
        user: req.user,
        title: "Home",
        path: "/home"
    });
});

// Settings route
app.get("/settings", ensureAuthenticated, function(req, res) {
    const isAuthenticated = req.isAuthenticated();
    res.render("settings", {
        isAuthenticated,
        user: req.user,
        title: "Settings",
        path: req.path
    });
});

// Analytics route
app.get("/tourist-data", ensureAuthenticated, function(req, res) {
    res.render("tourist_data", {
        isAuthenticated: req.isAuthenticated(),
        user: req.user,
        title: "Tourist Data",
        path: req.path
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.listen(process.env.PORT || 3000, function() {
    console.log("Server started on port " + (process.env.PORT || 3000));
});