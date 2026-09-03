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
    // TODO: get video, upload to cloudinary, create video
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
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