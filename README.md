## Galaxy Watch Team Dashboard

This project is a small web app that takes CSV files exported from a Galaxy 8 watch and produces **four role-based dashboards**:

- **Coach view**
- **Trainer view**
- **Team doctor view** (with medical warnings)
- **Athlete view**

It uses **plain HTML, CSS, and JavaScript** so it can be deployed as a static site on Vercel.

### Project structure

- `index.html` – main UI and layout
- `styles.css` – professional, responsive styling
- `app.js` – CSV parsing, data processing, and role-specific rendering
- `data/athlete_alex.csv` – sample data for Athlete 1
- `data/athlete_jordan.csv` – sample data for Athlete 2

### Metrics supported

From the CSV files:

- Steps  
- Calories  
- Active minutes  
- Heart rate  
- ECG  
- Blood oxygen (SpO2)  
- Menstrual cycle (as menstrual phase)  
- Stress levels  
- Body composition (body fat %, muscle mass kg)  
- Sleep stages (deep, light, REM, awake)  
- Sleep apnea (events per night)  
- Blood pressure (systolic/diastolic)  
- Energy score  
- Antioxidant index (carotenoids)  
- Fall detection  

### Running locally

1. Open the project folder in your editor (this folder).
2. Use any simple static server (for example, with Node.js installed):

   ```bash
   npx serve .
   ```

3. Open the printed `http://localhost:...` URL in your browser.
4. The app will automatically load the two sample athletes; you can also upload your own CSV files with the same columns.

### Deploying on Vercel

1. Install the Vercel CLI if you don’t have it:

   ```bash
   npm install -g vercel
   ```

2. From this project folder, run:

   ```bash
   vercel
   ```

3. When asked for the project type, choose a **static**/front-end project (no framework detection needed).
4. Vercel will upload `index.html`, `styles.css`, `app.js`, and the `data` folder and give you a deployment URL.

