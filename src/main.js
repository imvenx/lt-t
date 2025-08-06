const express = require('express');
const cors = require('cors');
const { ChatOllama } = require('@langchain/ollama');
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { RunnableConfig } = require("@langchain/langgraph");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));
app.listen(PORT, () => console.log(`App started at http://localhost:${PORT}`))
app.get('/', (req, res) => { res.sendFile(__dirname + '/frontend/index.html'); });

const llm = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'gemma3:latest', temperature: 0.1 });
const checkpointer = new MemorySaver();
const agent = createReactAgent({ llm: llm, tools: [], prompt: 'aid the user', checkpointer });
const config = { configurable: { thread_id: '1' } };

async function chat() {
    const answer = await agent.invoke({ messages: ['3'] }, config)
    console.log(answer)
    const answer2 = await agent.invoke({ messages: ['+ 5?'] }, config)
    console.log(answer2)
}

chat()