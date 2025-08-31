// Test story interaction in a conversation flow
console.log('\n🤖 Testing Story System in Conversation\n');
console.log('='.repeat(50));

// Mock story tool
const storyTool = {
    searchStories: (query) => {
        const stories = [
            {
                id: 1,
                title: "Journey from Sicily to New York",
                briefSummary: "When we moved from Italy to New York",
                narrative: "In March 1955, my family and I left everything behind in Sicily. Papa Giuseppe, Mama Maria, my brother Antonio and I boarded a ship bound for America. After weeks at sea, we finally saw the Statue of Liberty. Ellis Island was overwhelming - the medical exams, the questions, they even changed our name. But Uncle Salvatore was waiting for us. He helped us find a small apartment on Mulberry Street in Little Italy, and Papa started working at his bakery the very next week.",
                tone: "nostalgic",
                people: ["Giuseppe", "Maria", "Antonio", "Salvatore"],
                significance: 4
            },
            {
                id: 2,
                title: "Saying Goodbye to Dad",
                briefSummary: "Father's passing in December",
                narrative: "December 15, 2023 is a date I'll never forget. Dad had been fighting cancer for months, and Dr. Williams at Mount Sinai had done everything possible. That morning at 3:45 AM, surrounded by family in his hospital room, Dad peacefully passed away. I held his hand as he took his final breath. Even though we knew it was coming, saying goodbye was the hardest thing I've ever done.",
                tone: "sad",
                people: ["Dad", "Mom", "Dr. Williams"],
                significance: 5
            }
        ];

        const query_lower = query.toLowerCase();
        // Split query into words for better matching
        const queryWords = query_lower.split(/\s+/);
        
        return stories.filter(s => {
            const searchText = (s.narrative + ' ' + s.briefSummary + ' ' + s.title).toLowerCase();
            // Check if all important words are present
            const importantWords = queryWords.filter(w => w.length > 2);
            return importantWords.every(word => searchText.includes(word));
        });
    },

    appendToStory: (storyId, newInfo) => {
        // Check for contradictions
        if (newInfo.includes("1956") && storyId === 1) {
            return {
                success: false,
                needsClarification: true,
                message: "I noticed the story mentions March 1955, but you just said 1956. Could you help me understand which is correct?"
            };
        }
        return {
            success: true,
            message: "I've added that information to your story."
        };
    },

    createStory: (title, content) => {
        return {
            success: true,
            message: `I've created a new story: "${title}"`,
            storyId: 3
        };
    }
};

// Simulate conversations
async function simulateConversations() {
    const conversations = [
        {
            user: "Tell me about when I moved to New York",
            action: async () => {
                const results = storyTool.searchStories("moved to new york");
                if (results.length > 0) {
                    const story = results[0];
                    return `I found your story about "${story.briefSummary}". Would you like me to tell you this story, or would you like to add more details to it?`;
                }
                return "I couldn't find any stories about that. Would you like to tell me about it so I can create a new story?";
            }
        },
        {
            user: "Yes, tell me the whole story",
            action: async () => {
                const results = storyTool.searchStories("moved to new york");
                if (results.length > 0) {
                    return results[0].narrative;
                }
                return "Let me find that story for you...";
            }
        },
        {
            user: "Actually, we arrived in 1956, not 1955",
            action: async () => {
                const result = storyTool.appendToStory(1, "arrived in 1956");
                return result.message;
            }
        },
        {
            user: "What happened to my father?",
            action: async () => {
                const results = storyTool.searchStories("father");
                if (results.length > 0) {
                    const story = results[0];
                    return `I found your story about "${story.briefSummary}". This is a significant memory with a ${story.tone} tone. Would you like me to share it with you?`;
                }
                return "I don't have any stories about that. Would you like to share?";
            }
        },
        {
            user: "Yes, but just give me a summary",
            action: async () => {
                const results = storyTool.searchStories("father");
                if (results.length > 0) {
                    const story = results[0];
                    return `Your father passed away on December 15, 2023 at Mount Sinai Hospital after battling cancer. You were there with him and your family when he peacefully passed at 3:45 AM.`;
                }
                return "Let me find that information...";
            }
        },
        {
            user: "I want to tell you about my wedding day",
            action: async () => {
                const results = storyTool.searchStories("wedding");
                if (results.length === 0) {
                    return "I don't have a story about your wedding yet. I'd love to hear about it! Please tell me about your wedding day, and I'll create a story to preserve this memory.";
                }
                return "I found a story about your wedding...";
            }
        },
        {
            user: "It was June 12, 1978. I married Susan at St. Patrick's Cathedral...",
            action: async () => {
                const result = storyTool.createStory(
                    "Wedding Day at St. Patrick's",
                    "June 12, 1978 - Married Susan at St. Patrick's Cathedral"
                );
                return result.message;
            }
        }
    ];

    for (const conv of conversations) {
        console.log(`\n👤 User: "${conv.user}"`);
        const response = await conv.action();
        console.log(`🤖 Assistant: ${response}`);
    }
}

// Run simulation
simulateConversations().then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ Conversation simulation completed!\n');
    
    console.log('📋 Summary of Features Demonstrated:');
    console.log('  ✓ Searching for existing stories');
    console.log('  ✓ Retrieving and retelling stories');
    console.log('  ✓ Detecting contradictions and asking for clarification');
    console.log('  ✓ Creating new stories from conversation');
    console.log('  ✓ Adjusting response based on story tone');
    console.log('  ✓ Providing brief summaries vs full narratives\n');
});