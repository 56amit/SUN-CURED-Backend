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

  const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "suncuredsavories@gmail.com").trim();

  const itemsSubtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const shippingCharge = itemsSubtotal > 500 ? 0 : 50;

  // 1. Send Email to Admin
  const adminMailOptions = {
    from: `"Sun-Cured Orders" <${emailUser}>`,
    to: adminEmail,
    replyTo: customerData.email,
    subject: `🚨 NEW ORDER RECEIVED #${orderId} - ₹${totalAmount}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #2d5016; border-bottom: 2px solid #2d5016; padding-bottom: 8px;">🚀 New Order Alert #${orderId}</h2>
        <p>A new order has been placed on Sun-Cured Savories website.</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #2d5016;">Order Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 4px 0;"><strong>Order ID:</strong> #${orderId}</li>
            <li style="padding: 4px 0;"><strong>Grand Total:</strong> ₹${totalAmount.toFixed(2)}</li>
            <li style="padding: 4px 0;"><strong>Total Items:</strong> ${items.length}</li>
          </ul>
        </div>

        <h3 style="color: #2d5016;">Products Ordered:</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; font-size: 0.95em;">
          <thead style="background:#2d5016; color: white;">
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
              <td style="text-align:right;">₹${itemsSubtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="3" style="text-align:right;">Shipping:</td>
              <td style="text-align:right;">${shippingCharge === 0 ? 'Free' : `₹${shippingCharge.toFixed(2)}`}</td>
            </tr>
            <tr style="color: #666; font-size: 0.9em;">
              <td colspan="3" style="text-align:right;">(Includes Taxes):</td>
              <td style="text-align:right;">₹${totalTaxAmount.toFixed(2)}</td>
            </tr>
            <tr style="background:#e8f5e9; font-size:1.1em; color: #2d5016;">
              <td colspan="3" style="text-align:right;">Grand Total:</td>
              <td style="text-align:right;">₹${totalAmount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background: #fdfaf1; border-left: 4px solid #c88d22; padding: 15px; border-radius: 8px; margin-top: 25px;">
          <h3 style="margin-top:0; color: #2d5016;">Customer Details:</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${customerData.name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${customerData.email}">${customerData.email}</a></p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${customerData.phone}">${customerData.phone}</a></p>
          <p style="margin: 5px 0;"><strong>Shipping Address:</strong><br/>${customerData.address}</p>
        </div>
      </div>
    `,
  };

  // 2. Send Thank You Email to Customer
  const customerMailOptions = {
    from: `"Sun-Cured Savories" <${emailUser}>`,
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
      <br/>
      <p><strong>Order ID:</strong> #${orderId}</p>
      <p><strong>Total Amount:</strong> ₹${totalAmount} (incl. ${shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`} shipping)</p>
      <p><strong>Shipping Address:</strong><br/>${customerData.address}</p>
      <p>We will notify you once your healthy treats are shipped. 🚚</p>

      <!-- View Orders Button -->
      <div style="text-align:center; margin: 30px 0;">
        <a href="https://sun-cured-savories.vercel.app" 
           style="background-color:#2d5016; color:#ffffff; padding:14px 32px; border-radius:30px; text-decoration:none; font-weight:bold; font-size:1rem; display:inline-block;">
          🌿 View My Orders
        </a>
      </div>

      <p style="font-size:0.85em; color:#888; text-align:center;">
        Questions? Reply to this email or call us at <strong>+91 87964 46551</strong>
      </p>
      <br/>
      <p>Warm Regards,<br/><strong>Team Sun-Cured Savories</strong></p>
      <hr style="border:none; border-top:1px solid #eee; margin: 20px 0;"/>
      <table style="width:100%; font-size:0.78rem; color:#999;" cellpadding="0" cellspacing="0">
        <tr>
          <td><strong style="color:#555;">Sun Cured Savories</strong></td>
        </tr>
        <tr><td>Plot no. 73, Shiva Enclave, Part-1, Garhi Harsaru, Gurgaon - 122052, Haryana</td></tr>
        <tr><td style="padding-top:6px;">GST No: 06CTQPP8584H1ZS | PAN: CTQPP8584H | FSSAI: 12726998000058</td></tr>
        <tr><td>📧 suncuredsavories@gmail.com | 📞 +91 87964 46551</td></tr>
      </table>
    `,
  };

  // Send admin email
  try {
    const adminRes = await transporter.sendMail(adminMailOptions);
    console.log(`Admin email sent successfully to ${adminEmail} for Order #${orderId}, messageId: ${adminRes.messageId}`);
  } catch (adminError) {
    console.error(`Failed to send Admin email to ${adminEmail} for Order #${orderId}:`, adminError);
  }

  // Send customer email
  try {
    const customerRes = await transporter.sendMail(customerMailOptions);
    console.log(`Customer email sent successfully to ${customerData.email} for Order #${orderId}, messageId: ${customerRes.messageId}`);
  } catch (customerError) {
    console.error(`Failed to send Customer email to ${customerData.email} for Order #${orderId}:`, customerError);
  }
};
