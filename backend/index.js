require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes, Op } = require('sequelize');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');

const app = express();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173', // Frontend local development URL
  methods: ['GET', 'POST', 'PUT'], // Allow these methods
  allowedHeaders: ['Content-Type'], // Allow these headers
  credentials: true, // Enable credentials
}));
app.use(bodyParser.json());

const port = process.env.PORT || 5000; // Port configuration

// Sequelize database connection
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Important, as Aiven PostgreSQL requires SSL
    },
  },
});

// Define the Invoice model
const Invoice = sequelize.define('Invoice', {
  recipientAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  formidium_address: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '0xbcDc0883787BA970d450917724CeB73059720265',
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cryptocurrency: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  companyEmail: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  invoiceCategory: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  paymentDue: {
    type: DataTypes.NUMERIC, // Use NUMERIC to ensure accurate decimal handling
    allowNull: false,
  },
  isPending: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true, // Default to true as invoices are pending when created
  },
});

// Define the User model
const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

const PaymentDetail = sequelize.define('PaymentDetail', {
  paymentId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  senderAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recipientAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amountPaid: {
    type: DataTypes.NUMERIC(10, 5),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Invoices',
      key: 'id'
    }
  },
  transactionHash: {
    type: DataTypes.STRING,
    allowNull: false,
  }
});

PaymentDetail.belongsTo(Invoice, {
  foreignKey: 'invoiceId'
});

// Sync Database
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true }); // Sync models with database
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  port: 587,
  host: 'smtp.gmail.com',
  auth: {
    user: process.env.EMAIL_NAME,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

// Routes

// Admin login route
const adminCredentials = {
  email: 'admin@example.com',
  password: 'admin123',
};

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.findAll();
    res.status(200).json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices'});
}
});

app.post('/api/admin-login', (req, res) => {
  const { email, password } = req.body;

  console.log('Admin login attempt:', { email, password });

  // Check if the received credentials match the hardcoded admin credentials
  if (email === adminCredentials.email && password === adminCredentials.password) {
    // Successful login
    console.log('Admin login successful');
    res.status(200).json({ message: 'Admin login successful' });
  } else {
    // Invalid credentials
    console.log('Invalid credentials');
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Create a new invoice
app.post('/api/invoices', async (req, res) => {
  const {
    recipientAddress,
    companyName,
    cryptocurrency,
    dueDate,
    description,
    companyEmail,
    invoiceCategory,
    paymentDue
  } = req.body;

  try {
    const invoice = await Invoice.create({
      recipientAddress,
      companyName,
      cryptocurrency,
      dueDate,
      description,
      companyEmail,
      invoiceCategory,
      paymentDue
    });

    const mailOptions = {
      from: process.env.EMAIL_NAME,
      to: companyEmail,
      subject: 'Invoice Created',
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h1 style="color: #4CAF50;">Invoice Created</h1>
        <p>Dear Customer,</p>
        <p>We would like to inform you that an invoice has been created. You can view it by clicking the link below:</p>
        <a href="http://your-domain.com/invoice/${invoice.id}"
           style="display: inline-block; margin: 10px 0; padding: 10px 20px; color: #fff; background-color: #4CAF50; text-decoration: none; border-radius: 5px;">
           View Invoice
        </a>
        <p>If you have any questions, feel free to contact.</p>
        <p>Best regards,</p>
        <p>Formidium</p>
        <hr style="border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 0.9em;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `,    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
    } catch (error) {
      console.error('Error sending email:', error);
      return res.status(500).send('Failed to send email');
    }

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Fetch all invoices for a recipientAddress
app.get('/user/:recipientAddress/invoices', async (req, res) => {
  const { recipientAddress } = req.params;

  try {
    const invoices = await Invoice.findAll({
      where: {
        recipientAddress: {
          [Op.iLike]: recipientAddress,
        },
      },
    });

    res.status(200).json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Update payment details for an invoice
app.put('/invoices/:invoiceId/payment', async (req, res) => {
  const { invoiceId } = req.params;
  const { amountPaid, walletAddress ,transactionHash} = req.body;

  console.log('Received payment update request:', { amountPaid, walletAddress, transactionHash });

  const transaction = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(invoiceId,{transaction});

    if (!invoice) {
      console.error(`Invoice with ID ${invoiceId} not found`);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.recipientAddress !== walletAddress) {
      return res.status(403).json({ error: 'Unauthorized: Wallet address does not match the recipient address' });
    }

    const existingPaymentDue = parseFloat(invoice.paymentDue);
    const paymentAmount = parseFloat(amountPaid);

    if (isNaN(existingPaymentDue) || isNaN(paymentAmount)) {
      console.error('Invalid payment amount:', { existingPaymentDue, paymentAmount });
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const newPaymentDue = existingPaymentDue - paymentAmount;
    if (newPaymentDue < 0) {
      console.error('Payment exceeds the amount due:', { newPaymentDue });
      return res.status(400).json({ error: 'Payment exceeds the amount due' });
    }

    invoice.paymentDue = newPaymentDue.toFixed(5);
    invoice.isPending = newPaymentDue > 0;

    console.log('Updated invoice details:', { paymentDue: invoice.paymentDue, isPending: invoice.isPending });
    await invoice.save({transaction});

    console.log('Saving payment details:', {
      senderAddress: walletAddress,
      recipientAddress: invoice.formidium_address,
      amountPaid: paymentAmount.toFixed(5), // Ensuring correct precision
      invoiceId: invoice.id,
      transactionHash: transactionHash,
    });

    const paymentDetail = await PaymentDetail.create({
      senderAddress: walletAddress,
      recipientAddress: invoice.formidium_address,
      amountPaid: paymentAmount.toFixed(5), // Ensuring correct precision
      invoiceId: invoice.id,
      transactionHash: transactionHash,
    }, { transaction });

    console.log('Payment details saved:', paymentDetail);

    await transaction.commit();

    res.status(200).json({ invoice, paymentId: paymentDetail.paymentId });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating invoice paymentDue:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update invoice paymentDue', details: error.message });
  }
});

// Get pending invoices
app.get('/invoices/pending', async (req, res) => {
  try {
    const pendingInvoices = await Invoice.findAll({
      where: {
        isPending: true,
        paymentDue: {
          [Op.gt]: 0 // Fetch invoices where paymentDue is greater than 0
        }
      },
    });
    res.status(200).json(pendingInvoices);
  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    res.status(500).json({ error: 'Failed to fetch pending invoices' });
  }
});

// Get completed invoices
app.get('/invoices/completed', async (req, res) => {
  try {
    const completedInvoices = await Invoice.findAll({
      where: {
        isPending: false
      },
    });
    res.status(200).json(completedInvoices);
  } catch (error) {
    console.error('Error fetching completed invoices:', error);
    res.status(500).json({ error: 'Failed to fetch completed invoices' });
  }
});

app.post('/api/generate-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });

    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({ email, otp });
    } else {
      user.otp = otp;
      await user.save();
    }
    const mailOptions = {
      from: process.env.EMAIL_NAME,
      to: email,
      subject: 'Your OTP for Login',
      text: `Your OTP for login is: ${otp}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error generating OTP or sending email:', error);
    res.status(500).json({ error: 'Failed to generate OTP or send email' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ where: { email, otp } });

    if (!user) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    user.email_verified = true;
    user.otp = null;
    await user.save();

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});