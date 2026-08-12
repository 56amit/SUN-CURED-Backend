import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const emailUser = process.env.EMAIL_USER?.trim();
const emailPass = process.env.EMAIL_PASS?.trim().replace(/\s+/g, "");

// SMTP Transporter configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // must be false for port 587
  auth: {
    user: emailUser,
    pass: emailPass, // Gmail App Password
  },
});

transporter
  .verify()
  .then(() => {
    console.log("Mail transporter verified and ready to send emails.");
  })
  .catch((verifyError) => {
    console.warn("Mail transporter verification failed:", verifyError);
  });

export const sendOrderEmails = async (
  orderId: number,
  totalAmount: number,
  customerData: { name: string; email: string; phone: string; address: string },
  items: { productName: string; quantity: number; price: number }[],
) => {
  if (!emailUser || !emailPass) {
    console.log(
      "Email credentials not set or invalid in .env, skipping emails.",
    );
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  // 1. Send Email to Admin
  const adminMailOptions = {
    from: `"Sun-Cured Orders" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `New Order Received! #${orderId}`,
    html: `
      <h2>New Order Alert 🚀</h2>
      <p>A new order has been placed on Sun-Cured Savories.</p>
      <h3>Order Details:</h3>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Total Amount:</strong> ₹${totalAmount}</li>
        <li><strong>Total Items:</strong> ${items.length}</li>
      </ul>
      <h3>Products Ordered:</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <thead style="background:#f0f0f0;">
          <tr>
            <th style="text-align:left;">Product Name</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price (each)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <h3>Customer Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${customerData.name}</li>
        <li><strong>Email:</strong> ${customerData.email}</li>
        <li><strong>Phone:</strong> ${customerData.phone}</li>
        <li><strong>Shipping Address:</strong> ${customerData.address}</li>
      </ul>
    `,
  };

  // 2. Send Thank You Email to Customer
  const customerMailOptions = {
    from: `"Sun-Cured Savories" <${process.env.EMAIL_USER}>`,
    to: customerData.email,
    subject: `Order Confirmed! #${orderId} - Sun-Cured Savories`,
    html: `
      <h2>Thank You for Your Order, ${customerData.name}! 🌿</h2>
      <p>We have successfully received your order and are getting it ready for dispatch.</p>
      <h3>Your Items:</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <thead style="background:#f0f0f0;">
          <tr>
            <th style="text-align:left;">Product Name</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price (each)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <br/>
      <p><strong>Order ID:</strong> #${orderId}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount} (incl. ₹40 shipping)</p>
      <p><strong>Shipping Address:</strong><br/>${customerData.address}</p>
      <p>We will notify you once your healthy treats are shipped.</p>
      <br/>
      <p>Warm Regards,<br/><strong>Team Sun-Cured Savories</strong></p>
    `,
  };

  try {
    // Send both emails concurrently
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(customerMailOptions),
    ]);
    console.log(`Emails successfully sent for Order #${orderId}`);
  } catch (error) {
    console.error("Error sending order emails:", error);
  }
};
