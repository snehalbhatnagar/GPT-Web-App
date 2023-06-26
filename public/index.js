const conversationElement = document.getElementById('conversation');
const startButton = document.getElementById('start-btn');
const stopButton = document.getElementById('stop-btn');

const recognition = new webkitSpeechRecognition();

startButton.addEventListener('click', () => {
  console.log("Listening...");
  recognition.start(); // Start speech recognition when the start button is clicked
});

stopButton.addEventListener('click', () => {
  console.log("Stopped");
  recognition.stop(); // Stop speech recognition when the stop button is clicked      
});

recognition.addEventListener('result', (event) => {
  const transcript = event.results[0][0].transcript; // Get the transcribed text
  console.log('Transcript:', transcript);  
  generateGPTResponse(transcript); // Pass the transcript to the GPT-3.5 processing function
  displayResponse(transcript, "You: ");
});

recognition.addEventListener('error', (event) => {
  console.error('Speech recognition error:', event.error);
});

recognition.addEventListener('end', () => {
  console.log("End of speech recognition");      
});


function generateGPTResponse(prompt) {
    fetch('/api/key') // Fetch the API key from the server
      .then(response => response.json())
      .then(data => {
        const apiKey = data.apiKey; // Retrieve the API key from the response
        // Use the apiKey in the API request
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` // Pass the API key 
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo', // Specify the model name
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: prompt }
            ]
          })
        })
          .then(response => response.json())
          .then(result => {
            console.log('GPT response:', result);
            const gptResponse = result.choices[0].message.content; // Extract the GPT response from the API response
            displayResponse(gptResponse, "Bot: "); // Display the GPT response
            convertTextToSpeech(gptResponse); // Convert the response to speech
          })
          .catch(error => {
            console.error('Error:', error);
            // Handle the error
          });
      })
      .catch(error => {
        console.error('Error fetching API key:', error);
        // Handle the error
      });
  }
  




function displayResponse(response, user) {
  const conversationElement = document.getElementById('conversation');
  const responseElement = document.createElement('p');
  responseElement.textContent = user + response;
  conversationElement.appendChild(responseElement);
}

function convertTextToSpeech(text) {
  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  synthesis.speak(utterance);
}
