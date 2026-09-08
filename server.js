import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static assets
app.use(express.static(__dirname));

// Direct routes for conveniences
app.get('/procurementsja3', (req, res) => {
  res.sendFile(path.join(__dirname, 'procurementsja3.html'));
});

app.get('/sibikom', (req, res) => {
  res.sendFile(path.join(__dirname, 'sibikom.html'));
});

// Primary landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'sibikom.html'));
});

// Fallback to sibikom.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'sibikom.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
