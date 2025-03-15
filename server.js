const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/photo-uploads", express.static(path.join(__dirname, "photo-uploads")));

// Email Credentials (from environment variables)
const mail = process.env.EMAIL;
const password = process.env.EMAIL_PASSWORD;

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: mail, pass: password },
});

transporter.verify((error) => {
    if (error) console.log(error);
    else console.log("Mail Server is Ready");
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB Connection Error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Allowed Emails
const allowedEmails = [
    "hazrataliein@gmail.com",
    "programmer.hazratali@gmail.com",
    "iushazratali@gmail.com",
    "hazratalisoft@gmail.com",
];

// Multer Storage Configuration for Videos
const VideoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

// Multer Storage Configuration for Photos
const PhotosStorage = multer.diskStorage({
    destination: "./photo-uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

// File Filter for Multer
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["video/mp4", "audio/mpeg", "audio/mp3", "image/jpeg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type!"), false);
    }
};

const upload = multer({ storage: VideoStorage, fileFilter });
const photoUpload = multer({ storage: PhotosStorage, fileFilter });

// Mongoose Schemas
const videoSchema = new mongoose.Schema({
    title: String,
    filename: String,
    uploadedBy: String,
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
});

const commentSchema = new mongoose.Schema({
    text: String,
    userEmail: String,
    userName: String, // Add this line
    videoId: mongoose.Schema.Types.ObjectId,
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Reply" }],
});

const replySchema = new mongoose.Schema({
    text: String,
    userEmail: String,
    userName: String, // Add this line
    commentId: mongoose.Schema.Types.ObjectId,
});

const Video = mongoose.model("Video", videoSchema);
const Comment = mongoose.model("Comment", commentSchema);
const Reply = mongoose.model("Reply", replySchema);


// Photo Schema
const photoSchema = new mongoose.Schema({
    title: String,
    image: String,
    userEmail: String,
    uploadedAt: { type: Date, default: Date.now },
});
const Photo = mongoose.model("Photo", photoSchema);

// Routes

// Get All Videos
app.get("/videos", async (req, res) => {
    try {
        const videos = await Video.find().populate({
            path: "comments",
            populate: {
                path: "replies", // Populate replies for each comment
            },
        });
        res.status(200).json({ success: true, data: videos });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Upload Video
app.post("/videos", upload.single("video"), async (req, res) => {
    const { title, userEmail } = req.body;
    if (!allowedEmails.includes(userEmail))
        return res.status(403).json({ success: false, message: "Permission denied!" });

    try {
        const newVideo = new Video({ title, filename: req.file.filename, uploadedBy: userEmail });
        await newVideo.save();
        res.status(201).json({ success: true, message: "Video uploaded successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to upload video!" });
    }
});

// Delete Video
app.delete("/videos/:id", async (req, res) => {
    const { userEmail } = req.body;
    if (!allowedEmails.includes(userEmail))
        return res.status(403).json({ success: false, message: "Permission denied!" });

    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ success: false, message: "Video not found!" });

        const filePath = `uploads/${video.filename}`;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Video.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Video deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete video!" });
    }
});

// Add Comment
app.post("/videos/:videoId/comments", async (req, res) => {
    const { text, userEmail, userName } = req.body; // Add userName
    const videoId = req.params.videoId;

    try {
        const newComment = new Comment({ text, userEmail, userName, videoId }); // Add userName
        await newComment.save();

        const video = await Video.findById(videoId);
        video.comments.push(newComment._id);
        await video.save();

        res.status(201).json({ success: true, message: "Comment added successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add comment!" });
    }
});

// Edit Comment
app.put("/videos/:videoId/comments/:commentId", async (req, res) => {
    const { text, userEmail } = req.body;
    const { videoId, commentId } = req.params;

    try {
        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

        if (comment.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        comment.text = text;
        await comment.save();

        res.status(200).json({ success: true, message: "Comment updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update comment!" });
    }
});

// Delete Comment
app.delete("/videos/:videoId/comments/:commentId", async (req, res) => {
    const { userEmail } = req.body;
    const { videoId, commentId } = req.params;

    try {
        const comment = await Comment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

        if (comment.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        await Comment.findByIdAndDelete(commentId);

        const video = await Video.findById(videoId);
        video.comments = video.comments.filter((id) => id.toString() !== commentId);
        await video.save();

        res.status(200).json({ success: true, message: "Comment deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete comment!" });
    }
});

// Add Reply
app.post("/videos/:videoId/comments/:commentId/replies", async (req, res) => {
    const { text, userEmail, userName } = req.body; // Add userName
    const { videoId, commentId } = req.params;

    try {
        const newReply = new Reply({ text, userEmail, userName, commentId }); // Add userName
        await newReply.save();

        const comment = await Comment.findById(commentId);
        comment.replies.push(newReply._id);
        await comment.save();

        res.status(201).json({ success: true, message: "Reply added successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add reply!" });
    }
});

// Edit Reply
app.put("/videos/:videoId/comments/:commentId/replies/:replyId", async (req, res) => {
    const { text, userEmail } = req.body;
    const { videoId, commentId, replyId } = req.params;

    try {
        const reply = await Reply.findById(replyId);
        if (!reply) return res.status(404).json({ success: false, message: "Reply not found!" });

        if (reply.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        reply.text = text;
        await reply.save();

        res.status(200).json({ success: true, message: "Reply updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update reply!" });
    }
});

// Delete Reply
app.delete("/videos/:videoId/comments/:commentId/replies/:replyId", async (req, res) => {
    const { userEmail } = req.body;
    const { videoId, commentId, replyId } = req.params;

    try {
        const reply = await Reply.findById(replyId);
        if (!reply) return res.status(404).json({ success: false, message: "Reply not found!" });

        if (reply.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        await Reply.findByIdAndDelete(replyId);

        const comment = await Comment.findById(commentId);
        comment.replies = comment.replies.filter((id) => id.toString() !== replyId);
        await comment.save();

        res.status(200).json({ success: true, message: "Reply deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete reply!" });
    }
});
// Get All Audios

// Multer Storage Configuration for Audios
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

// File Filter for Multer
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = ["audio/mpeg", "audio/wav"];
//     if (allowedTypes.includes(file.mimetype)) {
//         cb(null, true);
//     } else {
//         cb(new Error("Invalid file type!"), false);
//     }
// };

const audioUpload = multer({ storage: audioStorage, fileFilter });

// Mongoose Schemas
const audioSchema = new mongoose.Schema({
    title: String,
    filename: String,
    uploadedBy: String,
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "AudioComment" }], // Unique ref
});

const audioCommentSchema = new mongoose.Schema({
    text: String,
    userEmail: String,
    userName: String,
    audioId: mongoose.Schema.Types.ObjectId,
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: "AudioReply" }], // Unique ref
});

const audioReplySchema = new mongoose.Schema({
    text: String,
    userEmail: String,
    userName: String,
    commentId: mongoose.Schema.Types.ObjectId,
});

const Audio = mongoose.model("Audio", audioSchema);
const AudioComment = mongoose.model("AudioComment", audioCommentSchema);
const AudioReply = mongoose.model("AudioReply", audioReplySchema);

// Routes

// Get All Audios
app.get("/audios", async (req, res) => {
    try {
        const audios = await Audio.find().populate({
            path: "comments",
            populate: {
                path: "replies", // Populate replies for each comment
            },
        });
        res.status(200).json({ success: true, data: audios });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Upload Audio
app.post("/audios", audioUpload.single("audio"), async (req, res) => {
    const { title, userEmail } = req.body;
    if (!allowedEmails.includes(userEmail))
        return res.status(403).json({ success: false, message: "Permission denied!" });

    try {
        const newAudio = new Audio({ title, filename: req.file.filename, uploadedBy: userEmail });
        await newAudio.save();
        res.status(201).json({ success: true, message: "Audio uploaded successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to upload audio!" });
    }
});

// Delete Audio
app.delete("/audios/:id", async (req, res) => {
    const { userEmail } = req.body;
    if (!allowedEmails.includes(userEmail))
        return res.status(403).json({ success: false, message: "Permission denied!" });

    try {
        const audio = await Audio.findById(req.params.id);
        if (!audio) return res.status(404).json({ success: false, message: "Audio not found!" });

        const filePath = `uploads/${audio.filename}`;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Audio.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Audio deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete audio!" });
    }
});

// Add Comment
app.post("/audios/:audioId/comments", async (req, res) => {
    const { text, userEmail, userName } = req.body;
    const audioId = req.params.audioId;

    try {
        const newComment = new AudioComment({ text, userEmail, userName, audioId });
        await newComment.save();

        const audio = await Audio.findById(audioId);
        audio.comments.push(newComment._id);
        await audio.save();

        res.status(201).json({ success: true, message: "Comment added successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add comment!" });
    }
});

// Edit Comment
app.put("/audios/:audioId/comments/:commentId", async (req, res) => {
    const { text, userEmail } = req.body;
    const { audioId, commentId } = req.params;

    try {
        const comment = await AudioComment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

        if (comment.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        comment.text = text;
        await comment.save();

        res.status(200).json({ success: true, message: "Comment updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update comment!" });
    }
});

// Delete Comment
app.delete("/audios/:audioId/comments/:commentId", async (req, res) => {
    const { userEmail } = req.body;
    const { audioId, commentId } = req.params;

    try {
        const comment = await AudioComment.findById(commentId);
        if (!comment) return res.status(404).json({ success: false, message: "Comment not found!" });

        if (comment.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        await AudioComment.findByIdAndDelete(commentId);

        const audio = await Audio.findById(audioId);
        audio.comments = audio.comments.filter((id) => id.toString() !== commentId);
        await audio.save();

        res.status(200).json({ success: true, message: "Comment deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete comment!" });
    }
});

// Add Reply
app.post("/audios/:audioId/comments/:commentId/replies", async (req, res) => {
    const { text, userEmail, userName } = req.body;
    const { audioId, commentId } = req.params;

    try {
        const newReply = new AudioReply({ text, userEmail, userName, commentId });
        await newReply.save();

        const comment = await AudioComment.findById(commentId);
        comment.replies.push(newReply._id);
        await comment.save();

        res.status(201).json({ success: true, message: "Reply added successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add reply!" });
    }
});

// Edit Reply
app.put("/audios/:audioId/comments/:commentId/replies/:replyId", async (req, res) => {
    const { text, userEmail } = req.body;
    const { audioId, commentId, replyId } = req.params;

    try {
        const reply = await AudioReply.findById(replyId);
        if (!reply) return res.status(404).json({ success: false, message: "Reply not found!" });

        if (reply.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        reply.text = text;
        await reply.save();

        res.status(200).json({ success: true, message: "Reply updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update reply!" });
    }
});

// Delete Reply
app.delete("/audios/:audioId/comments/:commentId/replies/:replyId", async (req, res) => {
    const { userEmail } = req.body;
    const { audioId, commentId, replyId } = req.params;

    try {
        const reply = await AudioReply.findById(replyId);
        if (!reply) return res.status(404).json({ success: false, message: "Reply not found!" });

        if (reply.userEmail !== userEmail)
            return res.status(403).json({ success: false, message: "Permission denied!" });

        await AudioReply.findByIdAndDelete(replyId);

        const comment = await AudioComment.findById(commentId);
        comment.replies = comment.replies.filter((id) => id.toString() !== replyId);
        await comment.save();

        res.status(200).json({ success: true, message: "Reply deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete reply!" });
    }
});

// Photo Routes

// Get All Photos
app.get("/photos", async (req, res) => {
    try {
        const photos = await Photo.find();
        res.json({ data: photos });
    } catch (error) {
        res.status(500).json({ message: "Error fetching photos", error });
    }
});

// Upload Photo
app.post("/photos", photoUpload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded!" });

    try {
        const { title, userEmail } = req.body;
        const newPhoto = new Photo({
            title,
            image: `http://localhost:8000/photo-uploads/${req.file.filename}`,
            userEmail,
        });

        await newPhoto.save();
        res.status(201).json({ message: "Photo uploaded!", data: newPhoto });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});

// Delete Photo
app.delete("/photos/:id", async (req, res) => {
    try {
        const photo = await Photo.findByIdAndDelete(req.params.id);
        if (!photo) return res.status(404).json({ message: "Photo not found" });

        res.status(200).json({ message: "Photo deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting photo", error });
    }
});

// Default Route
app.get("/", (req, res) => {
    res.send({ status: "Server Is Running" });
});

// blog post 
const dataFilePath = path.join(__dirname, 'data.json');

const readData = () => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist or is corrupted, return default data
        return { blogs: [], nextId: 1 };
    }
};

// Helper function to write data to the JSON file
const writeData = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
};

// Initialize data from the file
let { blogs, nextId } = readData();

// Middleware to check if the email is authorized
const checkEmail = (req, res, next) => {
    const { email } = req.body;
    if (!allowedEmails.includes(email)) {
        return res.status(403).json({ message: "Unauthorized email" });
    }
    next();
};

// Get all blogs
app.get('/api/blogs', (req, res) => {
    res.json(blogs);
});

// Create a new blog
app.post('/api/blogs', checkEmail, (req, res) => {
    const { title, img, link, email, category } = req.body;
    const newBlog = { id: nextId++, title, img, link, category, email };
    blogs.push(newBlog);
    writeData({ blogs, nextId }); // Save the updated data to the file
    res.status(201).json(newBlog);
});

// Update a blog
app.put('/api/blogs/:id', checkEmail, (req, res) => {
    const { id } = req.params;
    const { title, img, link, category, email } = req.body;

    const blogIndex = blogs.findIndex(blog => blog.id === parseInt(id));
    if (blogIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
    }

    blogs[blogIndex] = { ...blogs[blogIndex], title, img, link, category };
    writeData({ blogs, nextId }); // Save the updated data to the file
    res.status(200).json(blogs[blogIndex]);
});

// Delete a blog
app.delete('/api/blogs/:id', checkEmail, (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    const blogIndex = blogs.findIndex(blog => blog.id === parseInt(id));
    if (blogIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
    }

    blogs.splice(blogIndex, 1);
    writeData({ blogs, nextId }); // Save the updated data to the file
    res.status(200).json({ message: "Blog deleted successfully" });
});

// Start Server
app.listen(8000, () => console.log("Server is Running on Port 8000"));