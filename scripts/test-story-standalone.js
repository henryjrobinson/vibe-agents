// Standalone test without database dependency
console.log('\n🧪 Testing Story Aggregation System (Standalone)\n');
console.log('='.repeat(50));

// Mock the database module to prevent initialization
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id.includes('database') || id.includes('storyStore')) {
        return {
            pool: { query: async () => ({ rows: [] }) },
            decrypt: (text) => text,
            encrypt: (text) => text
        };
    }
    return originalRequire.apply(this, arguments);
};

const enhancedStoryAggregator = require('../server/tools/enhancedStoryAggregator');

// Test data
const mockMemories = [
    {
        id: 1,
        conversationId: 'conv1',
        createdAt: new Date('2024-01-15'),
        payload: {
            narrator: "Henry Robinson",
            people: ["Giuseppe", "Maria", "Antonio"],
            places: ["Sicily", "Ellis Island", "New York City", "Little Italy"],
            dates: ["1955", "March 1955"],
            events: ["immigrated to America", "arrived at Ellis Island", "settled in Little Italy"],
            relationships: [
                { from: "Giuseppe", to: "Henry Robinson", relation: "father" },
                { from: "Maria", to: "Henry Robinson", relation: "mother" },
                { from: "Antonio", to: "Henry Robinson", relation: "brother" }
            ]
        }
    },
    {
        id: 2,
        conversationId: 'conv1',
        createdAt: new Date('2024-01-16'),
        payload: {
            people: ["Giuseppe", "Maria"],
            places: ["Ellis Island", "Manhattan"],
            dates: ["March 15, 1955"],
            events: ["processed at Ellis Island", "medical examinations", "name changed"],
            relationships: []
        }
    },
    {
        id: 3,
        conversationId: 'conv1',
        createdAt: new Date('2024-01-17'),
        payload: {
            people: ["Giuseppe", "Uncle Salvatore"],
            places: ["Little Italy", "Mulberry Street"],
            dates: ["1955", "Spring 1955"],
            events: ["found apartment", "started working at bakery"],
            relationships: [
                { from: "Salvatore", to: "Giuseppe", relation: "brother" }
            ]
        }
    },
    {
        id: 4,
        conversationId: 'conv2',
        createdAt: new Date('2024-02-01'),
        payload: {
            narrator: "Henry Robinson",
            people: ["Dad", "Mom", "Dr. Williams"],
            places: ["Mount Sinai Hospital", "New York"],
            dates: ["December 2023", "December 15, 2023"],
            events: ["father's death", "cancer diagnosis", "final goodbye"],
            relationships: [
                { from: "Dad", to: "Henry Robinson", relation: "father" }
            ]
        }
    },
    {
        id: 5,
        conversationId: 'conv2',
        createdAt: new Date('2024-02-02'),
        payload: {
            people: ["Dad", "family members"],
            places: ["hospital room", "Mount Sinai"],
            dates: ["December 15, 2023", "3:45 AM"],
            events: ["passed away", "held his hand", "said goodbye"],
            relationships: []
        }
    }
];

async function testStoryCreation() {
    try {
        // Test 1: Topic grouping
        console.log('\n📚 Test 1: Grouping memories by topic...\n');
        const topicGroups = await enhancedStoryAggregator.groupMemoriesByTopic(mockMemories);
        
        console.log(`Found ${topicGroups.length} distinct topic groups:`);
        topicGroups.forEach((group, i) => {
            console.log(`\nGroup ${i + 1}: ${group.memories.length} memories`);
            console.log(`  People: ${Array.from(group.primaryPeople).join(', ')}`);
            console.log(`  Places: ${Array.from(group.primaryPlaces).join(', ')}`);
            console.log(`  Events: ${Array.from(group.primaryEvents).slice(0, 3).join(', ')}`);
        });

        // Test 2: Story creation
        console.log('\n\n📚 Test 2: Creating stories from memory groups...\n');
        
        for (let i = 0; i < topicGroups.length; i++) {
            const group = topicGroups[i];
            console.log(`\nProcessing Group ${i + 1}...`);
            
            const story = await enhancedStoryAggregator.createStoryFromMemories(group, 'test-user');
            
            console.log(`\n📖 Story Created: "${story.title}"`);
            console.log(`   Brief: ${story.brief_summary}`);
            console.log(`   Tone: ${story.tone}`);
            console.log(`   Emotional Tags: ${story.emotional_tags?.join(', ') || 'none'}`);
            console.log(`   Significance: ${story.significance_rating}/5`);
            console.log(`   People: ${story.people.join(', ')}`);
            console.log(`   Places: ${story.places.join(', ')}`);
            
            console.log(`\n   Factual Content:`);
            console.log(`   ${story.content.substring(0, 200)}...`);
            
            if (story.narrative && story.narrative !== story.content) {
                console.log(`\n   Rich Narrative:`);
                console.log(`   ${story.narrative.substring(0, 300)}...`);
            }
        }

        // Test 3: Similarity calculation
        console.log('\n\n📚 Test 3: Testing similarity detection...\n');
        
        const memory1 = mockMemories[0]; // Immigration story
        const memory2 = mockMemories[1]; // More immigration details
        const memory3 = mockMemories[3]; // Father's death
        
        const group1 = {
            primaryPeople: new Set(memory1.payload.people),
            primaryPlaces: new Set(memory1.payload.places),
            primaryEvents: new Set(memory1.payload.events)
        };
        
        const sim1to2 = enhancedStoryAggregator.calculateTopicSimilarity(group1, memory2);
        const sim1to3 = enhancedStoryAggregator.calculateTopicSimilarity(group1, memory3);
        
        console.log(`Similarity between immigration memories: ${(sim1to2 * 100).toFixed(1)}%`);
        console.log(`Similarity between immigration and father's death: ${(sim1to3 * 100).toFixed(1)}%`);
        console.log(`\n✅ Similar memories grouped: ${sim1to2 > 0.6 ? 'YES' : 'NO'}`);
        console.log(`✅ Different topics separated: ${sim1to3 < 0.6 ? 'YES' : 'NO'}`);

        // Test 4: Significance detection
        console.log('\n\n📚 Test 4: Testing significance detection...\n');
        
        const significantGroup = topicGroups.find(g => 
            enhancedStoryAggregator.hasSignificantEvents(g.memories)
        );
        
        if (significantGroup) {
            const events = significantGroup.memories.flatMap(m => m.payload.events || []);
            console.log(`Found significant events: ${events.join(', ')}`);
            const significance = enhancedStoryAggregator.calculateSignificance(
                significantGroup.memories, 
                events
            );
            console.log(`Calculated significance rating: ${significance}/5`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ All tests completed successfully!\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (!error.message.includes('ANTHROPIC_API_KEY') && !error.message.includes('OPENAI_API_KEY')) {
            console.error(error);
        } else {
            console.log('\n💡 Note: Some features require API keys to be set in .env file');
            console.log('   - ANTHROPIC_API_KEY for narrative generation');
            console.log('   - OPENAI_API_KEY for embeddings');
        }
    }
}

// Run the test
testStoryCreation().then(() => process.exit(0)).catch(() => process.exit(1));