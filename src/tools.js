const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

function createRetrievalTool(vectorStore) {
    return tool(
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
}

module.exports = { createRetrievalTool };
