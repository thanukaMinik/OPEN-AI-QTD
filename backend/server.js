const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config(); // Load environment variables


const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());


app.use(cors({
    origin: ['open-ai-7tg0kop6e-thanukas-projects.vercel.app', 'https://open-ai-qtd.vercel.app'], // Allow only your frontend to access the API
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true // Allow credentials (if needed)
}));

let memory = {}; // In-memory storage for memory functionality

async function getStockPrice(stockSymbol) {
    const apiKey = 'GHQNM89Y28ZV7VVM'; // Use environment variable for API key
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${stockSymbol}&interval=5min&apikey=${apiKey}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        const timeSeries = data['Time Series (5min)'];
        const latestTime = Object.keys(timeSeries)[0];
        const latestPrice = timeSeries[latestTime]['4. close'];

        return `The latest price of ${stockSymbol} is $${latestPrice}`;
    } catch (error) {
        console.error('Error fetching stock data:', error);
        return 'Unable to fetch stock data at the moment. Please try again later.';
    }
}

function isStockRequest(message) {
    return /stock price of|price of/i.test(message);
}

function extractStockSymbol(message) {
    const matches = message.match(/\b[A-Z]{1,5}\b/);
    return matches ? matches[0] : null;
}

function logChatHistory(userMessage, assistantReply) {
    const logEntry = `User: ${userMessage}\nAssistant: ${assistantReply}\n\n`;
    fs.appendFile('chat_history.txt', logEntry, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
        }
    });
}

app.post('/api/chat', async (req, res) => { // Updated endpoint path
    const userMessage = req.body.message;

    if (isStockRequest(userMessage)) {
        const stockSymbol = extractStockSymbol(userMessage);
        if (stockSymbol) {
            const stockPrice = await getStockPrice(stockSymbol);
            logChatHistory(userMessage, stockPrice);
            return res.json({ reply: stockPrice });
        } else {
            const errorMessage = 'Please provide a valid stock symbol.';
            logChatHistory(userMessage, errorMessage);
            return res.json({ reply: errorMessage });
        }
    }

    // Memory command handling
    if (userMessage.toLowerCase().startsWith("remember")) {
        const information = userMessage.slice(8).trim();
        memory[information] = true;
        logChatHistory(userMessage, `I'll remember that: "${information}"`);
        return res.json({ reply: `I'll remember that: "${information}"` });
    } else if (userMessage.toLowerCase().startsWith("what do you remember")) {
        const remembered = Object.keys(memory).join(", ");
        const reply = remembered ? `I remember: ${remembered}` : "I don't remember anything yet.";
        logChatHistory(userMessage, reply);
        return res.json({ reply: reply });
    } else if (userMessage.toLowerCase().startsWith("forget")) {
        const information = userMessage.slice(7).trim();
        delete memory[information];
        const reply = `I've forgotten: "${information}"`;
        logChatHistory(userMessage, reply);
        return res.json({ reply: reply });
    }

    // OpenAI API interaction
    try {
        const openaiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a stock assistant.' },
                    { role: 'user', content: userMessage }
                ],
            },
            {
                headers: {
                    Authorization: `Bearer sk-gB-CSRkah3lpO1y62w12LOwfsll42t1HQ_5iJhaJifT3BlbkFJD9y7xD0uEsxUCTgDal98JBm4xg8H_jfMz7X5i9_eoA`, // Use environment variable for API key
                },
            }
        );

        const assistantReply = openaiResponse.data.choices[0].message.content;
        logChatHistory(userMessage, assistantReply);
        res.json({ reply: assistantReply });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error communicating with OpenAI' });
    }
});

app.get('/chat-history', (req, res) => {
    fs.readFile('chat_history.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Error reading chat history' });
        }
        res.send(data);
    });
});



app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
