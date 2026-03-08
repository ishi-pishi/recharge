Hi Antigravity,

I will give you the layout, but I need you to make an app for me. This is a mobile app and so you will need to use React Native.

The app's premise is to let users track their schedule in main chunks/activities, and then let AI (just a simple text model/LLM) analyze their activity to predict how close to burnout they are. For example, in a day where a user has no sleep, lots of work, and no leisure, that will contribute negatively to their score.

First, you need to implement the backend capabilities. You will need to use authentication and storage; if you are comfortable with firebase, use it, but if you are not, use supabase or any other backend you are comfortable with (based on your training data). Stick with one sign-in/sign-up method for now, such as signing up with google. So you will want one very neat login page.

Once you login, I want it to take you to a schedule overview page. It needs a nice empty page saying "no schedule yet" if you've done nothing today, and it needs to let you scroll between days. It should have an add button somewhere clear on the screen to allow you to press, add an activity, and complete it. For now, just let the activity names be the basic premises of burnout: work, sleep, exercise, socializing, and leisure/self-care. So, in the plus button, you can select one of those 5 activities, and add a start/end duration and complete it. Once you add something, it should be visible on your schedule page, like a calendar app. There is also a second button identical to the + button which has a clock on it - this is to take you to a timer where you can literally log where you start/end an activity and choose to log it or not.

Then, there should be another tab with a navbar on the bottom of the phone screen. The first tab obviously is the "Schedule" page which shows you what you've been doing. The second tab will take you to a second page where you can generate an AI-based suggestion of what you're doing using Gemini (I have free credits) and provide you an ai-based burnout score. This is based on the last 1 week of your activities, so it looks the user's last 7 days worth of schedule.

The last, fourth tab should let you select obviously a sign out tab, which links to a nice sign out page.