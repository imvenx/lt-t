const express = require('express');
const cors = require('cors');
const path = require('path');
const { ChatOllama, OllamaEmbeddings } = require('@langchain/ollama');
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { RunnableConfig } = require("@langchain/langgraph");
const { ChatAnthropic } = require('@langchain/anthropic');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.post('/chat', async (req, res) => {
    const { message } = req.body;
    const threadId = req.headers['x-thread-id'] || 'default-thread';

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        const stream = await agent.streamEvents(
            { messages: [message] },
            { configurable: { thread_id: threadId }, version: 'v2' }
        );

        let inToolCall = false;

        for await (const event of stream) {
            if (event.event === 'on_tool_start') {
                res.write('\n[TOOL_START]Searching CVs...[TOOL_START]\n');
                inToolCall = true;
            }

            if (event.event === 'on_tool_end') {
                const toolResult = event.data?.output?.content || event.data?.output;
                if (toolResult && typeof toolResult === 'string') {
                    res.write(toolResult + '\n');
                }
                res.write('\n[TOOL_END]Search complete[TOOL_END]\n');
                inToolCall = false;
            }

            if (event.event === 'on_chat_model_stream' && !inToolCall) {
                const text = event.data?.chunk?.content?.[0]?.text;
                if (text) {
                    res.write(text);
                }
            }
        }

        res.end();
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).end('Error processing request');
    }
});

app.listen(PORT, () => console.log(`App started at http://localhost:${PORT}`));

// const llm = new ChatOllama({ baseUrl: 'http://localhost:11434', model: 'gpt-oss:20b', temperature: 0.1 });
const llm = new ChatAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-5-haiku-20241022',
    temperature: 0.1
});

const embeddings = new OllamaEmbeddings({ baseUrl: 'http://localhost:11434', model: 'nomic-embed-text', });
const vectorStore = new MemoryVectorStore(embeddings);


const retrieveTool = tool(
    async ({ query }) => {
        const retrievedDocs = await vectorStore.similaritySearch(query, 4);

        if (retrievedDocs.length === 0) {
            return "No relevant CVs found for your query.";
        }

        const candidateInfo = {};
        retrievedDocs.forEach(doc => {
            const name = doc.metadata.candidateName || doc.metadata.filename;
            if (!candidateInfo[name]) {
                candidateInfo[name] = [];
            }
            candidateInfo[name].push(doc.pageContent);
        });

        let response = "Here's what I found in the CVs:\n\n";
        for (const [candidate, contents] of Object.entries(candidateInfo)) {
            response += `**${candidate}:**\n`;
            response += contents.join('\n') + '\n\n';
        }

        return response;
    },
    {
        name: "search_cvs",
        description: "Search through CV database for candidates with specific skills, experience, or qualifications",
        schema: z.object({
            query: z.string().describe("The search query to find relevant CV information"),
        }),
    }
);

const checkpointer = new MemorySaver();
const agent = createReactAgent({ llm: llm, tools: [retrieveTool], prompt: 'Task: aid the user', checkpointer });
const config = { configurable: { thread_id: '1' } };

async function loadCVs(cvsDirectory) {
    const pdfFiles = fs.readdirSync(cvsDirectory).map(file => path.join(cvsDirectory, file));
    console.log(`Loading ${pdfFiles.length} CV files...`);
    const allDocuments = [];

    for (const pdfPath of pdfFiles) {
        console.log(`Processing: ${path.basename(pdfPath)}`);

        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();

        docs.forEach(doc => {
            doc.metadata = {
                ...doc.metadata,
                filename: path.basename(pdfPath),
                candidateName: extractCandidateName(path.basename(pdfPath)),
                source: pdfPath,
                id: uuidv4(),
            };
        });

        allDocuments.push(...docs);
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
    });

    const allSplits = await textSplitter.splitDocuments(allDocuments);
    await vectorStore.addDocuments(allSplits);

    console.log(`CVs loaded - ${allSplits.length} chunks created from ${pdfFiles.length} files`);
    return allSplits.length;
}

function extractCandidateName(filename) {
    return filename.replace('_cv.pdf', '').split('_').join(' ');
}

async function chat() {
    const stream1 = agent.streamEvents({ messages: ['who knows python?'] }, { ...config, version: 'v2' });
    console.log('First response:');
    for await (const event of stream1) {
        if (event.event === 'on_chat_model_stream') {
            process.stdout.write(event.data?.chunk?.content?.[0]?.text ?? '');
        }

        if (event.event === 'on_tool_start') {
            console.log(event)
        }
        if (event.event === 'on_tool_end') {
            console.log(event)
        }
    }
    // console.log(stream1)

    // const stream2 = agent.streamEvents({ messages: ['+ 5?'] }, { ...config, version: 'v2' });
    // console.log('Second response:');
    // for await (const event of stream2) {
    //     if (event.event === 'on_chat_model_stream') {
    //         process.stdout.write(event.data?.chunk?.content?.[0]?.text ?? '');
    //     }
    // }

    // const history = await checkpointer.get(config.configurable);
    // console.log('\n\n[CHAT HISTORY]:', JSON.stringify(history?.channel_values?.messages || [], null, 2));

}

loadCVs('./cvs')
// chat() // Commented out - now using web interface