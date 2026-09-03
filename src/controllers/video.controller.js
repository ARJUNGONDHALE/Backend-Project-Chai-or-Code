import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.models.js"
// import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "views",
        sortType = "dsc",
        userId
    } = req.query
    //TODO: get all videos based on query, sort, pagination
    const matchStage = {
        isPublished: true
    }
    //Search 
    // query="cricket"

    if (query) {
        matchStage.$or = [
            {
                title: {
                    $regex: query, //Find text that matches "Cricket" inside this field.
                    $options: "i"  //The "i" means case-insensitive.
                }
            },
            {
                description: {
                    $regex: query,
                    $options: "i"
                }
            }
        ]
    }

    // Filter videos by a particular user
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid User Id")
        }
        matchStage.owner = new mongoose.Types.ObjectId(userId)
    }

    const sortStage = {
        [sortBy]: sortType === "asc" ? 1 : -1
    }

    const aggregate = Video.aggregate([
        {
            $match: matchStage
        },
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
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $sort: sortStage
        }
    ])

    const videos = await Video.aggregatePaginate(aggregate, {
        page: Number(page),//page ="3"
        limit: Number(limit)
    })

    console.log("All videos of the User : ", userId, "fetch Successfull")
    console.log(videos)

    return res.status(200)
        .json(
            new ApiResponse(200, videos, "Videos fetched Successsfully ")
        )




})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    if (!title || !description) {
        throw new ApiError(400, "title and Description are requred..")
    }
    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalpath = req.files?.thumbnail?.[0]?.path
    if (!videoLocalPath) {
        throw new ApiError(400, "Video File are requred")
    }
    if (!thumbnailLocalpath) {
        throw new ApiError(400, "Thumbnail  File are requred")
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalpath)

    if (!videoFile.secure_url) {
        throw new ApiError(400, "Error while uploading Video in cloudinary")
    }
    if (!thumbnail.secure_url) {
        throw new ApiError(400, "Error while uploading Thumbnail in cloudinary")
    }

    const video = await Video.create({
        videoFile: videoFile.secure_url,
        thumbnail: thumbnail.secure_url,
        title: title,
        description: description,
        duration: videoFile.duration,
        owner: req.user?._id
    })

    console.log("Created Video:", video)

    return res.status(200)
        .json(
            new ApiResponse(200, { video }, "Vedio uplode Successfully")
        )

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!videoId) {
        throw new ApiError(400, "Video Id Is Missing ")
    }
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video Id")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video dosent Exist")
    }

    if (!video.isPublished) {
        if (!video.owner.equels(req.user?._id)) {
            throw new ApiError(404, " Video not found ")

        }
    }

    return res.status(200)
        .json(
            new ApiResponse(200, { video }, "Video Found Successfully")
        )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}