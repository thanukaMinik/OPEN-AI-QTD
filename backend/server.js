const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());


app.use(cors({
    origin: ['open-ai-7tg0kop6e-thanukas-projects.vercel.app', 'https://open-ai-qtd.vercel.app'], // Allow only your frontend to access the API
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true // Allow credentials (if needed)
}));



app.use("/", (req,res) => {
    res.send("Server is running")
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
