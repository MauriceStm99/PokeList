import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const STORAGE_KEY = 'pokemonPurchaseJournal.fallback';
const purchaseForm = document.getElementById('purchase-form');
const purchaseTableBody = document.querySelector('#purchase-table tbody');
const purchaseCount = document.getElementById('purchase-count');
const totalSpent = document.getElementById('total-spent');
const externalPriceUrl = document.getElementById('externalPriceUrl');
const loadExternalPrices = document.getElementById('loadExternalPrices');
const priceChartCanvas = document.getElementById('priceChart');
const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userEmailLabel = document.getElementById('user-email');
const productNameInput = document.getElementById('productName');
const productResults = document.getElementById('product-results');
const cardIdInput = document.getElementById('cardId');
const cardSetInput = document.getElementById('cardSet');
const cardNumberInput = document.getElementById('cardNumber');
const cardImageInput = document.getElementById('cardImage');
const cardmarketUrlInput = document.getElementById('cardmarketUrl');
const categorySelect = document.getElementById('category');
const categoryFilter = document.getElementById('category-filter');
const purchaseSearchInput = document.getElementById('purchase-search');
const purchaseSearchClear = document.getElementById('purchase-search-clear');
const chartControls = document.getElementById('chart-controls');
const chartViewSelect = document.getElementById('chart-view');
const chartTimeframeEl = document.getElementById('chart-timeframe');
const customRangeEl = document.getElementById('custom-range');
const chartFromInput = document.getElementById('chart-from');
const chartToInput = document.getElementById('chart-to');
const chartStatsEl = document.getElementById('chart-stats');
const performersGrid = document.getElementById('performers-grid');
const performersEmpty = document.getElementById('performers-empty');
const topPerformersList = document.getElementById('top-performers');
const flopPerformersList = document.getElementById('flop-performers');

const TIMEFRAMES = [
  { value: '7d', label: '7T', days: 7 },
  { value: '30d', label: '30T', days: 30 },
  { value: '90d', label: '90T', days: 90 },
  { value: '6m', label: '6M', days: 182 },
  { value: '1y', label: '1J', days: 365 },
  { value: 'all', label: 'Alle', days: null },
  { value: 'custom', label: 'Eigener', days: null },
];
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const purchasePriceInput = document.getElementById('purchasePrice');
const purchaseDateInput = document.getElementById('purchaseDate');
const notesInput = document.getElementById('notes');
const receiptFileInput = document.getElementById('receiptFile');

const TCG_API = 'https://api.pokemontcg.io/v2/cards';
const CATEGORIES = [
  'Karten',
  'Booster Pack',
  'Booster Display',
  'Elite Trainer Box',
  'Tin',
  'Mini Tin',
  'Premium Collection',
  'Theme Deck',
  'Special Box',
  'Sonstiges',
];
let selectedCard = null;
let searchAbort = null;
let searchDebounceTimer = null;
let activeCategory = 'all';
let searchTerm = '';
let editingPurchaseId = null;
let chartSelectedCardIds = new Set();
let chartViewMode = 'per-card';
let chartTimeframeValue = 'all';
let chartFromDate = '';
let chartToDate = '';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const purchasesCollection = collection(db, 'purchases');

if (firebaseConfig.measurementId) {
  getAnalytics(app);
}

function clearCardSelection() {
  selectedCard = null;
  cardIdInput.value = '';
  cardSetInput.value = '';
  cardNumberInput.value = '';
  cardImageInput.value = '';
  cardmarketUrlInput.value = '';
}

async function searchCards(term) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  productResults.hidden = false;
  productResults.innerHTML = '<div class="product-results-loading">Suche läuft…</div>';

  try {
    const url = new URL(TCG_API);
    url.searchParams.set('q', `name:"${term}*"`);
    url.searchParams.set('pageSize', '15');
    url.searchParams.set('orderBy', 'name');
    url.searchParams.set('select', 'id,name,number,set,images,cardmarket');

    const response = await fetch(url, { signal: searchAbort.signal });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const json = await response.json();
    renderSearchResults(json.data || []);
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error('Pokemon-TCG-Suche fehlgeschlagen', error);
    productResults.innerHTML = '<div class="product-results-empty">Fehler bei der Suche. Versuche es nochmal.</div>';
  }
}

function renderSearchResults(results) {
  if (results.length === 0) {
    productResults.innerHTML = '<div class="product-results-empty">Keine Karten gefunden.</div>';
    return;
  }

  productResults.innerHTML = '';
  results.forEach((card) => {
    const item = document.createElement('div');
    item.className = 'product-result';

    if (card.images?.small) {
      const img = document.createElement('img');
      img.src = card.images.small;
      img.alt = card.name;
      img.loading = 'lazy';
      item.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'product-result-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'product-result-name';
    nameEl.textContent = card.name;
    const metaEl = document.createElement('div');
    metaEl.className = 'product-result-meta';
    metaEl.textContent = `${card.set?.name ?? 'Unbekanntes Set'} · #${card.number ?? '?'}`;
    info.append(nameEl, metaEl);
    item.appendChild(info);

    const trend = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
    if (trend != null) {
      const priceEl = document.createElement('div');
      priceEl.className = 'product-result-price';
      priceEl.textContent = formatCurrency(trend);
      item.appendChild(priceEl);
    }

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectCard(card);
    });
    productResults.appendChild(item);
  });
}

function selectCard(card) {
  selectedCard = card;
  productNameInput.value = card.name;
  cardIdInput.value = card.id;
  cardSetInput.value = card.set?.name ?? '';
  cardNumberInput.value = card.number ?? '';
  cardImageInput.value = card.images?.small ?? '';
  cardmarketUrlInput.value = card.cardmarket?.url ?? '';
  productResults.hidden = true;
  productResults.innerHTML = '';
}

productNameInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  const term = productNameInput.value.trim();
  if (selectedCard && selectedCard.name !== productNameInput.value) {
    clearCardSelection();
  }
  if (categorySelect.value !== 'Karten') {
    productResults.hidden = true;
    productResults.innerHTML = '';
    return;
  }
  if (term.length < 2) {
    productResults.hidden = true;
    productResults.innerHTML = '';
    return;
  }
  searchDebounceTimer = setTimeout(() => searchCards(term), 300);
});

categorySelect.addEventListener('change', () => {
  const isCard = categorySelect.value === 'Karten';
  productNameInput.placeholder = isCard
    ? 'z. B. Rayquaza'
    : `z. B. ${categorySelect.value}-Name`;
  if (!isCard) {
    clearCardSelection();
    productResults.hidden = true;
    productResults.innerHTML = '';
  }
});

productNameInput.addEventListener('focus', () => {
  if (productResults.children.length > 0) productResults.hidden = false;
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.product-search')) productResults.hidden = true;
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loginError.textContent = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';
    loginError.hidden = false;
    console.error(error);
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

let purchases = [];
let externalHistory = [];
let priceChart;

function loadLocalPurchases() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Fehler beim Laden des lokalen Backups', error);
    return [];
  }
}

function saveLocalPurchases() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(purchases));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function createReceiptLink(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = name ? 'Rechnung ansehen' : 'Anhang öffnen';
  link.className = 'receipt-link';
  return link;
}

function getFilteredPurchases() {
  const term = searchTerm.trim().toLowerCase();
  return purchases.filter((p) => {
    if (activeCategory !== 'all' && (p.category || 'Sonstiges') !== activeCategory) {
      return false;
    }
    if (!term) return true;
    const haystack = [
      p.productName,
      p.category,
      p.cardSet,
      p.cardNumber,
      p.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

purchaseSearchInput.addEventListener('input', () => {
  searchTerm = purchaseSearchInput.value;
  purchaseSearchClear.hidden = searchTerm.length === 0;
  renderPurchases();
});

purchaseSearchClear.addEventListener('click', () => {
  purchaseSearchInput.value = '';
  searchTerm = '';
  purchaseSearchClear.hidden = true;
  purchaseSearchInput.focus();
  renderPurchases();
});

function renderCategoryFilter() {
  const counts = new Map();
  counts.set('all', purchases.length);
  for (const p of purchases) {
    const cat = p.category || 'Sonstiges';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  categoryFilter.innerHTML = '';

  const pills = [
    { value: 'all', label: 'Alle' },
    ...CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  pills.forEach(({ value, label }) => {
    const count = counts.get(value) || 0;
    if (value !== 'all' && count === 0) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-pill' + (activeCategory === value ? ' active' : '');
    btn.dataset.category = value;
    btn.textContent = label;
    const countEl = document.createElement('span');
    countEl.className = 'count';
    countEl.textContent = count;
    btn.appendChild(countEl);
    btn.addEventListener('click', () => {
      activeCategory = value;
      renderPurchases();
    });
    categoryFilter.appendChild(btn);
  });
}

function renderPurchases() {
  purchaseTableBody.innerHTML = '';
  renderCategoryFilter();

  purchases.sort((a, b) => new Date(a.date) - new Date(b.date));
  const filtered = getFilteredPurchases();

  if (filtered.length === 0 && purchases.length > 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 5;
    emptyCell.className = 'no-results';
    emptyCell.textContent = searchTerm
      ? `Keine Treffer für „${searchTerm}".`
      : 'Keine Käufe in dieser Kategorie.';
    emptyRow.appendChild(emptyCell);
    purchaseTableBody.appendChild(emptyRow);
  }

  filtered.forEach((purchase) => {
    const row = document.createElement('tr');

    const productCell = document.createElement('td');
    if (purchase.cardImage) {
      const thumb = document.createElement('img');
      thumb.src = purchase.cardImage;
      thumb.alt = purchase.productName;
      thumb.className = 'card-thumb';
      thumb.loading = 'lazy';
      productCell.appendChild(thumb);
      productCell.appendChild(document.createTextNode(' '));
    }
    const productLabel = document.createElement('span');
    productLabel.textContent = purchase.productName;
    productCell.appendChild(productLabel);
    if (purchase.cardSet || purchase.cardNumber) {
      const meta = document.createElement('div');
      meta.className = 'product-result-meta';
      meta.textContent = [purchase.cardSet, purchase.cardNumber ? `#${purchase.cardNumber}` : null]
        .filter(Boolean)
        .join(' · ');
      productCell.appendChild(meta);
    }
    if (purchase.category) {
      const badge = document.createElement('div');
      const badgeInner = document.createElement('span');
      badgeInner.className = 'category-badge';
      badgeInner.textContent = purchase.category;
      badge.appendChild(badgeInner);
      productCell.appendChild(badge);
    }

    const priceCell = document.createElement('td');
    const ownPrice = document.createElement('div');
    ownPrice.textContent = formatCurrency(purchase.price);
    priceCell.appendChild(ownPrice);

    const latest = (purchase.priceHistory || []).at(-1);
    const trend = latest?.trendPrice ?? latest?.averageSellPrice;
    if (trend != null) {
      const market = document.createElement('div');
      market.className = 'market-price';
      const strong = document.createElement('strong');
      strong.textContent = formatCurrency(trend);
      const label = document.createElement('span');
      label.textContent = 'Cardmarket';
      market.append(strong, label);
      if (purchase.cardmarketUrl) {
        const link = document.createElement('a');
        link.href = purchase.cardmarketUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(market);
        priceCell.appendChild(link);
      } else {
        priceCell.appendChild(market);
      }
    }

    const dateCell = document.createElement('td');
    dateCell.textContent = new Date(purchase.date).toLocaleDateString('de-DE');

    const receiptCell = document.createElement('td');
    if (purchase.receiptUrl) {
      const link = createReceiptLink(purchase.receiptUrl, purchase.receiptName);
      receiptCell.appendChild(link);
    } else {
      receiptCell.textContent = 'Keine';
      receiptCell.style.opacity = '0.75';
    }

    const actionCell = document.createElement('td');
    const actionWrap = document.createElement('div');
    actionWrap.className = 'row-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Bearbeiten';
    editButton.className = 'btn btn-secondary';
    editButton.addEventListener('click', () => startEdit(purchase));
    actionWrap.appendChild(editButton);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Löschen';
    removeButton.className = 'btn btn-secondary';
    removeButton.addEventListener('click', () => removePurchase(purchase.id));
    actionWrap.appendChild(removeButton);

    actionCell.appendChild(actionWrap);

    row.append(productCell, priceCell, dateCell, receiptCell, actionCell);
    purchaseTableBody.appendChild(row);
  });

  purchaseCount.textContent = filtered.length;
  totalSpent.textContent = formatCurrency(filtered.reduce((sum, item) => sum + item.price, 0));
  renderChart();
}

function isFirebaseConfigured() {
  return firebaseConfig && firebaseConfig.projectId && firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
}

async function fetchPurchases() {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase ist nicht konfiguriert, verwende lokales Backup.');
    purchases = loadLocalPurchases();
    renderPurchases();
    return;
  }

  try {
    const snapshot = await getDocs(query(purchasesCollection, orderBy('date', 'asc')));
    purchases = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
    saveLocalPurchases();
  } catch (error) {
    console.warn('Firestore nicht erreichbar, verwende lokales Backup.', error);
    purchases = loadLocalPurchases();
  }

  renderPurchases();
}

function startEdit(purchase) {
  editingPurchaseId = purchase.id;
  categorySelect.value = purchase.category || 'Karten';
  productNameInput.value = purchase.productName || '';
  purchasePriceInput.value = purchase.price ?? '';
  purchaseDateInput.value = purchase.date || '';
  notesInput.value = purchase.notes || '';
  receiptFileInput.value = '';

  cardIdInput.value = purchase.cardId || '';
  cardSetInput.value = purchase.cardSet || '';
  cardNumberInput.value = purchase.cardNumber || '';
  cardImageInput.value = purchase.cardImage || '';
  cardmarketUrlInput.value = purchase.cardmarketUrl || '';
  selectedCard = null;

  submitBtn.textContent = 'Aktualisieren';
  cancelEditBtn.hidden = false;
  purchaseForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  editingPurchaseId = null;
  purchaseForm.reset();
  clearCardSelection();
  submitBtn.textContent = 'Speichern';
  cancelEditBtn.hidden = true;
}

cancelEditBtn.addEventListener('click', cancelEdit);

async function updatePurchaseOnServer(id, updates) {
  if (!isFirebaseConfigured() || String(id).startsWith('local-')) return;
  await updateDoc(doc(db, 'purchases', id), updates);
}

async function syncPriceHistory() {
  const today = new Date().toISOString().slice(0, 10);
  const cardIdsToFetch = new Set();

  for (const purchase of purchases) {
    if (!purchase.cardId) continue;
    const hasToday = (purchase.priceHistory || []).some((entry) => entry.date === today);
    if (!hasToday) cardIdsToFetch.add(purchase.cardId);
  }

  if (cardIdsToFetch.size === 0) return;

  const priceMap = new Map();
  await Promise.all(
    [...cardIdsToFetch].map(async (cardId) => {
      try {
        const response = await fetch(`${TCG_API}/${encodeURIComponent(cardId)}`);
        if (!response.ok) return;
        const json = await response.json();
        const prices = json?.data?.cardmarket?.prices;
        if (prices) priceMap.set(cardId, prices);
      } catch (error) {
        console.warn(`Konnte Cardmarket-Preis für ${cardId} nicht laden`, error);
      }
    }),
  );

  let changed = false;
  for (const purchase of purchases) {
    const prices = purchase.cardId ? priceMap.get(purchase.cardId) : null;
    if (!prices) continue;
    const hasToday = (purchase.priceHistory || []).some((entry) => entry.date === today);
    if (hasToday) continue;

    const updated = [
      ...(purchase.priceHistory || []),
      {
        date: today,
        trendPrice: prices.trendPrice ?? null,
        averageSellPrice: prices.averageSellPrice ?? null,
        lowPrice: prices.lowPrice ?? null,
      },
    ];
    purchase.priceHistory = updated;
    changed = true;

    if (isFirebaseConfigured() && !String(purchase.id).startsWith('local-')) {
      try {
        await updateDoc(doc(db, 'purchases', purchase.id), { priceHistory: updated });
      } catch (error) {
        console.warn('Preis-Historie konnte nicht in Firestore aktualisiert werden', error);
      }
    }
  }

  if (changed) {
    saveLocalPurchases();
    renderPurchases();
  }
}

async function postPurchase(purchase) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase nicht konfiguriert');
  }

  const docRef = await addDoc(purchasesCollection, purchase);
  return { id: docRef.id, ...purchase };
}

async function deletePurchaseFromServer(id) {
  if (!isFirebaseConfigured()) {
    return;
  }

  const purchaseDoc = doc(db, 'purchases', id);
  await deleteDoc(purchaseDoc);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxDimension = 1600, targetBytes = 700 * 1024) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round(height * (maxDimension / width));
      width = maxDimension;
    } else {
      width = Math.round(width * (maxDimension / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > targetBytes && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

async function handleReceiptFile(file) {
  if (!file) return { receiptUrl: null, receiptName: null };

  if (file.type.startsWith('image/')) {
    try {
      const dataUrl = await compressImage(file);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return { receiptUrl: dataUrl, receiptName: `${baseName}.jpg` };
    } catch (error) {
      console.warn('Bild-Komprimierung fehlgeschlagen, speichere Original', error);
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  return { receiptUrl: dataUrl, receiptName: file.name };
}

purchaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(purchaseForm);
  const productName = formData.get('productName').trim();
  const purchasePrice = parseFloat(formData.get('purchasePrice')) || 0;
  const purchaseDate = formData.get('purchaseDate');
  const notes = formData.get('notes').trim();
  const receiptFile = formData.get('receiptFile');

  if (!productName || !purchaseDate || purchasePrice <= 0) {
    return;
  }

  const hasNewFile = receiptFile && receiptFile.name;
  const receipt = hasNewFile
    ? await handleReceiptFile(receiptFile)
    : { receiptUrl: null, receiptName: null };

  if (editingPurchaseId) {
    const existing = purchases.find((p) => p.id === editingPurchaseId);
    if (!existing) {
      cancelEdit();
      return;
    }

    const updates = {
      productName,
      category: categorySelect.value || 'Sonstiges',
      price: purchasePrice,
      date: purchaseDate,
      notes,
      cardId: cardIdInput.value || null,
      cardSet: cardSetInput.value || null,
      cardNumber: cardNumberInput.value || null,
      cardImage: cardImageInput.value || null,
      cardmarketUrl: cardmarketUrlInput.value || null,
    };
    if (hasNewFile) {
      updates.receiptUrl = receipt.receiptUrl;
      updates.receiptName = receipt.receiptName;
    }

    Object.assign(existing, updates);

    try {
      await updatePurchaseOnServer(editingPurchaseId, updates);
    } catch (error) {
      console.warn('Aktualisieren auf Firestore fehlgeschlagen', error);
    }

    saveLocalPurchases();
    cancelEdit();
    renderPurchases();
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const priceHistory = [];
  if (selectedCard?.cardmarket?.prices) {
    priceHistory.push({
      date: today,
      trendPrice: selectedCard.cardmarket.prices.trendPrice ?? null,
      averageSellPrice: selectedCard.cardmarket.prices.averageSellPrice ?? null,
      lowPrice: selectedCard.cardmarket.prices.lowPrice ?? null,
    });
  }

  const purchase = {
    productName,
    category: categorySelect.value || 'Sonstiges',
    price: purchasePrice,
    date: purchaseDate,
    notes,
    receiptUrl: receipt.receiptUrl,
    receiptName: receipt.receiptName,
    cardId: cardIdInput.value || null,
    cardSet: cardSetInput.value || null,
    cardNumber: cardNumberInput.value || null,
    cardImage: cardImageInput.value || null,
    cardmarketUrl: cardmarketUrlInput.value || null,
    priceHistory,
  };

  try {
    const savedPurchase = await postPurchase(purchase);
    purchases.push(savedPurchase);
    saveLocalPurchases();
  } catch (error) {
    console.warn('Speichern auf Firestore fehlgeschlagen, speichere lokal.', error);
    purchases.push({ ...purchase, id: `local-${Date.now()}` });
    saveLocalPurchases();
  }

  purchaseForm.reset();
  clearCardSelection();
  renderPurchases();
});

async function removePurchase(id) {
  if (editingPurchaseId === id) cancelEdit();
  purchases = purchases.filter((purchase) => purchase.id !== id);
  saveLocalPurchases();

  try {
    await deletePurchaseFromServer(id);
  } catch (error) {
    console.warn('Löschen auf Firestore fehlgeschlagen.', error);
  }

  renderPurchases();
}

function parseExternalHistory(data) {
  if (!Array.isArray(data)) {
    throw new Error('Externe Historie muss ein Array sein.');
  }
  return data
    .map((entry) => ({
      date: new Date(entry.date),
      price: Number(entry.price),
    }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()) && !Number.isNaN(entry.price))
    .sort((a, b) => a.date - b.date);
}

async function loadExternalPriceHistory() {
  const url = externalPriceUrl.value.trim();
  if (!url) {
    alert('Bitte gib eine gültige URL zur externen Preishistorie ein.');
    return;
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Fehler: ${response.status}`);
    }
    const json = await response.json();
    externalHistory = parseExternalHistory(json);
    renderChart();
    alert('Externe Preishistorie geladen!');
  } catch (error) {
    console.error(error);
    alert('Die externe Preishistorie konnte nicht geladen werden. Prüfe das Format und die URL.');
  }
}

loadExternalPrices.addEventListener('click', loadExternalPriceHistory);

const CHART_PALETTE = ['#ffcb05', '#83d3a3', '#7b8dff', '#ff8fb1', '#7ae0c8', '#ffa657', '#c89cff', '#ff6b6b'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getDateRange() {
  if (chartTimeframeValue === 'all') return { from: null, to: null };
  if (chartTimeframeValue === 'custom') {
    return { from: chartFromDate || null, to: chartToDate || null };
  }
  const tf = TIMEFRAMES.find((t) => t.value === chartTimeframeValue);
  if (!tf || tf.days == null) return { from: null, to: null };
  return { from: isoDaysAgo(tf.days), to: todayIso() };
}

function dateInRange(date, range) {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function renderTimeframe() {
  chartTimeframeEl.innerHTML = '';
  TIMEFRAMES.forEach((tf) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-pill' + (chartTimeframeValue === tf.value ? ' active' : '');
    btn.textContent = tf.label;
    btn.addEventListener('click', () => {
      chartTimeframeValue = tf.value;
      customRangeEl.hidden = tf.value !== 'custom';
      renderTimeframe();
      renderChart();
    });
    chartTimeframeEl.appendChild(btn);
  });
}

chartViewSelect.addEventListener('change', () => {
  chartViewMode = chartViewSelect.value;
  renderChart();
});

chartFromInput.addEventListener('change', () => {
  chartFromDate = chartFromInput.value;
  renderChart();
});

chartToInput.addEventListener('change', () => {
  chartToDate = chartToInput.value;
  renderChart();
});

renderTimeframe();

function buildCardGroups(sourcePurchases) {
  const groups = new Map();
  for (const p of sourcePurchases) {
    if (!p.cardId) continue;
    if (!groups.has(p.cardId)) {
      groups.set(p.cardId, { id: p.cardId, name: p.productName, history: new Map() });
    }
    const group = groups.get(p.cardId);
    for (const entry of (p.priceHistory || [])) {
      const trend = entry.trendPrice ?? entry.averageSellPrice;
      if (trend != null) group.history.set(entry.date, trend);
    }
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function getCardColor(cardId, allCardIds) {
  const idx = allCardIds.indexOf(cardId);
  return CHART_PALETTE[(idx < 0 ? 0 : idx) % CHART_PALETTE.length];
}

function isCardSelected(cardId) {
  return chartSelectedCardIds.size === 0 || chartSelectedCardIds.has(cardId);
}

function renderChartControls(allGroups) {
  chartControls.innerHTML = '';

  if (allGroups.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'chart-controls-empty';
    empty.textContent = 'Noch keine Karten mit Cardmarket-Daten — speichere einen Kauf der Kategorie „Karten".';
    chartControls.appendChild(empty);
    return;
  }

  const allCardIds = allGroups.map((g) => g.id);

  allGroups.forEach((group) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const active = isCardSelected(group.id);
    chip.className = 'chart-chip' + (active ? ' active' : '');

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = getCardColor(group.id, allCardIds);
    chip.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = group.name;
    chip.appendChild(label);

    chip.addEventListener('click', () => {
      if (chartSelectedCardIds.size === 0) {
        allCardIds.forEach((id) => chartSelectedCardIds.add(id));
      }
      if (chartSelectedCardIds.has(group.id)) {
        chartSelectedCardIds.delete(group.id);
      } else {
        chartSelectedCardIds.add(group.id);
      }
      if (chartSelectedCardIds.size === allCardIds.length) {
        chartSelectedCardIds.clear();
      }
      renderChart();
    });

    chartControls.appendChild(chip);
  });

  if (chartSelectedCardIds.size > 0) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'chart-chip-action';
    allBtn.textContent = 'Alle anzeigen';
    allBtn.addEventListener('click', () => {
      chartSelectedCardIds.clear();
      renderChart();
    });
    chartControls.appendChild(allBtn);
  } else if (allGroups.length > 1) {
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'chart-chip-action';
    noneBtn.textContent = 'Alle ausblenden';
    noneBtn.addEventListener('click', () => {
      chartSelectedCardIds = new Set(['__none__']);
      renderChart();
    });
    chartControls.appendChild(noneBtn);
  }
}

function getPriceAtOrBefore(group, isoDate) {
  let result = null;
  const dates = [...group.history.keys()].sort();
  for (const d of dates) {
    if (d <= isoDate) result = group.history.get(d);
    else break;
  }
  return result;
}

function getLatestPriceInRange(group, range) {
  const dates = [...group.history.keys()].sort();
  if (dates.length === 0) return null;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dateInRange(dates[i], range)) return group.history.get(dates[i]);
  }
  return group.history.get(dates[dates.length - 1]);
}

function computeValueChangeSeries(selectedGroups, purchases, range) {
  const allDates = new Set();
  selectedGroups.forEach((g) => g.history.forEach((_, d) => {
    if (dateInRange(d, range)) allDates.add(d);
  }));
  purchases.forEach((p) => {
    if (p.cardId && isCardSelected(p.cardId) && p.date && dateInRange(p.date, range)) {
      allDates.add(p.date);
    }
  });

  return [...allDates].sort().map((d) => {
    const ownedByCard = new Map();
    let invested = 0;
    purchases.forEach((p) => {
      if (!p.cardId || !isCardSelected(p.cardId)) return;
      if (!p.date || p.date > d) return;
      ownedByCard.set(p.cardId, (ownedByCard.get(p.cardId) || 0) + 1);
      if (typeof p.price === 'number') invested += p.price;
    });

    let portfolio = 0;
    ownedByCard.forEach((qty, cardId) => {
      const group = selectedGroups.find((g) => g.id === cardId);
      if (!group) return;
      const price = getPriceAtOrBefore(group, d);
      if (price != null) portfolio += price * qty;
    });

    return { x: d, y: Number((portfolio - invested).toFixed(2)) };
  });
}

function computeTotalSeries(selectedGroups, qtyByCard, range) {
  const allDates = new Set();
  selectedGroups.forEach((g) => g.history.forEach((_, d) => {
    if (dateInRange(d, range)) allDates.add(d);
  }));
  return [...allDates].sort().map((d) => {
    let total = 0;
    selectedGroups.forEach((g) => {
      const qty = qtyByCard.get(g.id) || 0;
      const price = getPriceAtOrBefore(g, d);
      if (price != null) total += price * qty;
    });
    return { x: d, y: Number(total.toFixed(2)) };
  });
}

function computeStats(visiblePurchases, allGroups, range) {
  const inRange = visiblePurchases.filter((p) =>
    p.date && dateInRange(p.date, range) && (!p.cardId || isCardSelected(p.cardId)),
  );

  const invested = inRange.reduce((s, p) => s + (typeof p.price === 'number' ? p.price : 0), 0);

  const qtyByCard = new Map();
  for (const p of inRange) {
    if (!p.cardId) continue;
    qtyByCard.set(p.cardId, (qtyByCard.get(p.cardId) || 0) + 1);
  }

  let currentValue = 0;
  qtyByCard.forEach((qty, cardId) => {
    const group = allGroups.find((g) => g.id === cardId);
    if (!group) return;
    const latest = getLatestPriceInRange(group, range);
    if (latest != null) currentValue += latest * qty;
  });

  return {
    invested,
    currentValue,
    count: inRange.length,
    delta: currentValue - invested,
  };
}

function renderStats(stats) {
  const items = [
    { label: 'Käufe', value: String(stats.count) },
    { label: 'Investiert', value: formatCurrency(stats.invested) },
    { label: 'Aktueller Wert', value: formatCurrency(stats.currentValue) },
  ];
  if (stats.invested > 0 && stats.currentValue > 0) {
    const pct = (stats.delta / stats.invested) * 100;
    const sign = stats.delta >= 0 ? '+' : '';
    items.push({
      label: 'Wertentwicklung',
      value: `${sign}${formatCurrency(stats.delta)} (${sign}${pct.toFixed(1)}%)`,
      cls: stats.delta >= 0 ? 'stat-delta-positive' : 'stat-delta-negative',
    });
  }

  chartStatsEl.innerHTML = '';
  items.forEach(({ label, value, cls }) => {
    const stat = document.createElement('div');
    stat.className = 'stat';
    const lbl = document.createElement('span');
    lbl.className = 'stat-label';
    lbl.textContent = label;
    const val = document.createElement('strong');
    val.className = 'stat-value' + (cls ? ' ' + cls : '');
    val.textContent = value;
    stat.append(lbl, val);
    chartStatsEl.appendChild(stat);
  });
}

function computePerformers(visiblePurchases, allGroups) {
  const perCard = new Map();
  visiblePurchases.forEach((p) => {
    if (!p.cardId || typeof p.price !== 'number' || p.price <= 0) return;
    if (!perCard.has(p.cardId)) {
      perCard.set(p.cardId, {
        cardId: p.cardId,
        name: p.productName,
        image: p.cardImage,
        cardmarketUrl: p.cardmarketUrl,
        cardSet: p.cardSet,
        cardNumber: p.cardNumber,
        prices: [],
      });
    }
    perCard.get(p.cardId).prices.push(p.price);
  });

  const results = [];
  perCard.forEach((data) => {
    const group = allGroups.find((g) => g.id === data.cardId);
    const latest = group ? getLatestPriceInRange(group, { from: null, to: null }) : null;
    if (latest == null) return;
    const avg = data.prices.reduce((s, x) => s + x, 0) / data.prices.length;
    if (avg <= 0) return;
    const deltaAbs = latest - avg;
    const deltaPct = (deltaAbs / avg) * 100;
    results.push({ ...data, avgPurchase: avg, latest, deltaAbs, deltaPct });
  });

  return results;
}

function renderPerformerRow(entry) {
  const row = document.createElement(entry.cardmarketUrl ? 'a' : 'div');
  row.className = 'performer-row';
  if (entry.cardmarketUrl) {
    row.href = entry.cardmarketUrl;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
  }

  if (entry.image) {
    const img = document.createElement('img');
    img.src = entry.image;
    img.alt = entry.name;
    img.loading = 'lazy';
    row.appendChild(img);
  }

  const info = document.createElement('div');
  info.className = 'performer-info';
  const name = document.createElement('div');
  name.className = 'performer-name';
  name.textContent = entry.name;
  info.appendChild(name);
  if (entry.cardSet || entry.cardNumber) {
    const meta = document.createElement('div');
    meta.className = 'performer-meta';
    meta.textContent = [entry.cardSet, entry.cardNumber ? `#${entry.cardNumber}` : null]
      .filter(Boolean)
      .join(' · ');
    info.appendChild(meta);
  }
  const priceLine = document.createElement('div');
  priceLine.className = 'performer-meta';
  priceLine.textContent = `${formatCurrency(entry.avgPurchase)} → ${formatCurrency(entry.latest)}`;
  info.appendChild(priceLine);
  row.appendChild(info);

  const change = document.createElement('div');
  change.className = 'performer-change ' + (entry.deltaAbs >= 0 ? 'performer-up' : 'performer-down');
  const pct = document.createElement('strong');
  const sign = entry.deltaAbs >= 0 ? '+' : '';
  pct.textContent = `${sign}${entry.deltaPct.toFixed(1)}%`;
  change.appendChild(pct);
  const abs = document.createElement('span');
  abs.textContent = `${sign}${formatCurrency(entry.deltaAbs)}`;
  change.appendChild(abs);
  row.appendChild(change);

  return row;
}

function renderPerformers(visiblePurchases, allGroups) {
  const performers = computePerformers(visiblePurchases, allGroups);
  if (performers.length === 0) {
    performersGrid.hidden = true;
    performersEmpty.hidden = false;
    return;
  }

  performersEmpty.hidden = true;
  performersGrid.hidden = false;

  const sorted = [...performers].sort((a, b) => b.deltaPct - a.deltaPct);
  const top = sorted.filter((p) => p.deltaPct > 0).slice(0, 5);
  const flop = [...sorted].filter((p) => p.deltaPct < 0).sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 5);

  topPerformersList.innerHTML = '';
  flopPerformersList.innerHTML = '';

  if (top.length === 0) {
    const li = document.createElement('li');
    li.className = 'performer-meta';
    li.textContent = 'Noch keine Karte im Plus.';
    topPerformersList.appendChild(li);
  } else {
    top.forEach((entry) => {
      const li = document.createElement('li');
      li.appendChild(renderPerformerRow(entry));
      topPerformersList.appendChild(li);
    });
  }

  if (flop.length === 0) {
    const li = document.createElement('li');
    li.className = 'performer-meta';
    li.textContent = 'Keine Karte im Minus.';
    flopPerformersList.appendChild(li);
  } else {
    flop.forEach((entry) => {
      const li = document.createElement('li');
      li.appendChild(renderPerformerRow(entry));
      flopPerformersList.appendChild(li);
    });
  }
}

function renderChart() {
  const visiblePurchases = getFilteredPurchases();
  const allGroups = buildCardGroups(visiblePurchases);
  renderChartControls(allGroups);
  renderPerformers(visiblePurchases, allGroups);

  const range = getDateRange();
  const allCardIds = allGroups.map((g) => g.id);
  const selectedGroups = allGroups.filter((g) => isCardSelected(g.id));
  const datasets = [];

  const qtyByCard = new Map();
  for (const p of visiblePurchases) {
    if (!p.cardId || !isCardSelected(p.cardId)) continue;
    if (p.date && !dateInRange(p.date, range)) continue;
    qtyByCard.set(p.cardId, (qtyByCard.get(p.cardId) || 0) + 1);
  }

  if (chartViewMode === 'total') {
    const series = computeTotalSeries(selectedGroups, qtyByCard, range);
    if (series.length > 0) {
      datasets.push({
        label: 'Portfolio-Wert',
        data: series,
        borderColor: '#83d3a3',
        backgroundColor: 'rgba(131, 211, 163, 0.22)',
        tension: 0.3,
        pointRadius: 3,
        fill: true,
      });
    }
  } else if (chartViewMode === 'value-change') {
    const series = computeValueChangeSeries(selectedGroups, visiblePurchases, range);
    if (series.length > 0) {
      datasets.push({
        label: 'Wertentwicklung (€)',
        data: series,
        borderColor: '#7ae0c8',
        backgroundColor: 'rgba(122, 224, 200, 0.18)',
        tension: 0.3,
        pointRadius: 3,
        fill: true,
      });
    }
  } else if (chartViewMode === 'pnl') {
    selectedGroups.forEach((group) => {
      const matching = visiblePurchases.filter((p) => p.cardId === group.id && typeof p.price === 'number');
      if (matching.length === 0) return;
      const avg = matching.reduce((s, p) => s + p.price, 0) / matching.length;
      const dates = [...group.history.keys()].sort().filter((d) => dateInRange(d, range));
      if (dates.length === 0) return;
      const color = getCardColor(group.id, allCardIds);
      datasets.push({
        label: `${group.name} · G/V`,
        data: dates.map((d) => ({ x: d, y: Number((group.history.get(d) - avg).toFixed(2)) })),
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.3,
        pointRadius: 4,
        fill: false,
      });
    });
  } else {
    selectedGroups.forEach((group) => {
      const dates = [...group.history.keys()].sort().filter((d) => dateInRange(d, range));
      if (dates.length === 0) return;
      const color = getCardColor(group.id, allCardIds);
      datasets.push({
        label: `${group.name} · Cardmarket`,
        data: dates.map((d) => ({ x: d, y: group.history.get(d) })),
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.3,
        pointRadius: 4,
        fill: false,
      });
    });

    const purchasePoints = visiblePurchases
      .filter((p) =>
        typeof p.price === 'number' &&
        p.date &&
        dateInRange(p.date, range) &&
        (!p.cardId || isCardSelected(p.cardId)),
      )
      .map((p) => ({ x: p.date, y: p.price }));
    if (purchasePoints.length > 0) {
      datasets.push({
        type: 'scatter',
        label: 'Deine Käufe',
        data: purchasePoints,
        backgroundColor: '#ff6b6b',
        borderColor: '#ff6b6b',
        pointRadius: 7,
        pointHoverRadius: 9,
        pointStyle: 'triangle',
      });
    }

    if (externalHistory.length > 0) {
      const extData = externalHistory
        .map((e) => ({ x: e.date.toISOString().slice(0, 10), y: e.price }))
        .filter((d) => dateInRange(d.x, range));
      if (extData.length > 0) {
        datasets.push({
          label: 'Externe Preishistorie',
          data: extData,
          borderColor: '#7b8dff',
          backgroundColor: 'rgba(123,141,255,0.18)',
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 4,
          fill: false,
        });
      }
    }
  }

  renderStats(computeStats(visiblePurchases, allGroups, range));

  const yCallback = (chartViewMode === 'pnl' || chartViewMode === 'value-change')
    ? (v) => `${v >= 0 ? '+' : ''}€${v}`
    : (v) => `€${v}`;

  const chartData = { datasets };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#d8e6ff' } },
      tooltip: { mode: 'nearest', intersect: false },
    },
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', tooltipFormat: 'dd.MM.yyyy', displayFormats: { day: 'dd.MM.yy' } },
        ticks: { color: '#c7d2ff' },
        grid: { color: 'rgba(255,255,255,0.08)' },
        min: range.from || undefined,
        max: range.to || undefined,
      },
      y: {
        ticks: { color: '#c7d2ff', callback: yCallback },
        grid: { color: 'rgba(255,255,255,0.08)' },
      },
    },
  };

  if (priceChart) {
    priceChart.data = chartData;
    priceChart.options = chartOptions;
    priceChart.update();
    return;
  }

  priceChart = new Chart(priceChartCanvas.getContext('2d'), {
    type: 'line',
    data: chartData,
    options: chartOptions,
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.hidden = true;
    loginScreen.style.display = 'none';
    appShell.hidden = false;
    appShell.style.display = '';
    userEmailLabel.textContent = user.email ?? '';
    loginForm.reset();
    fetchPurchases().then(() => syncPriceHistory());
  } else {
    appShell.hidden = true;
    appShell.style.display = 'none';
    loginScreen.hidden = false;
    loginScreen.style.display = '';
    purchases = [];
    cancelEdit();
    renderPurchases();
  }
});
