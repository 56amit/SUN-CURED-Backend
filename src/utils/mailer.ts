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
  totalTaxAmount: number = 0
) => {
  if (!emailUser || !emailPass) {
    console.log(
      "Email credentials not set or invalid in .env, skipping emails.",
    );
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  const itemsSubtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const shippingCharge = itemsSubtotal > 500 ? 0 : 50;

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
            <th style="text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price}</td>
            <td style="text-align:right;">₹${(item.quantity * item.price).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot style="background:#f9f9f9; font-weight:bold;">
          <tr>
            <td colspan="3" style="text-align:right;">Items Subtotal:</td>
            <td style="text-align:right;">₹${items.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right;">Shipping:</td>
            <td style="text-align:right;">${shippingCharge === 0 ? 'Free' : `₹${shippingCharge.toFixed(2)}`}</td>
          </tr>
          <tr style="color: #666; font-size: 0.9em;">
            <td colspan="3" style="text-align:right;">(Includes Taxes):</td>
            <td style="text-align:right;">₹${totalTaxAmount.toFixed(2)}</td>
          </tr>
          <tr style="background:#e8f5e9; font-size:1.1em;">
            <td colspan="3" style="text-align:right;">Grand Total:</td>
            <td style="text-align:right;">₹${totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
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
      
      <div style="background-color: #fdfaf1; padding: 20px; border-radius: 12px; margin: 25px 0; border-left: 5px solid #2d5016;">
        <h3 style="color: #2d5016; margin-top: 0; font-size: 1.4em;">Itadakimasu [いただきます]</h3>
        <p style="font-style: italic; color: #555; font-size: 1.1em; margin-bottom: 10px;">"I humbly receive."</p>
        <p style="color: #444; font-size: 0.95em; line-height: 1.6; margin: 0;">
          Our motto is <strong>Sun, Soil and Sustainability</strong>. 
          Every bite of our food carries a deep gratitude—to the sun that shined, the farmers who cared, the soil that nurtured, and the journey that brought it to your table. 
          <br><br>
          <em>Itadakimasu is more than words; it is gratitude, respect and a promise to value every bite. Good for you, Good for nature.</em> 🌱
        </p>
      </div>

      <h3>Your Items:</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <thead style="background:#f0f0f0;">
          <tr>
            <th style="text-align:left;">Product Name</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price (each)</th>
            <th style="text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price}</td>
            <td style="text-align:right;">₹${(item.quantity * item.price).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot style="background:#f9f9f9; font-weight:bold;">
          <tr>
            <td colspan="3" style="text-align:right;">Items Subtotal:</td>
            <td style="text-align:right;">₹${items.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align:right;">Shipping:</td>
            <td style="text-align:right;">${shippingCharge === 0 ? 'Free' : `₹${shippingCharge.toFixed(2)}`}</td>
          </tr>
          <tr style="background:#e8f5e9; font-size:1.1em;">
            <td colspan="3" style="text-align:right;">Grand Total:</td>
            <td style="text-align:right;">₹${totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <br/>
      <p><strong>Order ID:</strong> #${orderId}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount} (incl. ${shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`} shipping)</p>
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
