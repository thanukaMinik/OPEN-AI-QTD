const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs'); // Import the fs module

const app = express();
const port = 5000;

app.use(express.json());


// Specify the allowed origin(s)
const allowedOrigins = ['https://open-ai-qtd.vercel.app']; // Replace with your frontend URL

app.use(cors({
    origin:"*", // Allow only your frontend to access the API
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow specific HTTP methods
    credentials: true // Allow credentials (if needed)
}));


// In-memory storage for memory functionality
let memory = {};

// Function to fetch stock data
async function getStockPrice(stockSymbol) {
    const apiKey = '03CCPFZVOFKONAAY'; // Actual API key
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${stockSymbol}&interval=5min&apikey=${apiKey}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        // Extracting the latest stock data from the response
        const timeSeries = data['Time Series (5min)'];
        const latestTime = Object.keys(timeSeries)[0];
        const latestPrice = timeSeries[latestTime]['4. close'];

        return `The latest price of ${stockSymbol} is $${latestPrice}`;
    } catch (error) {
        console.error('Error fetching stock data:', error);
        return 'Unable to fetch stock data at the moment. Please try again later.';
    }
}

// Helper function to check if the message is a stock request
function isStockRequest(message) {
    return /stock price of|price of/i.test(message); // Looks for phrases like "stock price of" or "price of"
}

// Extract stock symbol from the user's message
function extractStockSymbol(message) {
    const matches = message.match(/\b[A-Z]{1,5}\b/); // Looks for a stock ticker (1 to 5 uppercase letters)
    return matches ? matches[0] : null;
}

// Function to log chat history
function logChatHistory(userMessage, assistantReply) {
    const logEntry = `User: ${userMessage}\nAssistant: ${assistantReply}\n\n`;
    fs.appendFile('chat_history.txt', logEntry, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
        }
    });
}

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    // Check if the message is a stock query
    if (isStockRequest(userMessage)) {
        const stockSymbol = extractStockSymbol(userMessage);
        if (stockSymbol) {
            const stockPrice = await getStockPrice(stockSymbol);
            logChatHistory(userMessage, stockPrice); // Log the interaction
            return res.json({ reply: stockPrice });
        } else {
            const errorMessage = 'Please provide a valid stock symbol.';
            logChatHistory(userMessage, errorMessage); // Log the error
            return res.json({ reply: errorMessage });
        }
    } 

    // Handle memory commands
    if (userMessage.toLowerCase().startsWith("remember")) {
        const information = userMessage.slice(8).trim(); // Remove "remember " from the message
        memory[information] = true; // Save the information in memory
        logChatHistory(userMessage, `I'll remember that: "${information}"`); // Log the interaction
        return res.json({ reply: `I'll remember that: "${information}"` });
    } else if (userMessage.toLowerCase().startsWith("what do you remember")) {
        const remembered = Object.keys(memory).join(", ");
        const reply = remembered ? `I remember: ${remembered}` : "I don't remember anything yet.";
        logChatHistory(userMessage, reply); // Log the interaction
        return res.json({ reply: reply });
    } else if (userMessage.toLowerCase().startsWith("forget")) {
        const information = userMessage.slice(7).trim(); // Remove "forget " from the message
        delete memory[information]; // Remove the information from memory
        const reply = `I've forgotten: "${information}"`;
        logChatHistory(userMessage, reply); // Log the interaction
        return res.json({ reply: reply });
    }

    // If it's not a stock request or a memory command, send the user message to OpenAI API
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
                    Authorization: `Bearer sk-gB-CSRkah3lpO1y62w12LOwfsll42t1HQ_5iJhaJifT3BlbkFJD9y7xD0uEsxUCTgDal98JBm4xg8H_jfMz7X5i9_eoA`, // Use your actual API key here
                },
            }
        );

        const assistantReply = openaiResponse.data.choices[0].message.content;
        logChatHistory(userMessage, assistantReply); // Log the interaction
        res.json({ reply: assistantReply });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error communicating with OpenAI' });
    }
});

// Endpoint to retrieve chat history
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
