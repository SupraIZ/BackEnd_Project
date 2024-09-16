import dotenv from 'dotenv'
import connectDB from "./db/index.js";


//Approach 1
// import express from "express"
// import connectDB from './db/index';
// const app = express()
// //IIFE approach of call a function (Immediately Invoking Function Expression).
// (async () => {
//     try{
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error", (error) => {
//             console.log("ERR: ", error);
//             throw error
//         })
//         app.listen(process.env.PORT, () => {
//             console.log(`App is listening on port: ${process.env.PORT}`);
//         })
//     } catch (error){
//         console.log("Error: ", error)
//         throw error
//     }
// })();

// Approach 2: The database connection code will be in the db folder and we will just fetch it to run the database here.

dotenv.config({
    path: './env'
})

connectDB()