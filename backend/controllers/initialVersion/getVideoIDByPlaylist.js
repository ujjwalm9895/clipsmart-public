const { google } = require('googleapis');
const youtube = google.youtube('v3');

const extractVideoIdFromFallback = (fallbackValue) => {
    if (!fallbackValue) return null;
    if (fallbackValue.length === 11) return fallbackValue;
    return null;
};

const getVideoIDByPlaylist = async (req, res) => {
    try {
        const { playlistId } = req.params;
        console.log("Fetching playlist:", playlistId);

        if (!process.env.YOUTUBE_API_KEY) {
            return res.status(400).json({
                message: "YouTube API key is not configured",
                status: false
            });
        }

        const uniqueVideoIds = new Set();
        let nextPageToken = null;
        let pageCount = 0;
        const MAX_PAGES = 5;

        do {
            if (pageCount >= MAX_PAGES) {
                console.log(`Reached maximum page limit (${MAX_PAGES})`);
                break;
            }

            const response = await youtube.playlistItems.list({
                key: process.env.YOUTUBE_API_KEY,
                part: 'contentDetails',
                playlistId: playlistId,
                maxResults: 50,
                pageToken: nextPageToken
            });

            if (!response.data.items || response.data.items.length === 0) {
                break;
            }

            response.data.items.forEach(item => {
                uniqueVideoIds.add(item.contentDetails.videoId);
            });

            nextPageToken = response.data.nextPageToken;
            pageCount++;

            console.log(`Fetched page ${pageCount}, unique videos: ${uniqueVideoIds.size}`);
        } while (nextPageToken);

        const videoIds = Array.from(uniqueVideoIds);

        // ✅ If playlist is empty (like RD... auto playlists), try extracting videoId directly
        if (videoIds.length === 0) {
            console.warn("No videos found, trying to fallback to video ID...");

            const fallbackVideoId = extractVideoIdFromFallback(playlistId);
            if (fallbackVideoId) {
                return res.status(200).json({
                    message: "Playlist not found. Fallback to direct video ID from input.",
                    data: {
                        totalVideos: 1,
                        videoIds: [fallbackVideoId]
                    },
                    status: true
                });
            }

            return res.status(404).json({
                message: "No videos found and fallback video ID is invalid.",
                status: false
            });
        }

        return res.status(200).json({
            message: `Successfully fetched ${videoIds.length} unique video IDs from playlist`,
            data: {
                totalVideos: videoIds.length,
                videoIds: videoIds
            },
            status: true
        });
    }
    catch (error) {
        console.error("Playlist fetch error:", error);

        // 👇 Try fallback here too
        const fallbackVideoId = extractVideoIdFromFallback(req.params.playlistId);
        if (fallbackVideoId) {
            return res.status(200).json({
                message: "Error fetching playlist. Fallback to direct video ID from input.",
                data: {
                    totalVideos: 1,
                    videoIds: [fallbackVideoId]
                },
                status: true
            });
        }

        if (error.code === 403) {
            return res.status(403).json({
                message: "YouTube API quota exceeded. Please try again later.",
                status: false
            });
        }

        return res.status(500).json({
            message: "Failed to fetch playlist videos",
            error: error.message,
            status: false
        });
    }
};

module.exports = getVideoIDByPlaylist;
