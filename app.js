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

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    try {
        let user = await SubAdmin.findById(id);
        if (!user) {
            user = await User.findById(id);
        }
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

const UploadSchema = new mongoose.Schema({
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
    cnic: String,
    goods: String,
    profileImage: String,
    drivingLicenseImage: String,
    vehiclePassengers: {
        type: String,
        enum: ['yes', 'no'],
        default: 'no'
    },
    vehicleGoods: {
        type: String,
        enum: ['yes', 'no'],
        default: 'no'
    }
});

UploadSchema.pre('save', async function(next) {
    if (this.isNew) {
        const count = await this.constructor.countDocuments();
        this.srNo = count + 1;
    }
    next();
});

const Upload = mongoose.model("upload", UploadSchema);

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

app.post('/upload-profile-image', ensureAuthenticated, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const admin = await Admin.findOne({});
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin profile not found' });
        }

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
        const userRegistrations = maleCount + femaleCount;

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

app.get("/login", function(req, res) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    res.render("login", {
        isAuthenticated: false,
        title: "Login",
        path: "/login"
    });
});

app.get("/register", function(req, res) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    res.render("register", {
        isAuthenticated: false,
        title: "Register",
        path: "/register"
    });
});

app.post("/register", function(req, res) {
    User.register({ username: req.body.username }, req.body.password, function(err, user) {
        if (err) {
            console.error(err);
            return res.redirect("/register");
        }
        req.login(user, function(err) {
            if (err) {
                console.error(err);
                return res.redirect("/register");
            }
            res.redirect("/login");
        });
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

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.get("/settings", ensureAuthenticated, function(req, res) {
    res.render("settings", {
        isAuthenticated: true,
        user: req.user,
        title: "Settings",
        path: req.path
    });
});

app.get("/tourist-data", ensureAuthenticated, function(req, res) {
    Upload.find({})
        .sort({ _id: -1 })
        .limit(10)
        .then((data) => {
            res.render("tourist_data", {
                isAuthenticated: true,
                user: req.user,
                title: "Tourist Data",
                path: req.path,
                data,
                value : 1
            });

        })
        .catch((err) => {
            console.error("Error fetching tourist data:", err);
            res.status(500).send("Error fetching tourist data");
        });
});

app.post('/upload', upload.fields([
    { name: 'profileImage' },
    { name: 'drivingLicenseImage' }
]), async function(req, res) {
    try {
        const profileImage = req.files['profileImage'] ? req.files['profileImage'][0].path : null;
        const drivingLicenseImage = req.files['drivingLicenseImage'] ? req.files['drivingLicenseImage'][0].path : null;

        const upload = new Upload({
            orderNo: req.body.orderDate,
            time: req.body.orderTime,
            vehicleNumber: req.body.vehicleNumber,
            passengers: req.body.passengers,
            females: Number(req.body.females),
            males: Number(req.body.males),
            goods: req.body.goods,
            cnic: req.body.cnic,
            profileImage,
            drivingLicenseImage,
            vehiclePassengers: req.body.vehiclePassengers || 'no',
            vehicleGoods: req.body.vehicleGoods || 'no'
        });

        await upload.save();
        console.log(upload);
        console.log(req.body)
        if(req.body.submit === "admin"){
            res.redirect("/tourist-data");
        }
        else if(req.body.submit === "subadmin"){
            res.redirect("/subadmin-touristData");
        }
       
    } catch (err) {
        console.error("Error saving upload data:", err);
        res.status(500).send("Error saving upload data");
    }
});

app.get("/latest-data", ensureAuthenticated, async function(req, res) {
    try {
        const data = await Upload.find({})
            .sort({ _id: -1 })
            
            
        res.render("latest-data", {
            isAuthenticated: true,
            user: req.user,
            title: "Latest Data",
            path: "/latest-data",
            data,
            value: 1
        });
    } catch (err) {
        console.error("Error fetching latest data:", err);
        res.status(500).send("Error fetching data");
    }
});
app.get("/subadmin-latestData", ensureSubAdminAuthenticated, async function(req,res){
    try {
        const data = await Upload.find({})
            .sort({ _id: -1 })
            
            
        res.render("latest-data", {
            isAuthenticated: true,
            user: req.user,
            title: "Latest Data",
            path: "/latest-data",
            data,
            value: 2
        });
    } catch (err) {
        console.error("Error fetching latest data:", err);
        res.status(500).send("Error fetching data");
    }
})

app.get("/previous-data", ensureAuthenticated, async function(req, res) {
    try {
        const data = await Upload.find({})
            .sort({ _id: 1 })
            
            
        res.render("previous-data", {
            isAuthenticated: true,
            user: req.user,
            title: "Previous Data",
            path: "/previous-data",
            data,
            value:1
        });
    } catch (err) {
        console.error("Error fetching previous data:", err);
        res.status(500).send("Error fetching data");
    }
});
app.get("/subadmin-previousData", ensureSubAdminAuthenticated, async function(req, res) {
    try {
        const data = await Upload.find({})
            .sort({ _id: 1 })
            
            
        res.render("previous-data", {
            isAuthenticated: true,
            user: req.user,
            title: "Previous Data",
            path: "/previous-data",
            data,
            value:2
        });
    } catch (err) {
        console.error("Error fetching previous data:", err);
        res.status(500).send("Error fetching data");
    }
});

const AdminSchema = new mongoose.Schema({
    fullname: String,
    permanentAddress: String,
    position: String,
    phoneNumber: String,
    email: String,
    cnic: String,
    profileImage: String
});

const Admin = mongoose.model("admin", AdminSchema);

app.get("/profile", ensureAuthenticated, async function(req, res) {
    try {
        const data = await Admin.findOne({});
        res.render("profile", {
            isAuthenticated: true,
            user: req.user,
            title: "Profile",
            path: "/profile",
            data
        });
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).send("Error fetching profile");
    }
});

app.post("/admin-form", async function(req, res) {
    try {
        const adminData = {
            fullname: req.body.fullname,
            permanentAddress: req.body.permanentAddress,
            position: req.body.position,
            phoneNumber: req.body.mobile,
            email: req.body.email,
            cnic: req.body.cnic
        };

        const existingAdmin = await Admin.findOne({});
        if (!existingAdmin) {
            await Admin.create(adminData);
        } else {
            Object.assign(existingAdmin, adminData);
            await existingAdmin.save();
        }

        res.redirect("/profile");
    } catch (err) {
        console.error("Error saving/updating admin data:", err);
        res.status(500).send("Error saving/updating admin data");
    }
});
const SubAdminSchema = new mongoose.Schema({
    fullname: String,
    permanentAddress: String,
    position: String,
    phoneNumber: String,
    email: String,
    cnic: String,
    password: String // Add password field
});

// Add Passport-Local Mongoose plugin to SubAdmin schema
SubAdminSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

const SubAdmin = mongoose.model("subadmin", SubAdminSchema);

// Configure Passport for SubAdmin
passport.use('subadmin-local', SubAdmin.createStrategy());

function ensureSubAdminAuthenticated(req, res, next) {
    if (req.isAuthenticated() && req.user instanceof SubAdmin) {
        return next();
    }
    res.redirect('/subadmin-login');
}

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    try {
        let user = await SubAdmin.findById(id);
        if (!user) {
            user = await User.findById(id);
        }
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Registration route for SubAdmin
app.post("/subadmin-form", function(req, res) {
    SubAdmin.register(new SubAdmin({
        fullname: req.body.fullname,
        position: req.body.position,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email,
        cnic: req.body.cnic
    }), req.body.password, function(err, subAdmin) {
        if (err) {
            console.error("Error registering SubAdmin:", err);
            return res.status(500).send("Error registering SubAdmin");
        }
        passport.authenticate('subadmin-local')(req, res, function() {
            res.redirect("/subadmin-dashboard");
        });
    });
});

// Login route for SubAdmin
app.post("/subadmin-login", passport.authenticate('subadmin-local', {
    successRedirect: "/subadmin-dashboard",
    failureRedirect: "/subadmin-login"
}));

app.get("/subadmin-dashboard", ensureSubAdminAuthenticated, async function(req, res) {
    try {
        const uploads = await Upload.find();
        const maleCount = uploads.reduce((total, upload) => total + (upload.males || 0), 0);
        const femaleCount = uploads.reduce((total, upload) => total + (upload.females || 0), 0);
        const userRegistrations = maleCount + femaleCount;
        const tourists = [
            { name: "Samantha W.", country: "PKR", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
            { name: "John D.", country: "USA", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
            { name: "Samantha W.", country: "PKR", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
            { name: "John D.", country: "USA", date: "31, Mar 2025", time: "04:34:45 AM", status: "Active" },
        ];
        res.render('dashboard2', {
            user: req.user,
            title: 'Dashboard',
            path: req.path,
            maleCount,
            femaleCount,
            userRegistrations,
            tourists
        });
    } catch (err) {
        console.error("Error fetching uploads:", err);
        res.status(500).send("Error fetching uploads");
    }
});

app.get("/subadmin-login", function(req, res) {
res.render("subadmin-login")
});




app.get("/admins",function(req,res){
    if(req.isAuthenticated()){
        res.render("admin",{
            isAuthenticated: true,
            user: req.user,
            title: "Admins",
            path: "/admins"
        });
    }else{
        res.redirect("/login");
    }
})

app.get("/tourist_info/:topic", function(req, res) {
    if (req.isAuthenticated()) {
        const no = req.params.topic;
        console.log(no);
        Upload.findOne({ srNo: no })
            .then((data) => {
                console.log(data); // Log data to verify contents
                res.render("tourist_info", {
                    isAuthenticated: true,
                    user: req.user,
                    title: "Tourist Info",
                    path: "/tourist_info",
                    data,
                    value: 1
                });
            })
            .catch((err) => {
                console.error("Error fetching tourist info:", err);
                res.status(500).send("Error fetching tourist info");
            });
    } else {
        res.redirect("/login");
    }
});
app.get("/tourists/:topic", ensureSubAdminAuthenticated, function(req,res){
    const no = req.params.topic;
    console.log(no);
    Upload.findOne({ srNo: no })
        .then((data) => {
            console.log(data); // Log data to verify contents
            res.render("tourist_info", {
                isAuthenticated: true,
                user: req.user,
                title: "Tourist Info",
                path: "/tourist_info",
                data,
                value: 2
            });

        })
        .catch((err) => {
            console.error("Error fetching tourist info:", err);
            res.status(500).send("Error fetching tourist info");
        });
})




app.get("/subadmin-touristData", ensureSubAdminAuthenticated, function(req, res) {
    Upload.find({})
    .sort({ _id: -1 })
    .limit(10)
    .then((data) => {
        res.render("tourist_data", {
            isAuthenticated: true,
            user: req.user,
            title: "Tourist Data",
            path: req.path,
            data,
            value : 2
        });

    })
    .catch((err) => {
        console.error("Error fetching tourist data:", err);
        res.status(500).send("Error fetching tourist data");
    });
    
});


// ERROR HANDLING
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});