import mongoose from "mongoose";
import { DatabaseName } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}${DatabaseName}`)
        console.log(`MongoDB Connected !! DB HOST :${connectionInstance.connection.host}`)


    } catch (error) {
        console.log(`Feail to connect Database ${error}`)
        process.exit(1)
    }

}

export default connectDB