const fetch = require('node-fetch');

async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Analyze the Nuggets vs Suns game',
                conversationId: 'test-conv-id',
                userId: 'test-user-id',
                // Add other fields if needed by the schema, but these seem to be the required ones checked early
            })
        });

        if (!response.ok) {
            console.error('Error status:', response.status);
            const text = await response.text();
            console.error('Error body:', text);
            return;
        }

        const text = await response.text();
        console.log('Response:', text.substring(0, 2000));
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

test();
