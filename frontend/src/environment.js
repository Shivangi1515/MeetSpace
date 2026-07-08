const server = process.env.NODE_ENV === "production" 
  ? "https://meetspace-backend-75x5.onrender.com" 
  : "http://localhost:8000";

export default server;