const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'purchases.json');

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname)));

async function readPurchases() {
  try {
    const content = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writePurchases(purchases) {
  await fs.writeFile(dataFile, JSON.stringify(purchases, null, 2), 'utf8');
}

app.get('/api/purchases', async (req, res) => {
  try {
    const purchases = await readPurchases();
    res.json(purchases);
  } catch (error) {
    console.error('Error reading purchases:', error);
    res.status(500).json({ message: 'Fehler beim Laden der Käufe.' });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { productName, price, date, notes, receiptUrl, receiptName } = req.body;
    if (!productName || !date || typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ message: 'Ungültige Kaufdaten.' });
    }

    const purchases = await readPurchases();
    const newPurchase = {
      id: randomUUID(),
      productName,
      price,
      date,
      notes: notes || '',
      receiptUrl: receiptUrl || null,
      receiptName: receiptName || null,
      createdAt: new Date().toISOString(),
    };

    purchases.push(newPurchase);
    await writePurchases(purchases);
    res.status(201).json(newPurchase);
  } catch (error) {
    console.error('Error saving purchase:', error);
    res.status(500).json({ message: 'Fehler beim Speichern des Kaufs.' });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const purchases = await readPurchases();
    const filtered = purchases.filter((purchase) => purchase.id !== id);

    if (filtered.length === purchases.length) {
      return res.status(404).json({ message: 'Kauf nicht gefunden.' });
    }

    await writePurchases(filtered);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ message: 'Fehler beim Löschen des Kaufs.' });
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
