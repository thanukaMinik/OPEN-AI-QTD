const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config(); // Load environment variables
const OpenAI = require('openai') //import OpenAI


const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: ['open-ai-7tg0kop6e-thanukas-projects.vercel.app', 'https://open-ai-qtd.vercel.app'], // Allow only your frontend to access the API
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true // Allow credentials (if needed)
}));

app.use(express.json());


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY //Access api key from environment variable
});
let assistantId; //variable to store assitant ID
let threadId; //variable to store thread ID

let memory = {}; // In-memory storage for memory functionality


//Function to create Assistant on server start
async function createAssistant() {
    try {
        const assistant = await openai.beta.assistants.create({
            name: "AI Assistant",
            instructions: "You are an assistant that can fetch stock data, handle memory, and provide AI-powered support.",
            tools: [{ type: "code_interpreter" }], // Adding tools like code interpreter
            model: "gpt-4o"
        });
        assistantId = assistant.id; //store the assitant id
        console.log("Assistant created successfully", assistantId);
    }catch (error) {
        console.log("Error creating assitant", error)
    }
}

//function to create thread when conservation starts
async function createThred() {
    try{
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
        console.log("Thread create successfully", threadId);
    }catch(error){
        console.log("error creating thread", error);
    }
}

//fetch real time stock price using API
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

//memory handling logic
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

    // OpenAI API interaction using Assistant, Thread and Message features
   try{
    //create a new message in the thread
    const message = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage
    })

    //stream the assistance response
    const run = openai.beta.threads.run.stream(threadId, {
        assistant_id: assistantId
    })
    .on('textCreated', (text) => process.stdout.write('\nassistant > '))
            .on('textDelta', (textDelta) => process.stdout.write(textDelta.value))
            .on('toolCallCreated', (toolCall) => process.stdout.write(`\nassistant > ${toolCall.type}\n\n`))
            .on('toolCallDelta', (toolCallDelta) => {
                if (toolCallDelta.type === 'code_interpreter') {
                    if (toolCallDelta.code_interpreter.input) {
                        process.stdout.write(toolCallDelta.code_interpreter.input);
                    }
                    if (toolCallDelta.code_interpreter.outputs) {
                        process.stdout.write("\noutput >\n");
                        toolCallDelta.code_interpreter.outputs.forEach(output => {
                            if (output.type === "logs") {
                                process.stdout.write(`\n${output.logs}\n`);
                            }
                        });
                    }
                }
            });

        res.json({ reply: 'Assistant is processing the request...' });
   }catch(error) {
    console.error(error);
    res.status(500).json({error : 'Error communincating with OpenAI Assitant'});
   }
});

//Route to retrieve chat history
app.get('/chat-history', (req, res) => {
    fs.readFile('chat_history.txt', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Error reading chat history' });
        }
        res.send(data);
    });
});


//start the server and create assistant on start
app.listen(port, () => {
    createAssistant();
    createThred(); //Start a new thread when the server starts
    console.log(`Server running on http://localhost:${port}`);
});
