import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "./../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { jwt } from "jsonwebtoken";

// Internal methods
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // the token is generated and saved in the database
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
  //files is used for uploading of multiple files
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
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
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

//Logout user
const logoutUser = asyncHandler(async (req, res) => {
  // logic of middleware needed --!!
  await User.findByIdAndUpdate(req.user._id, {
    $set: { refreshToken: undefined },
  });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User LoggedOut Successfully"));
});
jwt
//when the access token expires then a new access token will be generated.
const refreshAccessToken = asyncHandler(async (req, res) => {
  //storing of token
  const incomingRefreshAccessToken =
    req.cookies.refreshToken /*for web*/ ||
    req.body.refreshToken; /*for mobile*/

  if (!incomingRefreshAccessToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  //verify token
  try {
    const decodedToken = jwt.verify(
      incomingRefreshAccessToken,
      process.env.REFRESH_TOKEN_SCERET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshAccessToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is Expired or Used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token Refreshed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

// change current user password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  //checking if the password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old Password");
  }

  // setting the new password after changing
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

//to get the current user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "Current User Fetched Successfully");
});

//update account details with fullname and email
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!(fullname || email)) {
    throw new ApiError(400, "All Feilds Are Required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details Updated Successfully"));
});

//avatar uppdate
const avatarUserUpdate = asyncHandler(async (req, res) => {
  //use of multer
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar has Updated Successfully"));

});

//cover image update
const coverImageUserUpdate = asyncHandler(async (req, res) => {
  //use of multer
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on Cover Image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image Updated Successfully")); 

});


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  avatarUserUpdate,
  coverImageUserUpdate
};
