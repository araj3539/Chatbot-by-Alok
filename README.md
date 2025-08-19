🤖 Chatbot-by-Alok
A sleek, responsive, and intelligent AI Tutor chatbot built with modern web technologies and powered by the Google Gemini API.
> This project is a fully-featured chatbot application designed to serve as an intelligent study companion. It leverages the power of large language models to provide explanations, solve problems, and offer motivational support in a clean, conversational interface.
> 
✨ Features
 * 🧠 Intelligent Conversations: Leverages the Gemini API for context-aware, human-like responses across various subjects.
 * 🗂️ Dynamic Chat History: Automatically saves conversations to local storage, allowing users to revisit and continue previous sessions.
 * ✍️ Automatic Chat Titling: Intelligently renames new chats from a generic title to a relevant topic based on the conversation's context.
 * 🔒 Secure API Handling: API keys are kept 100% secure using a serverless function proxy, ensuring they are never exposed on the client-side.
 * 📱 Fully Responsive: A beautiful and modern UI that works seamlessly on desktop and mobile devices, featuring a collapsible sidebar.
 * 📄 Markdown Rendering: Bot responses are parsed as Markdown, allowing for rich text formatting like lists, code blocks, and more.
 * 🎨 Sleek UI/UX: Includes a typing indicator, smooth scrolling, and a clean design for an excellent user experience.
🛠️ Tech Stack
 * Frontend: HTML5, Tailwind CSS, JavaScript (ES6+)
 * AI: Google Gemini API
 * Deployment: Vercel
 * Libraries:
   * Marked.js for Markdown parsing
   * Font Awesome for icons
🚀 Deployment
Deploying this project is simple and straightforward with Vercel.
Deploy with Vercel
Click the button below to deploy this project to your own Vercel account in seconds.
Configuration
After deploying, you must add your Gemini API key to make the chatbot functional. This is the only configuration step required.
 * In your new Vercel project dashboard, navigate to the Settings tab.
 * Go to the Environment Variables section.
 * Create a new variable with the following details:
   * Name: GEMINI_API_KEY
   * Value: Your_Secret_Gemini_API_Key_Goes_Here
 * Save the variable. Vercel will automatically redeploy your project with the new environment variable applied.
Your chatbot is now live and securely configured!
