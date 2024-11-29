require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs'); // Use bcryptjs for consistent hashing

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.static('public/uploads'));
app.set('view engine', 'ejs');

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
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
    res.render('admin-login', { message: null }); // Ensure the view exists
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.render('admin-login', { message: 'Admin not found or incorrect password.' });
        }

        req.session.adminId = admin._id;
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        return res.render('admin-login', { message: 'Server error. Please try again later.' });
    }
});

// --------------------------------------------------------------
app.get('/services', (req, res) => {
    res.render('services');
});

// --------------------------------------------------------------
app.get('/about', (req, res) => {
    res.render('about');
});

// --------------------------------------------------------------
app.get('/contact', (req, res) => {
    res.render('contact');
});

// --------------------------------------------------------------
app.get('/investment-form', (req, res) => {
    res.render('form');
});

// --------------------------------------------------------------
app.get('/login', (req, res) => {
    res.render('customer-login', { message: null }); // Ensure the view exists
});

// Handle Customer Login
// --------------------------------------------------------------
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

        const associate = await Associate.findOne({ associateId: customer.associateId });
        res.render('customerDetails', { customer, associateId: customer.associateId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error. Please try again later.');
    }
});

// Logout Route for Customers
// --------------------------------------------------------------
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/admin');
        }
        res.redirect('/');
    });
});

// Associate Login Form
// --------------------------------------------------------------
app.get('/associate/login', (req, res) => {
    res.render('associate-login');
});

// Handle Associate Login
// --------------------------------------------------------------
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
// --------------------------------------------------------------
app.get('/associate/:id', async (req, res) => {
    const associateId = req.params.id;
    try {
        const associate = await Associate.findOne({ associateId });
        if (!associate) {
            return res.status(404).send("Associate not found.");
        }
        const customers = await Customer.find({ associateId });
        res.render('associate-details', { associate, customers });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching associate details.');
    }
});

// Logout Route for Associates
// --------------------------------------------------------------
app.get('/associate/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect(`/associate/${req.session.associateId}`);
        }
        res.redirect('/associate/login');
    });
});

// Submit Route for Customers
// --------------------------------------------------------------
app.post('/submit', async (req, res) => {
    const {
        oldCustomerId, associateId, associateName, customerName, plan, depositDate,
        depositAmount, utr, aadharNumber, panCard, accountNumber,
        bankName, branch, ifscCode, mobile
    } = req.body;

    let customer;

    if (oldCustomerId) {
        customer = await Customer.findOne({ customerId: oldCustomerId });
        if (!customer) {
            return res.status(404).send("Customer ID not found. Please register as a new user.");
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
});

// Render customer registration page
app.get('/register', (req, res) => {
    res.render('customer-register', { message: null });
});

// Slip Route
// --------------------------------------------------------------
app.get('/slip/:id', async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.id });
    if (!customer) {
        return res.status(404).send("Customer not found.");
    }
    res.render('slip', { customer });
});

// View Investment Details Route
// --------------------------------------------------------------
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

// Admin Route
// --------------------------------------------------------------
app.get('/admin', async (req, res) => {
    if (!req.session.adminId) {
        return res.redirect('/admin/login');
    }
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
// --------------------------------------------------------------
app.get('/admin/customers', async (req, res) => {
    const customers = await Customer.find();
    res.render('customers', { customers });
});

// Investments List Route
// --------------------------------------------------------------
app.get('/admin/investments', async (req, res) => {
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
// --------------------------------------------------------------
app.get('/admin/associates', async (req, res) => {
    try {
        const associates = await Associate.find();
        res.render('associates-list', { associates });
    } catch (error) {
        console.error("Error fetching associates:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Reports Route
// --------------------------------------------------------------
app.get('/admin/reports', async (req, res) => {
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
// --------------------------------------------------------------
app.post('/admin/search', async (req, res) => {
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

// Payment / Pay Now Route
// --------------------------------------------------------------
app.post('/admin/pay', async (req, res) => {
    const { customerId } = req.body;

    try {
        const customer = await Customer.findOne({ customerId });
        if (!customer) {
            return res.status(404).send('Customer not found.');
        }

        const latestInvestment = customer.investments[customer.investments.length - 1];
        if (!latestInvestment) {
            return res.status(400).send('No investments found for this customer.');
        }

        const investmentAmount = latestInvestment.depositAmount;
        const investmentDate = new Date(latestInvestment.depositDate);
        const currentDate = new Date();
        const paymentEligibilityDate = new Date(customer.lastPaymentDate || investmentDate);
        paymentEligibilityDate.setDate(paymentEligibilityDate.getDate() + 30);

        if (currentDate < paymentEligibilityDate) {
            const daysUntilNextPayment = Math.ceil((paymentEligibilityDate - currentDate) / (1000 * 3600 * 24));
            return res.status(400).send(`Next payment not eligible yet. Please wait ${daysUntilNextPayment} more day(s).`);
        }

        customer.paymentsMade += 1;
        const monthlyRate = 0.05; // Example monthly rate
        const paymentCredit = investmentAmount * monthlyRate;

        customer.lastPaymentDate = new Date();
        await customer.save();

        return res.render('pay', {
            success: true,
            customerId,
            investmentAmount,
            paymentCredit: paymentCredit.toFixed(2),
            payDate: new Date().toDateString(),
            bankName: customer.bankName,
            accountNumber: customer.accountNumber,
            branch: customer.branch,
            ifscCode: customer.ifscCode
        });
    } catch (error) {
        console.error(error);
        return res.render('pay', {
            success: false,
            customerId,
            paymentCredit: 0,
            leftAmount: 0,
            paymentReady: false
        });
    }
});

// Admin Deletion Route for Investment
// --------------------------------------------------------------
app.post('/admin/delete-investment', async (req, res) => {
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
// --------------------------------------------------------------
app.post('/admin/update', async (req, res) => {
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
// --------------------------------------------------------------
app.get('/admin/register-associate', (req, res) => {
    res.render('associate-registration');
});

// Handle Associate Registration
// --------------------------------------------------------------
app.post('/admin/register-associate', upload.single('image'), async (req, res) => {
    const {
        fullName,
        address,
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

// Route to show Associate details after registration
// --------------------------------------------------------------
app.get('/admin/associate/:associateId', async (req, res) => {
    const associate = await Associate.findOne({ associateId: req.params.associateId });
    if (!associate) {
        return res.status(404).send("Associate not found.");
    }

    // Fetch customers linked to this associate
    const customers = await Customer.find({ associateId: associate.associateId });
    res.render('associate-details', { associate, customers });
});

// Route for exporting customer data to Excel
// --------------------------------------------------------------
app.get('/admin/export', async (req, res) => {
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
// --------------------------------------------------------------
app.get('/admin/login-history', async (req, res) => {
    try {
        const logins = await LoginHistory.find().sort({ loginTime: -1 });
        res.render('login-history', { logins });
    } catch (error) {
        console.error("Error fetching login history:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
});