const express = require('express');
const cors = require('cors');
const { ChatOllama } = require('@langchain/ollama');
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));
app.listen(PORT, () => console.log(`App started at http://localhost:${PORT}`))
app.get('/', (req, res) => { res.sendFile(__dirname + '/frontend/index.html'); });

const llm = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'gemma3:latest', temperature: 0.1 });
const agent = createReactAgent({ llm: llm, tools: [], prompt: 'say hello' });
async function chat() {
    const answer = await agent.invoke({ message: 'hello' })
    console.log(answer)
}

chat()