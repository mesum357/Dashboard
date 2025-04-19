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
const multer = require('multer');
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

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
    profileImage: String,
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
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
        ? `${process.env.VERCEL_URL}/auth/google/homepage`
        : "http://localhost:3000/auth/google/homepage",
    passReqToCallback: true
},
async function(req, accessToken, refreshToken, profile, done) {
    try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                username: profile.emails[0].value,
                email: profile.emails[0].value
            });
        }
        
        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
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
];

const UploadSchema = mongoose.Schema({
    srNo: {
        type: Number,
        default: 0
    },
    orderNo: String,
    time: String,
    vehicleNumber: String,
    passengers: String,
    females: Number,
    males: Number,
    goods: String,
    profileImage: String, // Path to the profile image
    drivingLicenseImage: String // Path to the driving license image
});

// Add pre-save middleware to auto-increment srNo
UploadSchema.pre('save', async function(next) {
    if (this.isNew) {
        const count = await this.constructor.countDocuments();
        this.srNo = count + 1;
    }
    next();
});

const Upload = mongoose.model("upload", UploadSchema);

// Add middleware to check authentication
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Protected routes
// Profile image upload endpoint
app.post('/upload-profile-image', ensureAuthenticated, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Find the admin record and update profile image
        const admin = await Admin.findOne({});
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin profile not found' });
        }

        // Update admin's profile image in database
        admin.profileImage = req.file.path;
        await admin.save();

        res.json({
            success: true,
            imageUrl: '/' + req.file.path
        });
    } catch (error) {
        console.error('Error uploading profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading image'
        });
    }
});
app.get("/", ensureAuthenticated, async function(req, res) {
    try {
        const uploads = await Upload.find();
        const maleCount = uploads.reduce((total, upload) => total + (upload.males || 0), 0);
        const femaleCount = uploads.reduce((total, upload) => total + (upload.females || 0), 0);

        // Fetch user registration data
        const userRegistrations = maleCount + femaleCount
        console.log(userRegistrations)

        console.log('Male Count:', maleCount);
        console.log('Female Count:', femaleCount);
        console.log('User Registrations:', userRegistrations);

        res.render('index', {
            user: req.user,
            isAuthenticated: true,
            title: 'Dashboard',
            path: '/',
            tourists,
            maleCount,
            femaleCount,
            userRegistrations
        });
    } catch (err) {
        console.error('Error fetching tourist data:', err);
        res.status(500).send('Error fetching tourist data');
    }
});

// Prevent authenticated users from accessing login and register pages
app.get("/login", function(req, res) {
    res.render("login", {
        isAuthenticated: req.isAuthenticated(),
        title: "Login",
        path: "/login"
    });
});

app.get("/register", function(req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/");
    } else {
        res.render("register", {
            isAuthenticated: req.isAuthenticated(),
            title: "Register",
            path: "/register"
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
    Upload.find({})
        .sort({ _id: -1 }) // Sort by most recent first
        .limit(10) // Limit to 10 records
        .then((data) => {
            res.render("tourist_data", {
                isAuthenticated: req.isAuthenticated(),
                user: req.user,
                title: "Tourist Data",
                path: req.path,
                data
            });
        })
        .catch((err) => {
            console.error("Error fetching tourist data:", err);
            res.status(500).send("Error fetching tourist data");
        });
});

app.post('/upload', upload.fields([{ name: 'profileImage' }, { name: 'drivingLicenseImage' }]), function(req, res) {
    const profileImage = req.files['profileImage'] ? req.files['profileImage'][0].path : null;
    const drivingLicenseImage = req.files['drivingLicenseImage'] ? req.files['drivingLicenseImage'][0].path : null;

    const upload = new Upload({
        srNo: 0,
        orderNo: req.body.orderDate,
        time: req.body.orderTime,
        vehicleNumber: req.body.vehicleNumber,
        passengers: req.body.passengers,
        females: Number(req.body.females),
        males: Number(req.body.males),
        goods: req.body.goods,
        profileImage: profileImage,
        drivingLicenseImage: drivingLicenseImage
    });

    upload.save()
        .then(() => {
            res.redirect("/tourist-data");
        })
        .catch((err) => {
            console.error("Error saving upload data:", err);
            res.status(500).send("Error saving upload data");
        });
});

app.get("/latest-data",function(req,res){
Upload.find({})
.sort({ _id: -1 }) // Sort by most recent first
.limit(100) // Limit to 10 records
.then((data) => {
    if(req.isAuthenticated()){
        res.render("latest-data",{
            isAuthenticated: req.isAuthenticated(),
            user: req.user,
            title: "Latest Data",
            path: "/latest-data",
            data
        })
        console.log(data)
    }
    else{
        res.redirect("/login")
    }
    
})







app.get("/previous-data",function(req,res){
Upload.find({})
.sort({ _id: 1 }) // Sort by most recent first
.limit(100) // Limit to 10 records
.then((data) => {
    if(req.isAuthenticated()){
        res.render("previous-data",{
            isAuthenticated: req.isAuthenticated(),
            user: req.user,
            title: "Previous Data",
            path: "/previous-data",
            data    
        })
    }
})
})


const AdminSchema = mongoose.Schema({
fullname: String,
permanentAddress: String,
position: String,
phoneNumber: String,
email: String,
cnic: String


});

const Admin = mongoose.model("admin", AdminSchema);


app.get("/profile", function(req, res) {
    if (req.isAuthenticated()) {
        Admin.findOne({})
            .then((data) => {
                res.render("profile", {
                    isAuthenticated: req.isAuthenticated(),
                    user: req.user,
                    title: "Profile",
                    path: "/profile",
                    data
                });
                console.log(data);
            });
    } else {
        res.redirect("/login");
    }
});

app.post("/admin-form", function(req, res) {
    Admin.findOne({})
        .then((existingAdmin) => {
            if (!existingAdmin) {
                // Create new admin if none exists
                const admin = new Admin({
                    fullname: req.body.fullname,
                    permanentAddress: req.body.permanentAddress,
                    position: req.body.position,
                    phoneNumber: req.body.mobile,
                    email: req.body.email,
                    cnic: req.body.cnic
                });
                return admin.save();
            } else {
                // Update existing admin data
                existingAdmin.fullname = req.body.fullname;
                existingAdmin.permanentAddress = req.body.permanentAddress;
                existingAdmin.position = req.body.position;
                existingAdmin.phoneNumber = req.body.mobile;
                existingAdmin.email = req.body.email;
                existingAdmin.cnic = req.body.cnic;
                return existingAdmin.save();
            }
        })
        .then(() => {
            res.redirect("/profile");
        })
        .catch((err) => {
            console.error("Error saving/updating admin data:", err);
            res.status(500).send("Error saving/updating admin data");
        });
});

// Profile image upload route
app.post('/upload-profile-image', ensureAuthenticated, upload.single('profileImage'), async function(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update user's profile image path
        user.profileImage = req.file.path;
        await user.save();

        res.json({
            success: true,
            imageUrl: '/' + req.file.path
        });
    } catch (err) {
        console.error('Error uploading profile image:', err);
        res.status(500).json({ success: false, message: 'Error uploading image' });
    }
})



app.post("/subadmin-form", function(req, res) {
    const username = req.body.email;
    const password = req.body.password;
    User.register({ username: username }, password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("error");
        } else {
            req.login(user, function(err) {
                if (err) {
                    console.log(err);
                    res.redirect("error");
                } else {
                    // Ensure profile image is retained
                    user.profileImage = req.user.profileImage;
                    user.save().then(() => {
                        res.redirect("/");
                    }).catch((saveErr) => {
                        console.error("Error saving user profile image:", saveErr);
                        res.redirect("error");
                    });
                }
            });
        }
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



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
});