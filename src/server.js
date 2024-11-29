require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.static('public/uploads'));
app.set('view engine', 'ejs');

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || '8485_hghegh_hqihwjg-hweujw-wuqyhrded-22',
    resave: false,
    saveUninitialized: true,
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true, // Add a comma here
    serverSelectionTimeoutMS: 20000,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));
// Mongoose Schema for Login History
const loginHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userType: { type: String, required: true }, // 'customer' or 'associate'
    loginTime: { type: Date, default: Date.now }
});
const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

// Mongoose Schema for Admin
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', adminSchema);

// Mongoose Schema for Customer
const customerSchema = new mongoose.Schema({
    customerId: { type: String, required: true, unique: true },
    associateId: { type: String },
    associateName: String,
    customerName: String,
    plan: String,
    depositDate: { type: Date, default: Date.now },
    depositAmount: Number,
    utr: { type: String, default: "Not Provided" },
    aadharNumber: String,
    panCard: String,
    accountNumber: String,
    bankName: String,
    branch: String,
    ifscCode: String,
    mobile: String,
    investments: [{
        depositDate: Date,
        depositAmount: Number,
        utr: String,
    }],
    paymentsMade: { type: Number, default: 0 },
    lastPaymentDate: { type: Date },
    profilePhoto: { type: String }
});
const Customer = mongoose.model('Customer', customerSchema);

// Mongoose Schema for Associate
const associateSchema = new mongoose.Schema({
    associateId: { type: String, required: true, unique: true },
    fullName: String,
    address: String,
    oldassociate: { type: String }, // This line is corrected
    city: String,
    state: String,
    zipCode: String,
    aadharNumber: String,
    panCard: String,
    mobileNumber: String,
    email: String,
    bankName: String,
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    dob: Date,
    gender: String,
    emergencyContactName: String,
    emergencyContactNumber: String,
    nomineeName: String,
    nomineeRelationship: String,
    nomineeMobile: String,
    nomineeEmail: String,
    date: { type: Date, default: Date.now },
    signature: String,
    image: String
});
const Associate = mongoose.model('Associate', associateSchema);

// Mongoose Schema for Payment History
const paymentHistorySchema = new mongoose.Schema({
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    bankName: { type: String, required: true },
    branch: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    amount: { type: Number, required: true },
});

const PaymentHistory = mongoose.model('PaymentHistory', paymentHistorySchema);

// Mongoose Schema for Director
const directorSchema = new mongoose.Schema({
    loginId: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Director = mongoose.model('Director', directorSchema);

// Generate Customer ID
const generateCustomerId = async () => {
    const count = await Customer.countDocuments();
    return `CUS${String(count + 1).padStart(4, '0')}`;
};

// Generate Associate ID
const generateAssociateId = async () => {
    const count = await Associate.countDocuments();
    return `ASSOC${String(count + 1).padStart(4, '0')}`;
};

// Configure Multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'public/uploads');
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

// Middleware to protect admin routes
const adminAuth = (req, res, next) => {
    if (!req.session.adminId) {
        // If not authenticated, prompt for credentials
        res.redirect('/admin/login'); // Redirect to admin login
    } else {
        next(); // Proceed if authenticated
    }
};

// Route Definitions
app.get('/', (req, res) => {
    res.render('index');
});

// Admin Registration Route
app.get('/admin/register', (req, res) => {
    res.render('admin-register', { message: null });
});

app.post('/admin/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.render('admin-register', { message: 'Username is already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({ username, password: hashedPassword });
        await newAdmin.save();

        req.session.adminId = newAdmin._id;
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        return res.render('admin-register', { message: 'An error occurred during registration. Please try again.' });
    }
});

// Admin Login Route
app.get('/admin/login', (req, res) => {
    res.render('admin-login', { message: null });
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.render('admin-login', { message: 'Admin not found or incorrect password.' });
        }

        req.session.adminId = admin._id;

        // Redirect to the admin path they wanted to access
        const redirectPath = req.session.redirectPath || '/admin';
        delete req.session.redirectPath; // Clear the redirect path after redirection
        res.redirect(redirectPath);
    } catch (error) {
        console.error(error);
        return res.render('admin-login', { message: 'Server error. Please try again later.' });
    }
});

// Director Registration Route
app.get('/admin/newdir-ragi-now', adminAuth, (req, res) => { // Protect this route
    res.render('register-director');
});

app.post('/admin/newdir-ragi-now', async (req, res) => {
    const { fullName, password } = req.body;

    try {
        const existingDirector = await Director.findOne({ loginId: fullName });
        if (existingDirector) {
            return res.status(400).send('Director already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newDirector = new Director({ loginId: fullName, password: hashedPassword });
        await newDirector.save();
        
        res.redirect('/admin/dlogin');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred during registration. Please try again');
    }
});

// Director Login Route
app.get('/admin/dlogin', (req, res) => {
    res.render('login-director');
});

// Middleware for authentication
function requireAuth(req, res, next) {
    if (!req.session.registerId) {
        return res.redirect('/admin/dlogin');
    }
    next();
}

// Login route
app.post('/admin/dlogin', async (req, res) => {
    const { loginId, loginPassword } = req.body;
    try {
        const director = await Director.findOne({ loginId });
        if (!director || !await bcrypt.compare(loginPassword, director.password)) {
            return res.status(401).send('Invalid login credentials');
        }
        req.session.registerId = director.loginId;
        res.redirect('/user');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred during login. Please try again');
    }
});

// Director Main Page (protected route)
app.get('/user', requireAuth, (req, res) => {
    res.render('director', { username: req.session.registerId });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out at this time');
        }
        res.redirect('/admin/logout');
    });
});

// API endpoint for dashboard data
app.get('/api/dashboard-data', async (req, res) => {
    try {
        const customers = await Customer.find();
        
        const totalCustomers = customers.length;
        const activeCustomers = customers.filter(customer => customer.investments.length > 0).length;
        const totalInvestment = customers.reduce((acc, customer) => {
            return acc + customer.investments.reduce((sum, inv) => sum + inv.depositAmount, 0);
        }, 0);

        // Aggregate investments by month
        const monthlyInvestments = {};
        customers.forEach(customer => {
            customer.investments.forEach(investment => {
                const month = investment.depositDate.toLocaleString('default', { month: 'long' });
                if (!monthlyInvestments[month]) {
                    monthlyInvestments[month] = 0;
                }
                monthlyInvestments[month] += investment.depositAmount;
            });
        });
        const investmentData = {
            labels: Object.keys(monthlyInvestments),
            data: Object.values(monthlyInvestments),
        };

        res.json({
            totalCustomers,
            activeCustomers,
            totalInvestment,
            investmentData,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

// Logout for Directors
app.post('/dlogout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/admin/logout');
    });
});

// Other Routes

// Services Page
app.get('/services', (req, res) => {
    res.render('services');
});

// About Page
app.get('/about', (req, res) => {
    res.render('about');
});

// Contact Page
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Investment Form Page
app.get('/investment-form', (req, res) => {
    res.render('form');
});

// Customer Login Page
app.get('/login', (req, res) => {
    res.render('customer-login', { message: null });
});

// Handle Customer Login
app.post('/login', async (req, res) => {
    const { customerId } = req.body;
    try {
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).send('Customer not found. Please check your CUS ID.');
        }
        req.session.customerId = customerId;

        // Record login history
        await LoginHistory.create({ userId: customerId, userType: 'customer' });

        // Fetch payment history for the logged-in customer
        const paymentHistory = await PaymentHistory.find({ customerId }).sort({ date: -1 });

        const associate = await Associate.findOne({ associateId: customer.associateId });
        res.render('customerDetails', { customer, associateId: customer.associateId, paymentHistory });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error. Please try again later.');
    }
});

// Logout Route for Customers
app.get('/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin');
        }
        res.redirect('/');
    });
});

// Associate Login Form
app.get('/associate/login', (req, res) => {
    res.render('associate-login');
});

// Handle Associate Login
app.post('/associate/login', async (req, res) => {
    const { associateId } = req.body;
    try {
        const associate = await Associate.findOne({ associateId });
        if (!associate) {
            return res.status(404).send('Associate not found. Please check your Associate ID.');
        }
        req.session.associateId = associateId;

        // Record login history
        await LoginHistory.create({ userId: associateId, userType: 'associate' });

        // After successful login, redirect to the associate's page
        res.redirect(`/associate/${associateId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error. Please try again later.');
    }
});

// Associate Details Route
app.get('/associate/:id', async (req, res) => {
    const associateId = req.params.id;
    try {
        const associate = await Associate.findOne({ associateId });
        if (!associate) {
            return res.status(404).send("Associate not found.");
        }

        // Fetch customers linked to this associate
        const customers = await Customer.find({ associateId });

        // Fetch downline associates
        const downlineAssociates = await Associate.find({ oldassociate: associateId });

        res.render('associate-details', { associate, customers, downlineAssociates });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching associate details.');
    }
});

// Logout Route for Associates
app.get('/associate/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect(`/associate/${req.session.associateId}`);
        }
        res.redirect('/associate/login');
    });
});

// Submit Route for Customers
app.post('/submit', async (req, res) => {
    const {
        oldCustomerId, associateId, associateName, customerName, plan, depositDate,
        depositAmount, utr, aadharNumber, panCard, accountNumber,
        bankName, branch, ifscCode, mobile
    } = req.body;

    try {
        // Initialize an array to collect field names associated with errors
        const errors = [];

        // Check for existing Aadhar number
        const aadharExists = await Customer.findOne({ aadharNumber });
        if (aadharExists) {
            errors.push("Aadhar number");
        }

        // Check for existing UTR
        const utrExists = await Customer.findOne({ utr });
        if (utrExists) {
            errors.push("UTR");
        }

        // Check for any accumulated errors
        if (errors.length > 0) {
            const errorMessage = `${errors.join(', ')} you provided are already linked to another customer. Please check and try again.`;
            return res.render('investment-form', {
                error: errorMessage,
                formData: req.body // Retain user input on the form
            });
        }

        let customer;

        if (oldCustomerId) {
            customer = await Customer.findOne({ customerId: oldCustomerId });
            if (!customer) {
                return res.render('investment-form', {
                    error: "Customer ID not found. Please register as a new user.",
                    formData: req.body
                });
            }
        } else {
            const customerId = await generateCustomerId();
            customer = new Customer({
                customerId,
                associateId,
                associateName,
                customerName,
                plan,
                depositDate: new Date(depositDate),
                depositAmount,
                utr,
                aadharNumber,
                panCard,
                accountNumber,
                bankName,
                branch,
                ifscCode,
                mobile
            });
            await customer.save();
        }

        if (customer) {
            customer.investments.push({
                depositDate: new Date(depositDate),
                depositAmount,
                utr,
            });
            await customer.save();
        }

        res.redirect(`/slip/${customer.customerId}`);
    } catch (error) {
        console.error("Error during submission:", error);
        res.status(500).send("An error occurred while processing your request.");
    }
});

// Render customer registration page
app.get('/register', (req, res) => {
    res.render('customer-register', { message: null });
});

// Slip Route
app.get('/slip/:id', async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer) {
        return res.status(404).send("Customer not found.");
    }
    res.render('slip', { customer });
});

// View Investment Details Route
app.get('/view-investment', async (req, res) => {
    const { customerId } = req.query;
    if (!customerId) {
        return res.status(400).send("Customer ID is required.");
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
        return res.status(404).send("Customer not found.");
    }

    const totalInvestment = customer.investments.reduce((sum, inv) => sum + inv.depositAmount, 0);
    res.render('investment-details', { customer, totalInvestment });
});

// Admin Dashboard Route
app.get('/admin', adminAuth, async (req, res) => { // Protect this route
    try {
        const customers = await Customer.find();
        const totalCustomers = customers.length;
        const totalInvestment = customers.reduce((acc, curr) => acc + curr.investments.reduce((sum, inv) => sum + inv.depositAmount, 0), 0);
        const activeCustomers = customers.filter(customer => customer.investments.length > 0).length;

        res.render('admin', { customers, totalCustomers, activeCustomers, totalInvestment });
    } catch (error) {
        console.error("Error fetching admin data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Customers List Route
app.get('/admin/customers', adminAuth, async (req, res) => { // Protect this route
    const customers = await Customer.find();
    res.render('customers', { customers });
});

// Investments List Route
app.get('/admin/investments', async (req, res) => { // Removed adminAuth middleware
    let investments = await Customer.aggregate([
        { $unwind: '$investments' },
        {
            $project: {
                customerId: '$customerId',
                customerName: '$customerName',
                depositAmount: '$investments.depositAmount',
                depositDate: '$investments.depositDate'
            }
        }
    ]);

    res.render('investments', { investments });
});

// View All Associates Route
app.get('/admin/associates', async (req, res) => { // Removed adminAuth middleware
    try {
        const associates = await Associate.find();
        res.render('associates-list', { associates });
    } catch (error) {
        console.error("Error fetching associates:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Reports Route
app.get('/admin/reports', adminAuth, async (req, res) => { // Protect this route
    try {
        const highInvestments = await Customer.aggregate([
            { $unwind: '$investments' },
            {
                $match: { 'investments.depositAmount': { $gt: 10000 } }
            },
            {
                $group: {
                    _id: '$customerId',
                    customerName: { $first: '$customerName' },
                    associateName: { $first: '$associateName' },
                    totalInvestment: { $sum: '$investments.depositAmount' }
                }
            },
            { $sort: { totalInvestment: -1 } }
        ]);

        const totalCustomers = await Customer.countDocuments();
        const activeCustomers = await Customer.countDocuments({ 'investments.0': { $exists: true } });
        const totalInvestment = highInvestments.reduce((sum, investment) => sum + investment.totalInvestment, 0);

        res.render('reports', { highInvestments, totalCustomers, activeCustomers, totalInvestment });
    } catch (error) {
        console.error("Error fetching report data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Search Functionality for Admin
app.post('/admin/search', adminAuth, async (req, res) => { // Protect this route
    const customerId = req.body.customerId;

    try {
        const customer = await Customer.findOne({ customerId });
        if (customer) {
            const totalInvestment = customer.investments.reduce((sum, inv) => sum + inv.depositAmount, 0);
            return res.render('admin', {
                customers: [customer],
                totalCustomers: 1,
                activeCustomers: 1,
                totalInvestment,
                investments: customer.investments
            });
        } else {
            res.redirect('/admin');
        }
    } catch (error) {
        console.error("Error during admin search:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Admin Deletion Route for Investment
app.post('/admin/delete-investment', adminAuth, async (req, res) => { // Protect this route
    const { customerId, investmentId } = req.body;

    try {
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).send('Customer not found.');
        }

        customer.investments = customer.investments.filter(investment => investment._id.toString() !== investmentId);
        await customer.save();

        res.redirect('/admin');
    } catch (error) {
        console.error("Error during investment deletion:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Update Customer Details Route
app.post('/admin/update', adminAuth, async (req, res) => { // Protect this route
    const {
        customerId,
        associateName,
        associateId,
        customerName,
        bankName,
        branch,
        accountNumber,
        ifsc,
        mobile
    } = req.body;

    try {
        const result = await Customer.updateOne(
            { customerId },
            {
                $set: {
                    associateName,
                    customerName,
                    associateId,
                    bankName,
                    branch,
                    accountNumber,
                    ifscCode: ifsc,
                    mobile
                }
            }
        );

        if (result.nModified === 0) {
            return res.status(404).send('Customer not found or no updates made.');
        }

        res.redirect('/admin');
    } catch (error) {
        console.error("Error updating customer details:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Register New Associate Route
// Register New Associate Route
app.get('/admin/register-associate', adminAuth, async (req, res) => { // Protect this route
    try {
        const associates = await Associate.find(); // Fetch all associates
        res.render('associate-registration', { associates }); // Pass associates to the view
    } catch (error) {
        console.error("Error fetching associates:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Handle Associate Registration
app.post('/admin/register-associate', upload.single('image'), adminAuth, async (req, res) => { // Protect this route
    const {
        fullName,
        address,
        oldassociate,
        city,
        state,
        zipCode,
        aadharNumber,
        panNumber,
        mobileNumber,
        email,
        bankName,
        accountHolderName,
        accountNumber,
        ifscCode,
        dob,
        gender,
        emergencyContactName,
        emergencyContactNumber,
        nomineeName,
        nomineeRelationship,
        nomineeMobile,
        nomineeEmail,
        signature,
        date,
    } = req.body;

    try {
        const associateId = await generateAssociateId();

        // Prepare associate data
        const associateData = {
            associateId,
            fullName,
            address,
            oldassociate,
            city,
            state,
            zipCode,
            aadharNumber,
            panCard: panNumber,
            mobileNumber,
            email,
            bankName,
            accountHolderName,
            accountNumber,
            ifscCode,
            dob,
            gender,
            emergencyContactName,
            emergencyContactNumber,
            nomineeName,
            nomineeRelationship,
            nomineeMobile,
            nomineeEmail,
            date,
            signature,
            image: req.file ? req.file.path : null // Save image path if uploaded
        };

        const associate = new Associate(associateData);
        await associate.save();

        // Redirect to associate detail page
        res.redirect(`/admin/associate/${associate.associateId}`);
    } catch (error) {
        console.error("Error registering associate:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Route to show the full downline tree of all associates and customers
app.get('/downline-tree', async (req, res) => {
    try {
        // Fetch all associates
        const associates = await Associate.find().lean();

        // Fetch all customers
        const customers = await Customer.find().lean();

        // Build a map of associates by their ID for quick lookup
        const associatesMap = {};
        associates.forEach(associate => {
            associatesMap[associate.associateId] = { ...associate, customers: [] };
        });

        // Assign customers to their respective associates based on associateId
        customers.forEach(customer => {
            if (associatesMap[customer.associateId]) {
                associatesMap[customer.associateId].customers.push(customer);
            }
        });

        // Create the final data structure for the tree
        const downlineTree = associates.map(associate => {
            return {
                ...associate,
                customers: associatesMap[associate.associateId].customers,
                downline: associates.filter(a => a.oldassociate === associate.associateId)
            };
        });

        res.render('downline-tree', { downlineTree });
    } catch (error) {
        console.error("Error fetching downline tree:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Route to show Associate details after registration
app.get('/admin/associate/:associateId', adminAuth, async (req, res) => { // Protect this route
    const associate = await Associate.findOne({ associateId: req.params.associateId });
    if (!associate) {
        return res.status(404).send("Associate not found.");
    }

    // Fetch customers linked to this associate
    const customers = await Customer.find({ associateId: associate.associateId });
    res.render('associate-details', { associate, customers });
});

// Route for exporting customer data to Excel
app.get('/admin/export', adminAuth, async (req, res) => { // Protect this route
    try {
        const customers = await Customer.find();
        const worksheetData = customers.map(customer => ({
            'Associate Name': customer.associateName || 'Not Provided',
            'Associate ID': customer.associateId || 'Not Provided',
            'Customer Name': customer.customerName || 'Not Provided',
            'Customer ID': customer.customerId || 'Not Provided',
            'Plan': customer.plan || 'Not Provided',
            'Deposits Amount (₹)': customer.investments ? customer.investments.reduce((sum, inv) => sum + inv.depositAmount, 0) : 0,
            'Deposit Date': customer.investments && customer.investments.length > 0 ? new Date(customer.investments[0].depositDate).toLocaleDateString() : 'Not Provided',
            'UTR/IMPS': customer.utr || 'Not Provided',
            'AADHAR Number': customer.aadharNumber || 'Not Provided',
            'PAN Card': customer.panCard || 'Not Provided',
            'Bank Name': customer.bankName || 'Not Provided',
            'Account Number': customer.accountNumber || 'Not Provided',
            'Branch': customer.branch || 'Not Provided',
            'IFSC Code': customer.ifscCode || 'Not Provided',
            'Mobile Number': customer.mobile || 'Not Provided',
        }));

        // Create a new workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

        // Set the response headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');

        // Write the workbook to a buffer and send it
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.end(buffer);
    } catch (error) {
        console.error("Error exporting customers to Excel:", error);
        res.status(500).send("Internal Server Error");
    }
});

// View Login History
app.get('/admin/login-history', adminAuth, async (req, res) => { // Protect this route
    try {
        const logins = await LoginHistory.find().sort({ loginTime: -1 });
        res.render('login-history', { logins });
    } catch (error) {
        console.error("Error fetching login history:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Admin List Route
app.get('/admin/admins', adminAuth, async (req, res) => { // Protect this route
    try {
        const admins = await Admin.find(); // Fetch all admins
        const totalAdmins = admins.length;
        res.render('admin-list', { admins, totalAdmins });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Admin Deletion Route
app.post('/admin/delete/:id', adminAuth, async (req, res) => { // Protect this route
    const adminId = req.params.id;

    try {
        await Admin.findByIdAndDelete(adminId); // Delete the admin by ID
        res.redirect('/admin/admins'); // Redirect to admin list
    } catch (error) {
        console.error("Error during admin deletion:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Admin Edit Route
app.get('/admin/edit/:id', adminAuth, async (req, res) => { // Protect this route
    const adminId = req.params.id;
    try {
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).send("Admin not found.");
        }
        res.render('admin-edit', { admin }); // Render the edit view with found admin data
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// Admin Update Route
app.post('/admin/edit/:id', adminAuth, async (req, res) => { // Protect this route
    const adminId = req.params.id;
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const updateData = { username, password: hashedPassword };
        
        await Admin.findByIdAndUpdate(adminId, updateData);
        res.redirect('/admin/admins'); // Redirect to admin list after update
    } catch (error) {
        console.error("Error updating admin:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Payment Return Route to get the form
app.get('/payment-return', (req, res) => {
    res.render('payment-return', { history: paymentHistory });
});

// Handle Payment Return Submission
app.post('/payment-return/submit', async (req, res) => {
    const { customerId, amount, utr } = req.body;

    // Validate customer before fetching
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
        return res.status(404).send("Customer not found.");
    }

    // Fetch associate information
    const associate = await Associate.findOne({ associateId: customer.associateId }); // Get associate information

    const date = new Date().toLocaleString(); // Store the date
    const returnMonth = new Date().toLocaleString('default', { month: 'long' }); // Current month
    
    // Save the payment details
    paymentHistory.push({
        date,
        customerName: customer.customerName,
        customerId,
        associateName: associate ? associate.fullName : 'Not Provided',
        amount,
        utr,
        returnMonth
    });

    // Redirect to the payment return page showing updated history
    res.redirect('/payment-return');
});

// Configuring Multer for Excel file uploads
const uploadBulkPayments = multer({
    storage: multer.memoryStorage(), // Store file in memory for easy access
});

// Route for bulk payments upload form
app.get('/admin/bulk-payments', adminAuth, (req, res) => { // Protect this route
    res.render('bulk-payments', { message: null });
});

// Handle bulk payments submission
app.post('/admin/bulk-payments', adminAuth, uploadBulkPayments.single('bulkFile'), async (req, res) => { // Protect this route
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of data) {
            const { 
                'CUSTOMER NAME': customerName, 
                'CUSTOMER ID': customerId, 
                'BANK NAME': bankName, 
                'BRANCH': branch, 
                'ACCOUNT NUMBER': accountNumber, 
                'IFSC CODE': ifscCode, 
                'AMOUNT': amount 
            } = row;

            if (customerId && amount) {
                const customer = await Customer.findOne({ customerId });
                if (customer) {
                    customer.paymentsMade += amount; 
                    customer.lastPaymentDate = new Date(); 
                    await customer.save(); 

                    const paymentHistoryEntry = new PaymentHistory({
                        customerId,
                        customerName,
                        date: new Date(),
                        bankName,
                        branch,
                        accountNumber,
                        ifscCode,
                        amount
                    });
                    await paymentHistoryEntry.save(); 
                } else {
                    console.warn(`Customer not found for ID: ${customerId}`);
                }
            }
        }

        // After processing, render the payment history page showing all entries
        const histories = await PaymentHistory.find().sort({ date: -1 });
        res.render('payment-history', { paymentHistory: histories });
    } catch (error) {
        console.error("Error processing bulk payments:", error);
        res.status(500).send("An error occurred while processing payments.");
    }
});

// Route to view customer's payment history
app.get('/customer/payment-history', async (req, res) => {
    const customerId = req.session.customerId; // Fetch the customerId from the session
    if (!customerId) {
        return res.status(403).send("Access denied. Please log in.");
    }

    try {
        // Fetch customer data
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        // Fetch payment history for the customer
        const paymentHistory = await PaymentHistory.find({ customerId }).sort({ date: -1 });

        // Render the payment history page with customer and payment data
        res.render('payment-history', { customer, paymentHistory });
    } catch (error) {
        console.error("Error fetching payment history:", error);
        res.status(500).send("Internal Server Error");
    }
});

// View Bulk Payment History Route
app.get('/admin/bulk-payment-history', adminAuth, async (req, res) => { // Protect this route
    try {
        const histories = await PaymentHistory.find().sort({ date: -1 });  // Fetch all payment histories sorted by date
        res.render('payment-history', { paymentHistory: histories });  // Render the payment history view with fetched histories
    } catch (error) {
        console.error("Error fetching bulk payment history:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Admin Delete Payment History Entry
app.delete('/admin/payment-history/:id', adminAuth, async (req, res) => { // Protect this route
    const { id } = req.params;

    try {
        // Remove payment entry from the payment history
        await PaymentHistory.findByIdAndDelete(id);
        res.status(204).send(); // No content for successful delete
    } catch (error) {
        console.error("Error deleting payment history:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Route to show the information input form
app.get('/show-info', (req, res) => {
    res.render('show-info');
});

// Route to handle form submission and redirect
app.post('/redirect-customer', (req, res) => {
    const customerId = req.body.customerId;
    // Redirect to the investment-form-print page with the specified customerId
    res.redirect(`/investment-form-print/${customerId}`);
});

// Route to display investment form for printing by customer ID
app.get('/investment-form-print/:customerId', async (req, res) => {
    const customerId = req.params.customerId;
    try {
        // Fetch the customer details from the database
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        // Render the investment-form-print view with customer data
        res.render('investment-form-print', {
            customer: {
                customerId: customer.customerId,
                associateName: customer.associateName,
                associateId: customer.associateId,
                customerName: customer.customerName,
                investmentPlan: customer.plan,
                depositDate: customer.depositDate,
                depositAmount: customer.depositAmount,
                utr: customer.utr,
                aadharNumber: customer.aadharNumber,
                panCard: customer.panCard,
                accountNumber: customer.accountNumber,
                bankName: customer.bankName,
                branch: customer.branch,
                ifscCode: customer.ifscCode,
                mobile: customer.mobile
            }
        });
    } catch (error) {
        console.error("Error fetching customer data:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Privacy Policy Route
app.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy', { effectiveDate: '05-11-2024', email: 'IAMMSHYAM@GMAIL.COM', address: 'Lucknow, Uttar Pradesh, India - 226016' });
});

// Terms of Service Route
app.get('/terms', (req, res) => {
    res.render('terms', { effectiveDate: '05-11-2024', email: 'IAMMSHYAM@GMAIL.COM', address: 'Lucknow, Uttar Pradesh, India - 226016' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
