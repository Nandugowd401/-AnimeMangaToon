const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());


const url = 'mongodb://localhost:27017';  
const client = new MongoClient(url);
let db;

// Connect to the database
async function connectDB() {
    try {
        console.log('MongoDB connection URL:', url);  
        console.log('Attempting to connect to MongoDB...');
        
        await client.connect();  
        console.log('Connected to MongoDB');
        
        db = client.db('webtoonDB');  
    } catch (error) {
        console.error('Error connecting to the database:', error);  
        process.exit(1); 
    }
}

connectDB();


// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);


//JWT authentication middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(403).send('Token is required');

    jwt.verify(token.split(' ')[1], 'Nandu', (err, user) => {
        if (err) return res.status(403).send('Invalid token');
        req.user = user;
        next();
    });
};


// Token generation endpoint
app.post('/generate-token', (req, res) => {
    
    const user = { id: 1, username: 'testUser' }; 
    const token = jwt.sign(user, 'Nandu', { expiresIn: '1h' }); 
    res.json({ token });
});


// Input validations schema for webtoon
const webtoonSchema = Joi.object({
    title: Joi.string().min(2).required(),
    description: Joi.string().min(10).required(),
    characters: Joi.array().items(Joi.string()).min(1).required()
});


// Get all webtoons
app.get('/webtoons', async (req, res) => {
    try {
        const webtoons = await db.collection('webtoons').find({}).toArray();
        res.status(200).json(webtoons);
    } catch (error) {
        res.status(500).send('Error fetching webtoons');
    }
});


// Get a specific webtoon by id
app.get('/webtoons/:id', async (req, res) => {
    try {
        const webtoon = await db.collection('webtoons').findOne({ _id: new ObjectId(req.params.id) });
        if (!webtoon) return res.status(404).send('Webtoon not found');
        res.status(200).json(webtoon);
    } catch (error) {
        res.status(500).send('Error fetching webtoon');
    }
});


// Post a new webtoon (Protected with JWT)
app.post('/webtoons', authenticateJWT, async (req, res) => {
    const { error } = webtoonSchema.validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const { title, description, characters } = req.body;
    try {
        const result = await db.collection('webtoons').insertOne({ title, description, characters });
        res.status(201).json(result);
    } catch (error) {
        res.status(500).send('Error adding webtoon');
    }
});


// Delete a webtoon by id (protected with JWT)
app.delete('/webtoons/:id', authenticateJWT, async (req, res) => {
    try {
        const result = await db.collection('webtoons').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).send('Webtoon not found');
        res.status(200).send('Webtoon deleted successfully');
    } catch (error) {
        res.status(500).send('Error deleting webtoon');
    }
});

// Start the server
const PORT = 4000; 
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`); 
});
