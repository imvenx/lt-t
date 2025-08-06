const { tool } = require("@langchain/core/tools");

const retrieve = tool(
    async ({ query }) => {
        const retrievedDocs = await vectorStore.similaritySearch(query, 2);
        const serialized = retrievedDocs
            .map(
                (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
            )
            .join("\n");
        return [serialized, retrievedDocs];
    },
    {
        name: "retrieve",
        description: "Retrieve information related to a query.",
        // schema: retrieveSchema,
        responseFormat: "content_and_artifact",
    }
);

module.exports = retrieve;