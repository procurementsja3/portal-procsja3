import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static assets
app.use(express.static(__dirname));

// Primary landing page (Portal Procurement)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Direct routes for conveniences
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/procurement', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/procurementsja3', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Standalone SIBIKOM route
app.get('/sibikom', (req, res) => {
  res.sendFile(path.join(__dirname, 'sibikom.html'));
});

// Fallback to Portal Procurement
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
