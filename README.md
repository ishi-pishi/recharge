# Recharge
Welcome to Recharge, the app that helps you rebalance your life before burnout.

Made for the cmd-f hackathon 2026, Recharge tracks your hours spent on different areas of life (e.g. work, sleep, exercise) to predict your risk of burnout and provide personalized tips based on your schedule.

Check out the demo here: https://www.youtube.com/watch?v=-TbMXWKPGuk&source_ve_path=MjE0Mjgz&embeds_referring_euri=https%3A%2F%2Fdevpost.com%2F 

## Features
- Activity tracker, where users can log time spent on different categories
- Calendar integration, which automatically pulls events from the user's calendar app, and uses API to categorize them
- Burnout prediction score + personalized tips based on their schedule

## Architecture
- This app uses **React/Vite/Tailwind**, **Firebase Auth**, and **Gemini API**.
- If on mobile, it uses **Async Storage** and on a computer, it uses **Firebase Firestore** to store data.

To run the project locally:
-Run `npm install`
-Fill in `.env` with your own API Keys (you may have to start your own firebase project/create your own Gemini)
-Run `npx expo start --tunnel` and scan the QR code
