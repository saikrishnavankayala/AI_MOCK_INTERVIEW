# Deploying to Netlify

This document provides instructions for deploying the AI Interview application frontend to Netlify.

## Prerequisites

1. A Netlify account
2. Git repository with your project

## Deployment Steps

### Option 1: Deploy via Netlify UI

1. Log in to your Netlify account
2. Click "New site from Git"
3. Connect to your Git provider (GitHub, GitLab, or Bitbucket)
4. Select your repository
5. Configure build settings:
   - Base directory: `frontend/project`
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy site"

### Option 2: Deploy via Netlify CLI

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login to Netlify: `netlify login`
3. Initialize your site: `netlify init`
4. Follow the prompts to configure your site
5. Deploy your site: `netlify deploy --prod`

## Environment Variables

You need to configure the following environment variables in Netlify:

- `VITE_API_BASE_URL`: The URL of your backend API

To set environment variables in Netlify:

1. Go to Site settings > Build & deploy > Environment
2. Click "Edit variables"
3. Add your environment variables

## Backend Deployment

Note that the frontend deployment on Netlify will need to connect to your backend API. You'll need to:

1. Deploy your Flask backend to a hosting service (Heroku, AWS, etc.)
2. Update the `VITE_API_BASE_URL` environment variable in Netlify to point to your deployed backend
3. Ensure CORS is properly configured on your backend to accept requests from your Netlify domain

## Troubleshooting

- If you encounter routing issues, check that the redirects in `netlify.toml` are correctly configured
- For build errors, check the build logs in Netlify
- For API connection issues, verify your environment variables and CORS configuration