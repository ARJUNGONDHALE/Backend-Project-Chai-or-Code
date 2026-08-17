import { app } from "./app.js";
import connectDB from "./db/index.js";
import dotenv from "dotenv"

dotenv.config()
connectDB().then(() => {
    const port = process.env.PORT || 8000
    app.on("error", (error) => {
        console.log("ERROR :", error);
        throw error

    })
    app.listen(port, () => {
        console.log(`App is listen From Port ${port} `)
    })

}).catch((err) => {
    console.log("MONGODB connection Faile ...!! ", err)

})