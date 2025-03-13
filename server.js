// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');
const { authenticateToken } = require('./middleware/auth');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', routes.authRoutes);
app.use('/api/members', authenticateToken, routes.memberRoutes);
app.use('/api/payments', authenticateToken, routes.paymentRoutes);
app.use('/api/plans', authenticateToken, routes.planRoutes);
app.use('/api/reports', authenticateToken, routes.reportRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// File: models/User.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  membershipType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: function() { return this.role === 'member'; }
  },
  startDate: {
    type: Date,
    required: function() { return this.role === 'member'; }
  },
  endDate: {
    type: Date,
    required: function() { return this.role === 'member'; }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);

// File: models/Payment.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentType: {
    type: String,
    enum: ['membership', 'addon', 'other'],
    default: 'membership'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'cash'],
    required: true
  },
  razorpayPaymentId: {
    type: String
  },
  razorpayOrderId: {
    type: String
  },
  membership: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);

// File: routes/members.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');

// Get all members (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const members = await User.find({ role: 'member' }).select('-password');
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single member (admin or self)
router.get('/:id', async (req, res) => {
  try {
    // Check if user is admin or requesting their own info
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const member = await User.findById(req.params.id).select('-password');
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new member (admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, email, phone, membershipType, startDate, endDate } = req.body;
    
    // Check if user already exists
    let member = await User.findOne({ email });
    
    if (member) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create new member
    member = new User({
      name,
      email,
      password: '123456', // temporary password, should be changed
      phone,
      role: 'member',
      membershipType,
      startDate,
      endDate
    });
    
    await member.save();
    
    res.status(201).json({ message: 'Member added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update member (admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { name, email, phone, membershipType, startDate, endDate, status } = req.body;
    
    const memberFields = {};
    if (name) memberFields.name = name;
    if (email) memberFields.email = email;
    if (phone) memberFields.phone = phone;
    if (membershipType) memberFields.membershipType = membershipType;
    if (startDate) memberFields.startDate = startDate;
    if (endDate) memberFields.endDate = endDate;
    if (status) memberFields.status = status;
    
    let member = await User.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    member = await User.findByIdAndUpdate(
      req.params.id,
      { $set: memberFields },
      { new: true }
    ).select('-password');
    
    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete member (admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const member = await User.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Member deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// File: routes/payments.js
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const { isAdmin } = require('../middleware/auth');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Get all payments (admin only)
router.get('/', isAdmin, async (req, res) => {
  try {
    const payments = await Payment.find().populate('userId', 'name email');
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payments for specific user
router.get('/user/:userId', async (req, res) => {
  try {
    // Check if user is admin or requesting their own info
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const payments = await Payment.find({ userId: req.params.userId });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, membership } = req.body;
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: 'receipt_' + new Date().getTime()
    };
    
    razorpay.orders.create(options, (err, order) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error creating order' });
      }
      
      res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify payment and update membership
router.post('/verify', async (req, res) => {
  try {
    const { 
      razorpayPaymentId, 
      razorpayOrderId, 
      razorpaySignature,
      membership,
      amount 
    } = req.body;
    
    // Here you should verify the payment with Razorpay signature
    // This is a simplified example
    
    // Calculate membership dates
    const startDate = new Date();
    let endDate = new Date();
    
    if (membership === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (membership === 'quarterly') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (membership === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    // Create payment record
    const payment = new Payment({
      userId: req.user.id,
      amount: amount / 100, // Convert from paise to INR
      paymentType: 'membership',
      paymentMethod: 'card', // Or get from request
      razorpayPaymentId,
      razorpayOrderId,
      membership,
      status: 'completed',
      startDate,
      endDate
    });
    
    await payment.save();
    
    // Update user's membership
    await User.findByIdAndUpdate(req.user.id, {
      membershipType: membership,
      startDate,
      endDate,
      status: 'active'
    });
    
    res.json({ success: true, message: 'Payment verified and membership updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// File: middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Unauthorized. Admin access required' });
  }
};

module.exports = { authenticateToken, isAdmin };
