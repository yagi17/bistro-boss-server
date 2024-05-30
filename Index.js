require('dotenv').config()
const express = require('express');
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_KEY)
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5bvaa0x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const dbConnect = async () => {
    try {
        console.log("You successfully connected to MongoDB!");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error.massage);
    }
};
dbConnect();

const userCollection = client.db('BistroDB').collection('users')
const menuCollection = client.db('BistroDB').collection('menu')
const reviewCollection = client.db('BistroDB').collection('reviews')
const cartCollection = client.db('BistroDB').collection('carts')

// JWT Related API
app.post('/jwt', async (req, res) => {
    const user = req.body
    const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
    res.send({ token })
})

// User Related API
app.post('/users', async (req, res) => {
    const user = req.body
    const query = { email: user.email }
    const existingUser = await userCollection.findOne(query)
    if (existingUser) {
        return res.send({ message: 'user already exists', insertId: null })
    }
    const result = await userCollection.insertOne(user)
    res.send(result)
})

app.patch('/users/admin/:id', async (req, res) => {
    const id = req.params.id
    const filter = { _id: new ObjectId(id) }
    const updatedDoc = {
        $set: {
            role: 'admin'
        }
    }
    const result = await userCollection.updateOne(filter, updatedDoc)
    res.send(result)
})

// use verify admin after verify token

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email
    const query = { email: email }
    const user = await userCollection.findOne(query)
    const isAdmin = user?.role === 'admin'
    if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden Access' })
    }
    next()
}

// Middlewares

const verifyToken = (req, res, next) => {
    // console.log("inside verify token", req.headers.authorization);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = req.headers.authorization.split(' ')[1]
    // console.log(token);
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            // console.log(err);
            return res.status(401).send({ message: 'Unauthorized Access' })
        }
        req.decoded = decoded
        next()
    });
}

// user API

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const user = await userCollection.find().toArray()
    res.send(user)
})

app.get('/users/admin/:email', verifyToken, async (req, res) => {
    const email = req.params.email
    if (email !== req.decoded.email) {
        res.status(403).send({ message: 'Forbidden Access' })
    }
    const query = { email: email }
    const user = await userCollection.findOne(query)
    let admin = false
    if (user) {
        admin = user?.role === 'admin';
    }
    res.send({ admin })
})

app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await userCollection.deleteOne(query)
    res.send(result)
})


// Menu Related API //

app.get('/menu', async (req, res) => {
    const result = await menuCollection.find().toArray()
    res.send(result)
})

app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
    const item = req.body
    const result = await menuCollection.insertOne(item)
    res.send(result)
})

app.get('/menu/:id', async (req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await menuCollection.findOne(query)
    res.send(result)
})

app.patch('/menu/:id', async (req, res) => {
    const item = req.body
    const id = req.params.id
    const filter = { _id: new ObjectId(id) }
    const updatedDoc = {
        $set: {
            name: item.name,
            category: item.category,
            price: item.price,
            recipe: item.recipe,
            image: item.image
        }
    }
    const result = await menuCollection.updateOne(filter, updatedDoc)
    res.send(result)
})

app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await menuCollection.deleteOne(query)
    res.send(result)
})


// Review Related API //

app.get('/reviews', async (req, res) => {
    const result = await reviewCollection.find().toArray()
    res.send(result)
})


// Cart Related API // Public API //

app.get('/carts', async (req, res) => {
    const email = req.query.email
    const query = { email: email }
    const result = await cartCollection.find(query).toArray()
    res.send(result)
})

app.post('/carts', async (req, res) => {
    const cardItem = req.body
    const result = await cartCollection.insertOne(cardItem)
    res.send(result)
})

app.delete('/carts/:id', async (req, res) => {
    const id = req.params.id
    const query = { _id: new ObjectId(id) }
    const result = await cartCollection.deleteOne(query)
    res.send(result)
})

// Payment Related API
// STRIPE_KEY
app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body
    const amount = parseInt(price * 100)
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_options: ['card']
    })
    res.send({
        clientSecret: paymentIntent.client_secret
    })
})

app.get('/', (req, res) => {
    res.send('Boss is sitting')
})
app.listen(port, () => {
    console.log(`Bistro Boss is sitting on port ${port}`);
})