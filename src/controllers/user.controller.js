import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "./../models/user.model.js";
import { uploadResult } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Internal methods
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    /* while saving this the user model will kick in so, in order to cancel the validation this 
       method is used.*/

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token."
    );
  }
};

// Register User
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend (here using postman).
  const { username, fullname, email, password } = req.body;
  // console.log("email: ", email);

  // validation of given data. - not empty
  // if the request comes from form or json then it can be handled with body

  if (
    [fullname, username, email, password].some((feild) => feild?.trim() === "") //need to explore more about this.
  ) {
    throw new ApiError(400, "All feilds are required");
  }

  // check if user already exists. username, email
  const existedUser = await User.findOne({
    //operators
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists.");
  }

  // check for images, check for avatar
  //should be optionally handled, ? here states 'agar nahi bhi mile to'
  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath; // if coverimage is not provided.
  // scope issues handled 👆
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  // upload them to cloudinary, avatar
  const avatar = await uploadResult(avatarLocalPath);
  const coverImage = await uploadResult(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required.");
  }

  // create user object - create entry in db
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  // remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went Wrong while registering the User.");
  }

  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  // bring data from  user body(req.body)
  const { email, username, password } = req.body;

  // username or email
  if (!(username || email)) {
    throw new ApiError(400, "Username or Email is required");
  }

  // find the user
  // user is the instance here taken from the user model
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist.");
  }

  // password check
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials.");
  }

  // access and refresh token generate
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // optional step- what to send to the user
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // send through cookie's
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User LoggedIN Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // logic of middleware needed --!!
  await User.findByIdAndUpdate(
    req.user._id, 
    {
      $set: {refreshToken: undefined}
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User LoggedOut Successfully"))
});

export { registerUser, loginUser, logoutUser };
