import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { limiter } from "./middlewares/rateLimiter";
import { check } from "./middlewares/check";
import { Request, Response } from "express";
import authRouter from "./routes/v1/auth";
import healthRouter from "./routes/v1/health";
import userRouter from "./routes/v1/admin/user";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
const app = express();

var whitelist = ["http://example1.com", "http://localhost:5173"];
var corsOptions = {
  origin: function (
    origin: any,
    callback: (err: Error | null, origin?: any) => void
  ) {
    // Allow requests with no origin ( like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies or authorization header
};

app
  .use(morgan("dev"))
  .use(express.json())
  .use(cookieParser())
  .use(express.urlencoded({ extended: true }))
  .use(cors(corsOptions))
  .use(helmet())
  .use(compression())
  .use(limiter);

i18next.use(Backend).use(middleware.LanguageDetector).init({});

app.use("/api/v1", healthRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1/admin", userRouter);

app.use((error: any, req: Request, res: Response, next: any) => {
  const status = error.status || 500;
  const message = error.message || "Something went wrong";
  const errorCode = error.code || "INTERNAL_SERVER_ERROR";
  res.status(status).json({ message, error: errorCode });
});

export default app;
