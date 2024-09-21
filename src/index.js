import dotenv from "dotenv";
import connectDB from "./db/index.js";
import {app} from "./app.js"

dotenv.config({
  path: "./env",
});

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is Running at port: ${process.env.PORT}`);
    })
  })
  .catch((err) => {
    console.log("MongoDB Connection Failed.", err);
  });

//Approach 1
// import connectDB from './db/index';
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

