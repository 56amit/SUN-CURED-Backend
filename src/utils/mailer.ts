import nodemailer from "nodemailer";
import "dotenv/config";

// SMTP Transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

export const sendOrderEmails = async (
  orderId: number,
  totalAmount: number,
  customerData: { name: string; email: string; phone: string; address: string },
  itemsCount: number
) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email credentials not set in .env, skipping emails.");
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
        <li><strong>Total Items:</strong> ${itemsCount}</li>
      </ul>
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
      <h3>Order Summary:</h3>
      <ul>
        <li><strong>Order ID:</strong> ${orderId}</li>
        <li><strong>Total Amount:</strong> ₹${totalAmount}</li>
      </ul>
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
