const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
const cors = require('cors');
app.use(cors());

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
let db;

async function connectDB() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();  
        console.log('Connected to MongoDB');
        db = client.db('fantasyDB');
    } catch (error) {
        console.error('Error connecting to the database:', error);
        process.exit(1);
    }
}

connectDB();

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use(limiter);

// JWT authentication middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(403).send('Token is required');

    jwt.verify(token.split(' ')[1], 'Nandu', (err, user) => {
        if (err) return res.status(403).send('Invalid token');
        req.user = user;
        next();
    });
};

// Example token generation
app.post('/generate-token', (req, res) => {
    const user = { id: 1, username: 'testUser' };
    const token = jwt.sign(user, 'Nandu', { expiresIn: '1h' });
    res.json({ token });
});

// Schema for webtoon validation
const webtoonSchema = Joi.object({
    title: Joi.string().min(2).required(),
    image: Joi.string().uri().required(),
    description: Joi.string().min(10).required()
   // Adding image as a required field
});

// Fetch all webtoons
app.get('/webtoons', async (req, res) => {
    try {
        const webtoons = await db.collection('manhwa').find({}).toArray();
        res.status(200).json(webtoons);
    } catch (error) {
        res.status(500).send('Error fetching webtoons');
    }
});

// Add new webtoon (Protected with JWT)
app.post('/webtoons', authenticateJWT, async (req, res) => {
    const { error } = webtoonSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const { title, image, description} = req.body;
    try {
        const result = await db.collection('manhwa').insertOne({ title, image , description});
        res.status(201).json(result);
    } catch (error) {
        res.status(500).send('Error adding webtoon');
    }
});



//votes data
let votes = {manhwa: 0, anime: 0};

app.post('/vote', (req,res)=>{
    const {type} = req.body;
    if(type == 'manhwa') votes.manhwa++;
    if(type == 'anime') votes.anime++;
    res.json(votes);
});

app.get('/votes', (req,res)=>{
    res.json(votes);
})




// Server start
const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
