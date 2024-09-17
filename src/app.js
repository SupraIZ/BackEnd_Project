import { express } from 'express';
import cors from 'cors'
import cookieParser from 'cookie-parser';


const app = express()

//the options used here for cors are basically of production level.
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"}))

//url based config
app.use(express.urlencoded({extended: true, limit: "16kb"}))

app.use(express.static("public"))
//to access the cookie and set them.
app.use(cookieParser())

export default app