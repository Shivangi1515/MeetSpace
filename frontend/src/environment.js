const server = process.env.NODE_ENV === "production" 
  ? "https://meetspace-backend.onrender.com" 
  : "http://localhost:8000";

export default server;