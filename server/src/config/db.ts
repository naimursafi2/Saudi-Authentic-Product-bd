import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("strictQuery", true);
// When Atlas is temporarily unavailable, fail an API request immediately
// instead of queueing it for Mongoose's default 10 seconds. The API can then
// return its normal error response while the connection retry loop recovers.
mongoose.set("bufferCommands", false);

let connectionEventsRegistered = false;

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(): Promise<void> {
  if (!connectionEventsRegistered) {
    connectionEventsRegistered = true;
    mongoose.connection.on("connected", () => {
      console.log("MongoDB connected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected");
    });
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
