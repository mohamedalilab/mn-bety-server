import dotenv from "dotenv";

dotenv.config();

export const env = {
  // Application
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 4000,
  SHUTDOWN_TIMEOUT: parseInt(process.env.SHUTDOWN_TIMEOUT) || 15_000,

  // Frontend
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  ADMIN_URL: process.env.ADMIN_URL || "http://localhost:3000",

  // Database
  DATABASE_URI: process.env.DATABASE_URI,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  REDIS_RETRIES: parseInt(process.env.REDIS_RETRIES) || 3,
  REDIS_DELAY: parseInt(process.env.REDIS_DELAY) || 1000,

  // AUTH
  AUTH: {
    RESET_PASSWORD_EXPIRE: process.env.RESET_PASSWORD_EXPIRE || "15m",
    EMAIL_VERIFICATION_EXPIRE: process.env.EMAIL_VERIFICATION_EXPIRE || "24h",
  },

  // JWT
  JWT: {
    SECRET_ACCESS: process.env.JWT_SECRET_ACCESS,
    SECRET_REFRESH: process.env.JWT_SECRET_REFRESH,
    ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || "15m",
    REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "7d",
  },

  // hashing
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // Cookies
  COOKIE: {
    REFRESH_MAX_AGE:
      parseInt(process.env.COOKIE_REFRESH_MAX_AGE) || 7 * 24 * 60 * 60 * 1000,
    HTTP_ONLY: process.env.COOKIE_HTTP_ONLY === "true",
    SECURE: process.env.COOKIE_SECURE === "true",
    SAME_SITE: process.env.COOKIE_SAME_SITE || "lax",
  },

  // Email
  EMAIL: {
    HOST: process.env.EMAIL_HOST,
    PORT: process.env.EMAIL_PORT,
    SECURE: process.env.EMAIL_SECURE === "true",
    USER: process.env.EMAIL_USER,
    PASSWORD: process.env.EMAIL_PASSWORD,
    FROM: process.env.EMAIL_FROM,
    TLS_REJECT_UNAUTHORIZED:
      process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false",
  },

  // Cloudinary
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET,
  },

  // Stripe
  STRIPE: {
    SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Development flags
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
};
