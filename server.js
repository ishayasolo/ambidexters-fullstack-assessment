const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/transactions', require('./src/routes/transactions'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
