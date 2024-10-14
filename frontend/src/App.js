import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'; // Optional: For custom styles

function App() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');

  const handleSend = async () => {
    if (!userInput.trim()) return; // Prevent sending empty messages

    // Add user's message to the chat
    setMessages([...messages, { sender: 'user', text: userInput }]);

    // Send user input to the server (Node.js)
    const response = await fetch('https://open-ai-qtd-o8dk.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userInput }),
    });

    const data = await response.json();
    // Add the assistant's response to the chat
    setMessages([...messages, { sender: 'user', text: userInput }, { sender: 'assistant', text: data.reply }]);
    setUserInput('');
  };

  return (
    <div className="App container mt-5">
      <h1 className="text-center mb-4">Stock Assistant</h1>

      <div className="chat-container card shadow p-4 mb-4">
        <div className="chat-box">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className={`message-bubble ${msg.sender === 'user' ? 'user-message' : 'assistant-message'}`}>
                <b>{msg.sender === 'user' ? 'You' : 'Assistant'}: </b> {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button className="btn btn-primary" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
