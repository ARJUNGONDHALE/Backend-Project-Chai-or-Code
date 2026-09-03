import express, { json } from 'express'
import cors from "cors"
import cookieParser from 'cookie-parser';


const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({ limit: "20kb" }))
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())

//Routes import
import { router as userRouter } from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"

//Route Declaration         
app.use("/api/v1/users", userRouter)
app.use("/api/v1/videos", videoRouter)


export { app }