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

// mongodb+srv://mesum357:pDliM118811@cluster0.h3knh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
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
app.use(bodyParser.json());
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
    location: String,
    orderNo: String,
    time: String,
    vehicleNumber: String,
    passengers: String,
    females: Number,
    males: Number,
    cnic: Number,
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
    },
    vehicleImage: String,
    foreigners: Number,
    foreignFemales: Number,
    foreignMales: Number,
    createdAt: {
        type: Date,
        default: Date.now
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
        const maleCount = uploads.reduce((total, upload) => total + (upload.males || 0) + (upload.foreignMales || 0), 0);
        const femaleCount = uploads.reduce((total, upload) => total + (upload.females || 0) + (upload.foreignFemales || 0), 0);

        const totalPassengers = uploads.reduce((total, upload) => total + (parseInt(upload.passengers) || 0), 0);
        const totalForeigners = uploads.reduce((total, upload) => total + (parseInt(upload.foreigners) || 0), 0);
        const userRegistrations = uploads.reduce((total, upload) => total + (parseInt(upload.passengers) || 0) + (parseInt(upload.foreigners) || 0), 0);

        // Aggregate data by month for the current year
        const currentYear = new Date().getFullYear();
        const monthlyData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            localTourists: new Array(12).fill(0),
            foreignTourists: new Array(12).fill(0)
        };

        uploads.forEach(upload => {
            const uploadDate = upload.createdAt || new Date();
            const month = uploadDate.getMonth();
            const year = uploadDate.getFullYear();
            
            if (year === currentYear) {
                const localCount = parseInt(upload.passengers) || 0;
                const foreignCount = parseInt(upload.foreigners) || 0;
                
                monthlyData.localTourists[month] += localCount;
                monthlyData.foreignTourists[month] += foreignCount;
            }
        });

        // Get recent vehicle registrations (last 5)
        const recentVehicles = await Upload.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('vehicleNumber passengers time createdAt location');

        // Calculate vehicle entries per day, week, and month
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

        const dailyEntries = await Upload.countDocuments({
            createdAt: { $gte: today }
        });

        const weeklyEntries = await Upload.countDocuments({
            createdAt: { $gte: weekAgo }
        });

        const monthlyEntries = await Upload.countDocuments({
            createdAt: { $gte: monthAgo }
        });

        res.render('index', {
            user: req.user,
            isAuthenticated: true,
            title: 'Dashboard',
            path: '/',
            tourists,
            maleCount,
            femaleCount,
            userRegistrations,
            totalPassengers,
            totalForeigners,
            monthlyData: JSON.stringify(monthlyData),
            recentVehicles,
            dailyEntries,
            weeklyEntries,
            monthlyEntries
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

app.post("/register", function(req, res) {
    // Check if username and password are provided
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required"
        });
    }

    User.register({ username: req.body.username }, req.body.password, function(err, user) {
        if (err) {
            console.error(err);
            return res.status(400).json({
                success: false,
                message: "Registration failed",
                error: err.message
            });
        }
        
        // Don't auto-login for API usage, just return success
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username
            }
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



// Change password
app.post("/settings/change-password", ensureAuthenticated, async function(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        
        console.log('Password change request:', { 
            userId: req.user._id, 
            hasCurrentPassword: !!currentPassword, 
            hasNewPassword: !!newPassword,
            newPasswordLength: newPassword ? newPassword.length : 0
        });
        
        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters long"
            });
        }

        // Find user and verify current password
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password using Passport-Local-Mongoose
        try {
            const isCurrentPasswordValid = await user.authenticate(currentPassword);
            console.log('Password authentication result:', isCurrentPasswordValid);
            
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }
        } catch (authError) {
            console.error('Authentication error:', authError);
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Set new password using Passport-Local-Mongoose
        await user.setPassword(newPassword);
        await user.save();
        
        console.log('Password changed successfully for user:', user.username);

        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: "An error occurred while changing password: " + error.message
        });
    }
});

// Test route to verify password change (for debugging)
app.post("/settings/test-password", ensureAuthenticated, async function(req, res) {
    try {
        const { testPassword } = req.body;
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isPasswordValid = await user.authenticate(testPassword);
        
        res.json({
            success: true,
            isPasswordValid: isPasswordValid,
            username: user.username,
            userId: user._id
        });
    } catch (error) {
        console.error('Test password error:', error);
        res.status(500).json({
            success: false,
            message: "Test failed: " + error.message
        });
    }
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
                value : 1,
                region: req.user.region, // Pass region
                isSubAdmin: !!req.user.region // True if subadmin
            });

        })
        .catch((err) => {
            console.error("Error fetching tourist data:", err);
            res.status(500).send("Error fetching tourist data");
        });
});

app.post('/upload', upload.fields([
    { name: 'profileImage' },
    { name: 'drivingLicenseImage' },
    { name: 'vehicleImage' }
]), async function(req, res) {
    try {
        const profileImage = req.files['profileImage'] ? req.files['profileImage'][0].path : null;
        const drivingLicenseImage = req.files['drivingLicenseImage'] ? req.files['drivingLicenseImage'][0].path : null;
        const vehicleImage = req.files['vehicleImage'] ? req.files['vehicleImage'][0].path : null;


        const upload = new Upload({
            orderNo: req.body.orderDate,
            location: req.body.location,
            time: req.body.orderTime,
            vehicleNumber: req.body.vehicleNumber,
            passengers: req.body.passengers,
            females: Number(req.body.females),
            males: Number(req.body.males),
            goods: req.body.goods,
            cnic: req.body.cnic,
            profileImage,
            drivingLicenseImage,
            vehicleImage,
            vehiclePassengers: req.body.vehiclePassengers || 'no',
            vehicleGoods: req.body.vehicleGoods || 'no',
            foreigners: req.body.foreigners,
            foreignFemales: req.body.foreignFemales,
            foreignMales: req.body.foreignMales
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
       res.render("error");
    }
});

app.get("/latest-data", ensureAuthenticated, async function(req, res) {
    try {
        let query = {};
        if (req.query.cnic && req.query.cnic.trim() !== "") {
            // Use regex for partial match or direct match for exact
            query.cnic = { $regex: req.query.cnic, $options: "i" };
        }
        const data = await Upload.find(query).sort({ srNo: -1 });
        let value = req.user && req.user.role === 'subadmin' ? 2 : 1;
        res.render("latest-data", {
            data: data,
            value: value,
            path: "/latest-data"
        });
    } catch (err) {
        console.error("Error fetching latest data:", err);
        res.render("latest-data", {
            data: [],
            value: req.user && req.user.role === 'subadmin' ? 2 : 1,
            path: "/latest-data"
        });
    }
});
app.get("/subadmin-latestData", ensureSubAdminAuthenticated, async function(req,res){
    try {
        let query = {};
        if (req.query.cnic && req.query.cnic.trim() !== "") {
            query.cnic = { $regex: req.query.cnic, $options: "i" };
        }
        const data = await Upload.find(query)
            .sort({ _id: -1 });
            
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
        let query = {};
        if (req.query.cnic && req.query.cnic.trim() !== "") {
            query.cnic = { $regex: req.query.cnic, $options: "i" };
        }
        const data = await Upload.find(query)
            .sort({ _id: 1 });
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
        let query = {};
        if (req.query.cnic && req.query.cnic.trim() !== "") {
            query.cnic = { $regex: req.query.cnic, $options: "i" };
        }
        const data = await Upload.find(query)
            .sort({ _id: 1 });
            
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
            data: data || {}
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
    password: String, // Add password field
    region: String // Add region field
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
        cnic: req.body.cnic,
        region: req.body.region // Save region
    }), req.body.password, function(err, subAdmin) {
        if (err) {
            console.error("Error registering SubAdmin:", err);
            return res.status(500).send("Error registering SubAdmin");
        }
        passport.authenticate('subadmin-local')(req, res, function() {
            res.redirect("/profile");
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
        const maleCount = uploads.reduce((total, upload) => total + (upload.males || 0) + (upload.foreignMales || 0), 0);
        const femaleCount = uploads.reduce((total, upload) => total + (upload.females || 0) + (upload.foreignFemales || 0), 0);

        const totalPassengers = uploads.reduce((total, upload) => total + (parseInt(upload.passengers) || 0), 0);
        const totalForeigners = uploads.reduce((total, upload) => total + (parseInt(upload.foreigners) || 0), 0);
        const userRegistrations = uploads.reduce((total, upload) => total + (parseInt(upload.passengers) || 0) + (parseInt(upload.foreigners) || 0), 0);

        // Aggregate data by month for the current year
        const currentYear = new Date().getFullYear();
        const monthlyData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            localTourists: new Array(12).fill(0),
            foreignTourists: new Array(12).fill(0)
        };

        uploads.forEach(upload => {
            const uploadDate = upload.createdAt || new Date();
            const month = uploadDate.getMonth();
            const year = uploadDate.getFullYear();
            
            if (year === currentYear) {
                const localCount = parseInt(upload.passengers) || 0;
                const foreignCount = parseInt(upload.foreigners) || 0;
                
                monthlyData.localTourists[month] += localCount;
                monthlyData.foreignTourists[month] += foreignCount;
            }
        });

        // Get recent vehicle registrations (last 5)
        const recentVehicles = await Upload.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('vehicleNumber passengers time createdAt location');

        // Calculate vehicle entries per day, week, and month
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

        const dailyEntries = await Upload.countDocuments({
            createdAt: { $gte: today }
        });

        const weeklyEntries = await Upload.countDocuments({
            createdAt: { $gte: weekAgo }
        });

        const monthlyEntries = await Upload.countDocuments({
            createdAt: { $gte: monthAgo }
        });

        res.render('index', {
            user: req.user,
            isAuthenticated: true,
            title: 'Dashboard',
            path: '/subadmin-dashboard',
            tourists,
            maleCount,
            femaleCount,
            userRegistrations,
            totalPassengers,
            totalForeigners,
            monthlyData: JSON.stringify(monthlyData),
            recentVehicles,
            dailyEntries,
            weeklyEntries,
            monthlyEntries,
            isSubAdmin: true // Flag to indicate this is subadmin view
        });
    } catch (err) {
        console.error('Error fetching tourist data:', err);
        res.status(500).send('Error fetching tourist data');
    }
});

app.get("/subadmin-login", function(req, res) {
res.render("subadmin-login")
});




app.get("/admins",function(req,res){
    if(req.isAuthenticated()){
       
        SubAdmin.find({})
        .then((data)=>{
            res.render("admin",{
                isAuthenticated: true,
                user: req.user,
                title: "Admins",
                path: "/admins",
                data
            });
            console.log(data);
        })
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
                value: 2,
                region: req.user.region, // Pass region
                isSubAdmin: !!req.user.region // True if subadmin
            });
        })
        .catch((err) => {
            console.error("Error fetching tourist data:", err);
            res.status(500).send("Error fetching tourist data");
        });
});


app.post("/delete-subadmin",function(req,res){
    const id = req.body.deleteBtn;
    console.log(id);
    SubAdmin.findByIdAndDelete(id)
       .then(()=>{
            res.redirect("/admins");
        })
       .catch((err)=>{
            console.error("Error deleting subadmin:", err);
            res.status(500).send("Error deleting subadmin");
        });
})

// API endpoint to delete a registered user by ID
app.delete('/api/delete-superadmin/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
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