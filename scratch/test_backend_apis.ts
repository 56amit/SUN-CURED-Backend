import "dotenv/config";

const BASE_URL = "http://localhost:3000/api";

async function runTests() {
  console.log("=== STARTING BACKEND E2E API VERIFICATION ===");
  console.log(`Targeting base URL: ${BASE_URL}\n`);

  try {
    // 1. ADMIN LOGIN TEST
    console.log("1. Testing Admin Login...");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "admin123",
      }),
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.token;
    console.log("✅ Admin Login successful! Token received.");

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // 2. TAX CRUD TEST
    console.log("\n2. Testing Tax CRUD...");
    const createTaxRes = await fetch(`${BASE_URL}/taxes`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test GST 5%",
        rate: 5.0,
        desc: "Temporary test tax slab",
        status: "active",
      }),
    });
    const createdTax = await createTaxRes.json();
    if (!createTaxRes.ok) {
      throw new Error(`Create Tax failed: ${JSON.stringify(createdTax)}`);
    }
    const taxId = createdTax.id;
    console.log(`✅ Tax slab created successfully! ID: ${taxId}`);

    // 3. CATEGORY CRUD TEST
    console.log("\n3. Testing Category CRUD...");
    const createCatRes = await fetch(`${BASE_URL}/categories`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Chips",
        taxId: taxId,
        desc: "Temporary test category",
        status: "active",
      }),
    });
    const createdCat = await createCatRes.json();
    if (!createCatRes.ok) {
      throw new Error(`Create Category failed: ${JSON.stringify(createdCat)}`);
    }
    const catId = createdCat.id;
    console.log(`✅ Category created successfully! ID: ${catId}`);

    // 4. PRODUCT CRUD TEST
    console.log("\n4. Testing Product CRUD...");
    const createProdRes = await fetch(`${BASE_URL}/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Beetroot Crisps",
        catId: catId,
        taxId: taxId,
        desc: "Solar dried organic beetroot crisps",
        price: 199.00,
        weight: "150g",
        img: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        status: "active",
      }),
    });
    const createdProd = await createProdRes.json();
    if (!createProdRes.ok) {
      throw new Error(`Create Product failed: ${JSON.stringify(createdProd)}`);
    }
    const prodId = createdProd.id;
    console.log(`✅ Product created successfully! ID: ${prodId}`);

    // 5. DASHBOARD STATS TEST
    console.log("\n5. Testing Dashboard Stats...");
    const statsRes = await fetch(`${BASE_URL}/dashboard/stats`, {
      method: "GET",
      headers: authHeaders,
    });
    const statsData = await statsRes.json();
    if (!statsRes.ok) {
      throw new Error(`Fetch Stats failed: ${JSON.stringify(statsData)}`);
    }
    console.log("✅ Stats fetched successfully!", {
      totalProducts: statsData.totalProducts,
      activeCategories: statsData.activeCategories,
      activeTaxes: statsData.activeTaxes,
      avgPrice: statsData.avgPrice,
      recentProductsCount: statsData.recentProducts?.length,
    });

    // 6. ORDER PLACEMENT TEST
    console.log("\n6. Testing Order Placement...");
    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // Orders placement can be public
      body: JSON.stringify({
        items: [
          { productId: prodId, quantity: 2 }
        ],
        paymentGateway: "razorpay",
      }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      throw new Error(`Place Order failed: ${JSON.stringify(orderData)}`);
    }
    const orderId = orderData.order.id;
    console.log(`✅ Order placed successfully! ID: ${orderId}, Total Amount: ₹${orderData.order.totalAmount}`);

    // 7. GET ORDERS TEST (ADMIN ONLY)
    console.log("\n7. Testing Admin Fetch Orders...");
    const getOrdersRes = await fetch(`${BASE_URL}/orders`, {
      method: "GET",
      headers: authHeaders,
    });
    const ordersData = await getOrdersRes.json();
    if (!getOrdersRes.ok) {
      throw new Error(`Get Orders failed: ${JSON.stringify(ordersData)}`);
    }
    console.log(`✅ Admin fetched all orders successfully! Total orders: ${ordersData.length}`);

    // 8. UPDATE ORDER STATUS (ADMIN ONLY)
    console.log("\n8. Testing Admin Update Order Status...");
    const updateOrderRes = await fetch(`${BASE_URL}/orders/${orderId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        status: "completed",
        paymentStatus: "paid",
        transactionId: "txn_test_123456",
      }),
    });
    const updatedOrderData = await updateOrderRes.json();
    if (!updateOrderRes.ok) {
      throw new Error(`Update Order failed: ${JSON.stringify(updatedOrderData)}`);
    }
    console.log(`✅ Order status updated successfully to: ${updatedOrderData.status} (Payment: ${updatedOrderData.paymentStatus})`);

    console.log("\n=============================================");
    console.log("🎉 ALL E2E API VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
    console.log("=============================================");
  } catch (error: any) {
    console.error("\n❌ E2E API VERIFICATION TEST FAILED:");
    console.error(error.message);
  }
}

runTests();
