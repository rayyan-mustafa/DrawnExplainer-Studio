# RMagine Master - Video Production Studio

A modern AI video production pipeline for scripted documentary storytelling, scene rendering, voice synthesis, and video generation.

## Prerequisites

- [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
- API Keys:
  - **OpenRouter API Key** (or Gemini Key via OpenRouter) for scriptwriting & scene generation
  - **OpenAI API Key** for realistic TTS voice narration
  - **Wavespeed API Key** for Flux image & WAN video generation

## Quick Setup Guide

1. **Clone or Download Repository**
   ```bash
   git clone <repo-url>
   cd <project-folder>
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Copy or rename `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in your keys:
     ```env
     OPENROUTER_API_KEY=your_openrouter_api_key
     OPENAI_API_KEY=your_openai_api_key
     WAVESPEED_API_KEY=your_wavespeed_api_key
     ```
   *(Note: `.env` is ignored by `.gitignore` so your personal keys will never be pushed to GitHub.)*

4. **Start the Application**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser. The header will show how many of your API keys are actively connected.

## Deploying to Netlify

This project is fully configured for Netlify:

1. **Push your repository to GitHub**.
2. Go to [Netlify](https://app.netlify.com/) and click **"Add new site" > "Import an existing project"**.
3. Select your GitHub repository. Netlify will automatically detect the settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. Go to **Site Configuration > Environment Variables** and add your secret keys:
   - `OPENROUTER_API_KEY`
   - `OPENAI_API_KEY`
   - `WAVESPEED_API_KEY`
5. Click **Deploy**. Netlify will build the frontend and serve the `/api/*` backend routes using Netlify Functions.
