import jwt from "jsonwebtoken";

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluIiwiaWF0IjoxNzgwODc0ODc5LCJleHAiOjE4MDk2MzQ4Nzl9.c2I8_7V_6CU38GFEjJa9zNGbTMvOLse1lKV6kWR_NkA";

console.log("Token to verify:", token);

// Verify with default_secret_key
try {
  const decoded = jwt.verify(token, "default_secret_key");
  console.log("✅ Verified with 'default_secret_key'!");
  console.log("Decoded:", decoded);
} catch (err: any) {
  console.log("❌ Failed with 'default_secret_key':", err.message);
}

// Verify with super_secret_jwt_key
try {
  const decoded = jwt.verify(token, "super_secret_jwt_key");
  console.log("✅ Verified with 'super_secret_jwt_key'!");
  console.log("Decoded:", decoded);
} catch (err: any) {
  console.log("❌ Failed with 'super_secret_jwt_key':", err.message);
}
