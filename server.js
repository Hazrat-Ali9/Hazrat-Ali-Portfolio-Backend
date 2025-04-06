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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/photo-uploads", express.static(path.join(__dirname, "photo-uploads")));

// Email Credentials (from environment variables)
const mail = process.env.EMAIL || 'hazrataliein@gmail.com';
const password = process.env.EMAIL_PASSWORD || 'abvk dimq kzxk fulk';

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
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

// Get the default connection
const db = mongoose.connection;

// Bind connection to error event
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
        // Create uploads directory if it doesn't exist
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

// Multer Storage Configuration for Photos
const PhotosStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create photo-uploads directory if it doesn't exist
        const dir = 'photo-uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
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
    userName: String,
    videoId: mongoose.Schema.Types.ObjectId,
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Reply" }],
});

const replySchema = new mongoose.Schema({
    text: String,
    userEmail: String,
    userName: String,
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

// Email Route
app.post('/send', (req, res) => {
    const data = req.body;
    const mailOptions = {
        from: mail,
        to: 'hazrataliein@gmail.com',
        subject: data.subject,
        text: `You have received a new message from ${data.name} \n\n Message: ${data.message} \n\n Reply to: ${data.email}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            res.send({ not_sent: error, status: "!sent" });
        } else {
            res.send({ Email_sent: info.response, status: "sent" });
        }
    });
});

// Video Routes

// Get All Videos
app.get("/videos", async (req, res) => {
    try {
        const videos = await Video.find().populate({
            path: "comments",
            populate: {
                path: "replies",
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
        const newVideo = new Video({ 
            title, 
            filename: req.file.filename, 
            uploadedBy: userEmail 
        });
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

// Comment Routes for Videos

// Add Comment
app.post("/videos/:videoId/comments", async (req, res) => {
    const { text, userEmail, userName } = req.body;
    const videoId = req.params.videoId;

    try {
        const newComment = new Comment({ text, userEmail, userName, videoId });
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

// Reply Routes for Videos

// Add Reply
app.post("/videos/:videoId/comments/:commentId/replies", async (req, res) => {
    const { text, userEmail, userName } = req.body;
    const { videoId, commentId } = req.params;

    try {
        const newReply = new Reply({ text, userEmail, userName, commentId });
        await newReply.save();

        const comment = await Comment.findById(commentId);
        comment.replies.push(newReply._id);
        await comment.save();

        res.status(201).json({ success: true, message: "Reply added successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add reply!" });
    }
});

// Photo Routes

// Get All Photos
app.get("/photos", async (req, res) => {
    try {
        const photos = await Photo.find();
        const photosWithFullUrl = photos.map(photo => ({
            ...photo.toObject(),
            image: `http://localhost:8000${photo.image}`
        }));
        res.json({ data: photosWithFullUrl });
    } catch (error) {
        console.error("Error fetching photos:", error);
        res.status(500).json({ message: "Error fetching photos", error: error.message });
    }
});

// Upload Photo
app.post("/photos", photoUpload.single("image"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded!" });

    try {
        const { title, userEmail } = req.body;
        const imageUrl = `/photo-uploads/${req.file.filename}`;
        
        const newPhoto = new Photo({
            title,
            image: imageUrl,
            userEmail,
        });

        await newPhoto.save();
        res.status(201).json({ 
            message: "Photo uploaded!", 
            data: {
                ...newPhoto.toObject(),
                imageUrl: `http://localhost:8000${imageUrl}`
            }
        });
    } catch (error) {
        console.error("Photo upload error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Delete Photo
app.delete("/photos/:id", async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).json({ message: "Photo not found" });

        const filePath = `photo-uploads/${photo.image}`;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Photo.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Photo deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting photo", error });
    }
});

// Blog Routes
const dataFilePath = path.join(__dirname, 'data.json');

const readData = () => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { blogs: [], nextId: 1 };
    }
};

const writeData = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
};

let { blogs, nextId } = readData();

const checkEmail = (req, res, next) => {
    const { email } = req.body;
    if (!allowedEmails.includes(email)) {
        return res.status(403).json({ message: "Unauthorized email" });
    }
    next();
};

app.get('/api/blogs', (req, res) => {
    res.json(blogs);
});

app.post('/api/blogs', checkEmail, (req, res) => {
    const { title, img, link, email, category } = req.body;
    const newBlog = { id: nextId++, title, img, link, category, email };
    blogs.push(newBlog);
    writeData({ blogs, nextId });
    res.status(201).json(newBlog);
});

app.put('/api/blogs/:id', checkEmail, (req, res) => {
    const { id } = req.params;
    const { title, img, link, category, email } = req.body;

    const blogIndex = blogs.findIndex(blog => blog.id === parseInt(id));
    if (blogIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
    }

    blogs[blogIndex] = { ...blogs[blogIndex], title, img, link, category };
    writeData({ blogs, nextId });
    res.status(200).json(blogs[blogIndex]);
});

app.delete('/api/blogs/:id', checkEmail, (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    const blogIndex = blogs.findIndex(blog => blog.id === parseInt(id));
    if (blogIndex === -1) {
        return res.status(404).json({ message: "Blog not found" });
    }

    blogs.splice(blogIndex, 1);
    writeData({ blogs, nextId });
    res.status(200).json({ message: "Blog deleted successfully" });
});

// Default Route
app.get("/", (req, res) => {
    res.send({ status: "Server Is Running" });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start Server

app.listen(8000, () => {
    console.log("Server Is Running")
})

module.exports = app;