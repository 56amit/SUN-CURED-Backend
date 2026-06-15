import "dotenv/config";
import { sendOrderEmails } from "../src/utils/mailer";

async function runEmailTest() {
  console.log("Starting send email test...");

  const orderId = 12345;
  const totalAmount = 499;
  const customerData = {
    name: "Amit Pandey",
    email:
      process.env.TEST_EMAIL_TO ||
      process.env.ADMIN_EMAIL ||
      "amit760729@gmail.com",
    phone: "7607297771",
    address: "df, sdfdsf, fs, sdf - sfd",
  };
  const itemsCount = 1;

  await sendOrderEmails(orderId, totalAmount, customerData, itemsCount);

  console.log(
    "Send email test finished. Check server logs for success or failure details.",
  );
}

runEmailTest().catch((error) => {
  console.error("Test script error:", error);
  process.exit(1);
});
