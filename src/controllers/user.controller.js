import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTcken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token ")
    }

}

const registerUser = asyncHandler(async (req, res) => {
    const { userName, email, fullName, password } = req.body
    console.log("Email :", email);
    // one work is pending that is check which field is emty
    if ([userName, email, fullName, password].some((field) => field.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }
    const existedUser = await User.findOne({
        $or: [{ email }, { userName }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or userName allredy Exist ")
    }

    console.log(req.files)

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;


    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File is Required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar File is Required")
    }
    const user = await User.create({
        userName: userName.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, "Some thing went wrong while regisaring a User")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    const { userName, email, password } = req.body;
    if (!userName && !email) {
        throw new ApiError(400, "UserName or Password Are Required")
    }
    if (!password) {
        throw new ApiError(400, "Password is Required")
    }


    const user = await User.findOne({ $or: [{ userName }, { email }] })
    if (!user) {
        throw new ApiError(404, "User Does Not Exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User Creditials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTcken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    console.log("User is login successful")

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "user logged in success fuly")
        )


})

const logoutUser = asyncHandler(async (req, res) => {
    const userId = req.user._id

    await User.findByIdAndUpdate(userId,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            returnDocument: "after"
        })

    const options = {
        httpOnly: true,
        secure: true
    }
    console.log("User Logout Successfull")

    return res
        .status(200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json(new ApiResponse(200, {}, "User Loged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const userRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!userRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedRefreshToken = jwt.verify(userRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedRefreshToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }
        console.log("UserRefrshToken :", userRefreshToken, "DataBase Refresh Token :", user?.refreshToken)

        if (decodedRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is Expired or used")
        }

        const { refreshToken, accessToken } = await generateAccessAndRefreshTcken(user._id)

        const options = {
            httpOnly: true,
            secure: true
        }
        res.status(201)
            .cookie("refreshToken", refreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(
                new ApiResponse(201, { refreshToken, accessToken }, "Access token refresh successfull")
            )
    } catch (error) {

        throw new ApiError(401, error?.message || "envalid refresh token")

    }
})
export { registerUser, loginUser, logoutUser, refreshAccessToken }