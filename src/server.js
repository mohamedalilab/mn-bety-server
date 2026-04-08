import { env } from "./config/env.js";
import connectDB, { disconnectDB } from "./DB/connection.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import createApp from "./app.js";
// import { initSocket } from "./config/socket.js";
import { verifyEmailTransporter } from "./services/email/email.service.js";

// server instance
let server;

// GRACEFUL SHUTDOWN
// called by OS signals (SIGTERM, SIGINT)
// stops accepting new requests, finishes current ones, then exits
const shutdown = (signal) => {
  console.warn(`${signal} received — starting graceful shutdown...`);

  // check if server exist
  if (!server) {
    console.error("Server is not running");
    process.exit(1);
  }

  // handle close server
  server.close(async () => {
    try {
      console.info("HTTP server closed");
      // Close external connections with any services and DB
      await disconnectRedis();
      await disconnectDB();
      console.info("All requests finished");
      console.info('All connections closed — server shutdown complete')
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });

  // Safety net — if requests hang and server.close() never finishes,
  // force kill after 10 seconds to avoid hanging forever
  setTimeout(() => {
    console.error("Graceful shutdown timed out — forcing exit");
    process.exit(1); // 1 = failure, forced exit
  }, env.SHUTDOWN_TIMEOUT);
};

// OS SIGNALS
// host sends these when stopping the server
// SIGTERM → planned stop (deploy, restart, scale)
// SIGINT  → ctrl+c in local terminal
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// UNHANDLED ERRORS
// bugs you missed — no try/catch, no .catch() on a promise
// log clearly so you can find the exact file + line in logs
// then exit so the host restarts with clean state
// never let the server keep running with a bug in unknown state
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION — server will restart", {
    message: error.message,
    stack: error.stack, // exact file + line number
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION — server will restart", {
    reason,
  });
  process.exit(1);
});

// STARTSERVER
const startServer = async () => {
  // 1. connect DB first - routes need DB to work
  await connectDB();
  // 2. create app - registers middleware and routes
  await connectRedis();
  // 3. verify email transporter
  await verifyEmailTransporter();
  // 4. Create app
  const app = createApp();
  // 5. Start HTTP server
  server = app.listen(env.PORT, () => {
    console.log(`server running on port: ${env.PORT}`);
    console.log(server.address());
  });

  // initSocket(server);
};

export default startServer;