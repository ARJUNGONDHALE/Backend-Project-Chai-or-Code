import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

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

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploding avatar on claudinary")
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

        if (userRefreshToken !== user?.refreshToken) {
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

const changeUserPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
        throw new ApiError(401, "Old password and new password are required")
    }

    const user = await User.findById(req.user?._id)
    if (!user) {
        throw new ApiError(400, "User not found")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    console.log("Password is updated sucseefull")

    res.status(200)
        .json(
            new ApiResponse(200, {}, "Password is Change sucsess full")
        )

})

const getCurrentUser = asyncHandler(async (req, res) => {
    res.status(200)
        .json(
            new ApiResponse(200, req.user, "current user Fetch successfull")
        )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    if (!fullName || !email) {
        throw new ApiError(400, "All field are required ..")
    }

    const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id }
    })

    if (existingUser) {
        throw new ApiError(409, "Email is already in use")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    ).select("-password -refreshToken")
    console.log("Update Account Details ")

    return res.status(200)
        .json(new ApiResponse(200, user, "Account Detail Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required ..")
    }

    // Delete avatar on claudinary this is pending 

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar?.url) {
        throw new ApiError(500, "Error while uploding on avatar in claudinary")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    ).select("-password -refreshToken")

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    console.log("Avatar is updated sucssesfully :", avatar.url)

    return res.status(200)
        .json(
            new ApiResponse(200, user, "Avatar image is Updated success fully")
        )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage Are Required")
    }
    // Delete cover image  on claudinary this is pending 

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(409, "Error while uploding on coverimage in claudinary")
    }
    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,

            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    ).select("-password -refreshToken")

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    console.log("Cover image is updated successfully :", coverImage.url)

    return res.status(200)
        .json(
            new ApiResponse(200, user, "cover image is Updated success fully")
        )
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params

    if (!userName.trim()) {
        throw new ApiError(400, "UserName Is Missing")
    }
    const channel = await User.aggregate([
        {
            $match: { userName: userName?.toLowerCase() }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        }
        ,
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                userName: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])
    if (!channel?.length) {
        throw new ApiError(404, "Channel Does not Exists")

    }
    console.log(channel)

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "user Channel fetched Successfully")
        )
})


const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        userName: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetch successfully"))
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}