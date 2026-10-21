// Store items and people
let items = [];
let people = new Set();

// Store parsed items from receipt
let parsedItems = [];

// DOM elements
const addItemBtn = document.getElementById('add-item-btn');
const itemsContainer = document.getElementById('items-container');
const totalPaidInput = document.getElementById('total-paid');
const resultsContainer = document.getElementById('results-container');
const itemPriceInput = document.getElementById('item-price');
const itemPersonInput = document.getElementById('item-person');
const billNameInput = document.getElementById('bill-name');
const saveBillBtn = document.getElementById('save-bill-btn');
const savedBillsList = document.getElementById('saved-bills-list');

// Receipt upload elements
const receiptUpload = document.getElementById('receipt-upload');
const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
const receiptPreview = document.getElementById('receipt-preview');
const receiptImage = document.getElementById('receipt-image');
const parseReceiptBtn = document.getElementById('parse-receipt-btn');
const cancelUploadBtn = document.getElementById('cancel-upload-btn');
const parsingStatus = document.getElementById('parsing-status');
const parsedItemsSection = document.getElementById('parsed-items-section');
const parsedItemsContainer = document.getElementById('parsed-items-container');
const addAllParsedBtn = document.getElementById('add-all-parsed-btn');
const clearParsedBtn = document.getElementById('clear-parsed-btn');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Event listeners
addItemBtn.addEventListener('click', addItem);
totalPaidInput.addEventListener('input', calculateResults);
saveBillBtn.addEventListener('click', saveBill);

// Tab switching
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update active tab button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active tab content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (targetTab === 'current' && content.id === 'current-bill') {
                content.classList.add('active');
            } else if (targetTab === 'saved' && content.id === 'saved-bills') {
                content.classList.add('active');
            }
        });

        // Refresh saved bills list when switching to saved tab
        if (targetTab === 'saved') {
            displaySavedBills();
        }
    });
});

// Allow Enter key to add item
itemPriceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addItem();
        itemPriceInput.focus();
    }
});

itemPersonInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addItem();
        itemPriceInput.focus();
    }
});

// Initialize display
displayItems();

// Receipt extraction is a draft; importing never discards unresolved rows.
let uploadedFile = null;
let receiptSummary = null;
let scanVersion = 0;
const reviewSummary = document.getElementById('review-summary');
const reviewStatus = document.getElementById('review-status');
const useReceiptTotalBtn = document.getElementById('use-receipt-total');
const reviewAddBtn = document.getElementById('review-add-item');

function resetReceipt() {
    scanVersion++;
    parsedItems = [];
    receiptSummary = null;
    parsedItemsSection.style.display = 'none';
    parsingStatus.textContent = '';
    uploadReceiptBtn.disabled = false;
    parseReceiptBtn.disabled = false;
}

uploadReceiptBtn.addEventListener('click', () => {
    if (parsedItems.length && !confirm('Replace the receipt draft and its remaining items?')) return;
    receiptUpload.click();
});
receiptUpload.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        document.getElementById('scan-service-note').textContent = 'Choose an image under 10 MB (PNG, JPEG, WebP, BMP, or GIF).';
        receiptUpload.value = '';
        return;
    }
    resetReceipt();
    uploadedFile = file;
    const version = scanVersion;
    const reader = new FileReader();
    reader.onload = event => {
        if (version !== scanVersion) return;
        receiptImage.src = event.target.result;
        receiptPreview.style.display = 'block';
    };
    reader.onerror = () => { parsingStatus.textContent = 'Could not read the image. Try another photo.'; };
    reader.readAsDataURL(file);
});
cancelUploadBtn.addEventListener('click', () => {
    if (parsedItems.length && !confirm('Discard the receipt draft?')) return;
    resetReceipt();
    receiptUpload.value = '';
    uploadedFile = null;
    receiptImage.removeAttribute('src');
    receiptPreview.style.display = 'none';
});

async function scanReceipt() {
    if (!uploadedFile) return;
    if (parsedItems.length && !confirm('Replace your current receipt draft with a new scan?')) return;
    const version = ++scanVersion;
    parseReceiptBtn.disabled = true;
    uploadReceiptBtn.disabled = true;
    parsingStatus.textContent = 'Loading on-device OCR…';
    try {
        if (typeof Tesseract === 'undefined') throw new Error('OCR did not load. Check your connection and refresh.');
        const result = await Tesseract.recognize(uploadedFile, 'eng', {
            logger: message => {
                if (version === scanVersion && message.status === 'recognizing text')
                    parsingStatus.textContent = `Reading text: ${Math.round((message.progress || 0) * 100)}%`;
            }
        });
        const text = result?.data?.text || '';
        const receipt = {items: parseReceiptText(text), warnings: ['On-device OCR is less precise. Compare each item with the image.']};
        for (const [key, pattern] of Object.entries({subtotal: /^sub\s*total/i, tax: /^tax\b/i, tip: /^(tip|gratuity)\b/i, total: /^(grand\s+total|total|amount\s+paid)\b/i})) {
            const line = text.split('\n').find(line => pattern.test(line.trim()));
            const amount = line?.match(/(\d+[.,]\d{2})\s*$/);
            receipt[key] = amount ? Number(amount[1].replace(',', '.')) : null;
        }
        if (version !== scanVersion) return;
        if (!Array.isArray(receipt.items)) throw new Error('Could not read receipt items. Try a clearer photo.');
        receiptSummary = receipt;
        parsedItems = receipt.items.map(item => ({
            name: item.name || 'Unnamed item', quantity: item.quantity ?? null,
            price: Number.isFinite(item.price) ? item.price : 0,
            needsReview: Boolean(item.needsReview || item.price == null), people: []
        }));
        displayParsedItems();
        parsedItemsSection.style.display = 'block';
        parsingStatus.textContent = `Found ${parsedItems.length} items. Review them below before adding.`;
    } catch (error) {
        if (version !== scanVersion) return;
        parsingStatus.textContent = 'Could not scan the receipt: ' + error.message;
    } finally {
        if (version === scanVersion) {
            parseReceiptBtn.disabled = false;
            uploadReceiptBtn.disabled = false;
        }
    }
}
parseReceiptBtn.addEventListener('click', scanReceipt);

addAllParsedBtn.addEventListener('click', () => {
    const ready = parsedItems.filter(item => Number.isFinite(item.price) && item.price > 0);
    ready.forEach(item => {
        items.push({id: Date.now() + Math.random(), name: item.name, quantity: item.quantity, price: item.price, people: [...item.people]});
        item.people.forEach(person => people.add(person));
    });
    parsedItems = parsedItems.filter(item => !ready.includes(item));
    calculateResults();
    displayParsedItems();
    reviewStatus.textContent = `${ready.length} item(s) added. ${parsedItems.length ? 'Remaining items are kept here for review.' : 'All reviewed items are in your bill.'}`;
});
clearParsedBtn.addEventListener('click', () => {
    if (parsedItems.length && !confirm('Discard the remaining receipt items?')) return;
    parsedItems = [];
    parsedItemsSection.style.display = 'none';
});
reviewAddBtn.addEventListener('click', () => {
    parsedItems.push({name: '', quantity: 1, price: 0, people: []});
    displayParsedItems();
});
useReceiptTotalBtn.addEventListener('click', () => {
    if (!receiptSummary || !(receiptSummary.total > 0)) return;
    if (totalPaidInput.value && !confirm('Replace the current total paid with the detected receipt total?')) return;
    totalPaidInput.value = receiptSummary.total.toFixed(2);
    calculateResults();
    reviewStatus.textContent = 'Detected total applied. Confirm it includes the tip you actually paid.';
});

// Add a new item from the form inputs
function addItem() {
    const price = Number(itemPriceInput.value);
    if (!Number.isFinite(price) || price <= 0) {
        showFlowError('Enter an item price greater than zero.');
        return;
    }
    items.push({id: Date.now() + Math.random(), price,
        name: document.getElementById('item-name').value.trim(), people: []});
    itemPriceInput.value = '';
    document.getElementById('item-name').value = '';
    clearFlowError();
    displayItems();
}

// Display all items on the right side (read-only)
function displayItems() {
    if (items.length === 0) {
        itemsContainer.innerHTML = '<p class="placeholder">No items added yet</p>';
        return;
    }

    let itemsHTML = '';
    items.forEach(item => {
        const totalPaid = parseFloat(totalPaidInput.value) || 0;
        const subtotal = items.reduce((sum, i) => sum + (i.price || 0), 0);
        const finalPrice = subtotal > 0 && totalPaid > 0
            ? (item.price / subtotal) * totalPaid
            : item.price;

        const peopleList = item.people || (item.person ? [item.person] : []); // Support both old and new format
        const peopleDisplay = peopleList.length > 0
            ? peopleList.map(p => escapeHtml(p)).join(', ')
            : 'Assign in the next step';

        itemsHTML += `
            <div class="item-display">
                <div class="item-info">
                    <span class="item-price-display">${item.name ? escapeHtml(item.name) + ' · ' : ''}$${item.price.toFixed(2)}</span>
                    <span class="item-person-display ${peopleList.length === 0 ? 'no-person' : ''}">${peopleDisplay}</span>
                </div>

                <button type="button" class="btn btn-danger remove-item" data-id="${item.id}">Remove</button>
            </div>
        `;
    });

    itemsContainer.innerHTML = itemsHTML;

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idValue = btn.getAttribute('data-id');
            if (idValue) {
                // Try to parse as number (could be integer or float)
                const id = parseFloat(idValue);
                if (!isNaN(id)) {
                    removeItem(id);
                }
            }
        });
    });
}

// Remove an item
function removeItem(id) {
    // Normalize ID for comparison (handle both number and string)
    const normalizedId = typeof id === 'string' ? parseFloat(id) : id;

    const item = items.find(i => Math.abs(i.id - normalizedId) < 0.001); // Handle float comparison
    if (item) {
        const peopleList = item.people || (item.person ? [item.person] : []);
        // Check if each person has other items
        peopleList.forEach(person => {
            const hasOtherItems = items.some(i =>
                Math.abs(i.id - normalizedId) >= 0.001 && // Different item
                (i.people?.includes(person) || i.person === person)
            );
            if (!hasOtherItems) {
                people.delete(person);
            }
        });
    }

    items = items.filter(i => Math.abs(i.id - normalizedId) >= 0.001);
    displayItems();
    calculateResults();
}

// Calculate results
function calculateResults() {
    // Refresh items display to show updated final prices
    displayItems();

    const totalPaid = parseFloat(totalPaidInput.value) || 0;

    // Calculate subtotal (sum of all item prices)
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);

    if (subtotal === 0 || totalPaid === 0 || items.length === 0) {
        resultsContainer.innerHTML = '<p class="placeholder">Add items and enter total to see results</p>';
        return;
    }

    // Calculate proportion and final price for each item
    const itemsWithFinalPrice = items.map(item => {
        if (item.price === 0) return null;

        const proportion = item.price / subtotal;
        const finalPrice = proportion * totalPaid;

        return {
            ...item,
            proportion,
            finalPrice
        };
    }).filter(item => item !== null);

    // Group by person and sum (with even splitting for multiple people)
    const personTotals = {};
    itemsWithFinalPrice.forEach(item => {
        const peopleList = item.people || (item.person ? [item.person] : []);

        if (peopleList.length > 0) {
            // Split the final price evenly among all people assigned to this item
            const pricePerPerson = item.finalPrice / peopleList.length;

            peopleList.forEach(person => {
                if (!personTotals[person]) {
                    personTotals[person] = 0;
                }
                personTotals[person] += pricePerPerson;
            });
        }
    });

    // Display results
    if (Object.keys(personTotals).length === 0) {
        resultsContainer.innerHTML = '<p class="placeholder">Add people to items to see who owes what</p>';
        return;
    }

    let resultsHTML = '';

    // Sort people alphabetically
    const sortedPeople = [...new Set([...Object.keys(personTotals), ...dinnerGuests])].sort();

    sortedPeople.forEach(person => {
        const amount = personTotals[person] || 0;
        resultsHTML += `
            <div class="person-result">
                <span class="person-name">${escapeHtml(person)}</span>
                <span class="person-amount">$${amount.toFixed(2)}</span>
            </div>
        `;
    });

    // Add total summary
    const calculatedTotal = Object.values(personTotals).reduce((sum, amt) => sum + amt, 0);
    resultsHTML += `
        <div class="total-summary">
            <div class="label">Total Calculated</div>
            <div class="amount">$${calculatedTotal.toFixed(2)}</div>
        </div>
    `;

    resultsContainer.innerHTML = resultsHTML;
}

// Save bill to localStorage
function saveBill() {
    const billName = billNameInput.value.trim();
    if (!billName) {
        alert('Please enter a bill name');
        return;
    }

    if (items.length === 0) {
        alert('Please add at least one item before saving');
        return;
    }

    const bill = {
        id: Date.now(),
        name: billName,
        totalPaid: parseFloat(totalPaidInput.value) || 0,
        items: items.map(item => ({
            id: item.id,
            name: item.name || '',
            quantity: item.quantity ?? null,
            price: item.price,
            people: item.people || (item.person ? [item.person] : []),
            person: item.person || (item.people && item.people.length > 0 ? item.people[0] : '') // Keep for backward compatibility
        })),
        participants: [...dinnerGuests],
        receiptSummary,
        savedAt: new Date().toISOString()
    };

    // Get existing bills
    const savedBills = getSavedBills();

    // Check if name already exists
    const existingIndex = savedBills.findIndex(b => b.name === billName);
    if (existingIndex !== -1) {
        if (confirm(`A bill named "${billName}" already exists. Overwrite it?`)) {
            savedBills[existingIndex] = bill;
        } else {
            return;
        }
    } else {
        savedBills.push(bill);
    }

    // Save to localStorage
    localStorage.setItem('savedBills', JSON.stringify(savedBills));

    alert('Bill saved successfully!');
}

// Get saved bills from localStorage
function getSavedBills() {
    const saved = localStorage.getItem('savedBills');
    return saved ? JSON.parse(saved) : [];
}

// Display saved bills
function displaySavedBills() {
    const savedBills = getSavedBills();

    if (savedBills.length === 0) {
        savedBillsList.innerHTML = '<p class="placeholder">No saved bills yet</p>';
        return;
    }

    // Sort by saved date (newest first)
    savedBills.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    let html = '';
    savedBills.forEach(bill => {
        const date = new Date(bill.savedAt);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const itemCount = bill.items.length;
        const totalPaid = bill.totalPaid || 0;

        html += `
            <div class="saved-bill-item" data-id="${bill.id}">
                <div class="saved-bill-info">
                    <span class="saved-bill-name">${escapeHtml(bill.name)}</span>
                    <span class="saved-bill-meta">${itemCount} item${itemCount !== 1 ? 's' : ''} • $${totalPaid.toFixed(2)} • ${dateStr}</span>
                </div>
                <div class="saved-bill-actions">
                    <button type="button" class="btn btn-primary load-bill" data-id="${bill.id}">Load</button>
                    <button type="button" class="btn btn-danger delete-bill" data-id="${bill.id}">Delete</button>
                </div>
            </div>
        `;
    });

    savedBillsList.innerHTML = html;

    // Add event listeners
    document.querySelectorAll('.load-bill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            loadBill(id);
        });
    });

    document.querySelectorAll('.delete-bill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            deleteBill(id);
        });
    });

    // Allow clicking on the item to load
    document.querySelectorAll('.saved-bill-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn')) {
                const id = parseInt(item.dataset.id);
                loadBill(id);
            }
        });
    });
}

// Load a saved bill
function loadBill(id) {
    const savedBills = getSavedBills();
    const bill = savedBills.find(b => b.id === id);

    if (!bill) {
        alert('Bill not found');
        return;
    }

    // Clear receipt drafts so a loaded bill cannot inherit another dinner’s scan.
    resetReceipt();
    uploadedFile = null;
    receiptUpload.value = '';
    receiptImage.removeAttribute('src');
    receiptPreview.style.display = 'none';
    receiptSummary = bill.receiptSummary || null;

    // Clear current bill
    items = [];
    people = new Set();
    totalPaidInput.value = '';
    billNameInput.value = '';

    // Load bill data
    billNameInput.value = bill.name;
    totalPaidInput.value = bill.totalPaid || '';
    items = bill.items.map(item => ({
        id: item.id,
        name: item.name || '',
        quantity: item.quantity ?? null,
        price: item.price,
        people: item.people || (item.person ? [item.person] : []),
        person: item.person || (item.people && item.people.length > 0 ? item.people[0] : '') // Keep for backward compatibility
    }));

    // Update people set
    items.forEach(item => {
        const peopleList = item.people || (item.person ? [item.person] : []);
        peopleList.forEach(person => {
            if (person) {
                people.add(person);
            }
        });
    });

    // Refresh display
    displayItems();
    calculateResults();

    // Switch to current bill tab
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === 'current') {
            btn.click();
        }
    });

    dinnerGuests = [...new Set([...(bill.participants || []), ...items.flatMap(item => item.people || [])])];
    renderGuests();
    goToStep(4);
    alert('Bill loaded successfully!');
}

// Delete a saved bill
function deleteBill(id) {
    if (!confirm('Are you sure you want to delete this bill?')) {
        return;
    }

    const savedBills = getSavedBills();
    const filtered = savedBills.filter(b => b.id !== id);
    localStorage.setItem('savedBills', JSON.stringify(filtered));

    displaySavedBills();
}

// Parse receipt text to extract items and prices
function parseReceiptText(text) {
    // Store raw text for debugging
    window.lastReceiptText = text;

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedItemsList = [];
    const seenLines = new Set();
    const seenItems = new Set(); // Avoid duplicates

    // More comprehensive price patterns
    const pricePatterns = [
        /\$?\s*(\d+\.\d{2})\b/,      // $12.99 or 12.99 (with word boundary)
        /\$?\s*(\d+,\d{2})\b/,       // 12,99 (European format)
        /\$?\s*(\d+\.\d{1,2})\b/,    // 12.9 or 12.99
        /\$?\s*(\d+)\s*$/,           // $12 or 12 at end (whole dollars)
    ];

    // Skip patterns for totals/summaries
    const skipPatterns = [
        /^(TOTAL|GRAND\s+TOTAL|SUB\s*TOTAL|TAX|TIP|GRATUITY|AMOUNT|BALANCE|DUE|CHANGE|CASH|CARD|CREDIT|DEBIT)/i,
        /^(DATE|TIME|RECEIPT|INVOICE|ORDER|#|NO\.|NUMBER)/i,
        /^(THANK|YOU|VISIT|AGAIN|PLEASE|COME|BACK)/i,
        /^(\d{1,2}\/\d{1,2}\/\d{2,4})/, // Dates
        /^(\d{1,2}:\d{2})/,            // Times
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip header/footer/summary lines
        let shouldSkip = false;
        for (const pattern of skipPatterns) {
            if (pattern.test(line)) {
                shouldSkip = true;
                break;
            }
        }
        if (shouldSkip) continue;

        // Try multiple strategies to find price and item

        // Strategy 1: Price at end of line (most common)
        let price = null;
        let itemName = '';

        for (const pattern of pricePatterns) {
            const matches = [...line.matchAll(new RegExp(pattern.source, 'g'))];
            if (matches.length > 0) {
                // Take the last price found (usually the item price, not quantity)
                const lastMatch = matches[matches.length - 1];
                const potentialPrice = parseFloat(lastMatch[1].replace(',', '.'));

                // Validate price is reasonable (between $0.01 and $1000)
                if (potentialPrice >= 0.01 && potentialPrice <= 1000) {
                    price = potentialPrice;
                    itemName = line.substring(0, lastMatch.index).trim();
                    break;
                }
            }
        }

        // Strategy 2: Price in middle or beginning (less common but happens)
        if (!price) {
            for (const pattern of pricePatterns) {
                const match = line.match(pattern);
                if (match) {
                    const potentialPrice = parseFloat(match[1].replace(',', '.'));
                    if (potentialPrice >= 0.01 && potentialPrice <= 1000) {
                        price = potentialPrice;
                        // Try to extract item name - could be before or after price
                        const beforePrice = line.substring(0, match.index).trim();
                        const afterPrice = line.substring(match.index + match[0].length).trim();
                        itemName = beforePrice.length > afterPrice.length ? beforePrice : afterPrice;
                        break;
                    }
                }
            }
        }

        // Strategy 3: Check next line for price (item name on one line, price on next)
        if (!price && i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            for (const pattern of pricePatterns) {
                const match = nextLine.match(pattern);
                if (match) {
                    const potentialPrice = parseFloat(match[1].replace(',', '.'));
                    if (potentialPrice >= 0.01 && potentialPrice <= 1000) {
                        price = potentialPrice;
                        itemName = line.trim();
                        i++; // Skip next line since we used it
                        break;
                    }
                }
            }
        }

        // Strategy 4: Look for tab-separated or multi-space-separated columns
        if (!price) {
            // Split by multiple spaces or tabs
            const parts = line.split(/\s{2,}|\t/).filter(p => p.trim().length > 0);
            if (parts.length >= 2) {
                // Last part might be price
                for (let j = parts.length - 1; j >= 0; j--) {
                    const part = parts[j].trim();
                    for (const pattern of pricePatterns) {
                        const match = part.match(pattern);
                        if (match) {
                            const potentialPrice = parseFloat(match[1].replace(',', '.'));
                            if (potentialPrice >= 0.01 && potentialPrice <= 1000) {
                                price = potentialPrice;
                                itemName = parts.slice(0, j).join(' ').trim();
                                break;
                            }
                        }
                    }
                    if (price) break;
                }
            }
        }

        // Add item if we found a valid price (name is optional)
        if (price) {
            // Clean up item name if we have one, otherwise use default
            if (itemName) {
                itemName = itemName
                    .replace(/^\d+[xX*]\s*/, '')  // Remove quantity prefixes like "2x " or "2* "
                    .replace(/^\d+\.?\s*/, '')     // Remove leading numbers
                    .replace(/\s+/g, ' ')          // Normalize spaces
                    .trim();

                // Skip if name looks like a summary
                if (itemName.match(/^(TOTAL|SUBTOTAL|TAX|TIP|GRATUITY|AMOUNT)/i)) continue;
            } else {
                itemName = `Item ${parsedItemsList.length + 1}`;
            }

            // Create unique key to avoid duplicates (use price + index)
            const itemKey = `${price.toFixed(2)}_${i}`;
            if (seenItems.has(itemKey)) continue;
            seenItems.add(itemKey);

            seenLines.add(i);
            parsedItemsList.push({
                id: Date.now() + i,
                name: itemName || `Item ${parsedItemsList.length + 1}`,
                price: price,
                people: [],
                person: '' // Keep for backward compatibility
            });
        }
    }

    // If still very few items, try more aggressive parsing
    if (parsedItemsList.length < 3) {
        // Look for any line with a decimal number that could be a price
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (seenLines.has(i)) continue;

            // Skip if already processed or is a summary line
            let shouldSkip = false;
            for (const pattern of skipPatterns) {
                if (pattern.test(line)) {
                    shouldSkip = true;
                    break;
                }
            }
            if (shouldSkip) continue;

            // Find all decimal numbers
            const decimalNumbers = line.match(/\d+\.\d{1,2}|\d+,\d{1,2}/g);
            if (decimalNumbers) {
                for (const numStr of decimalNumbers) {
                    const num = parseFloat(numStr.replace(',', '.'));
                    if (num >= 0.01 && num <= 1000) {
                        const itemKey = `item_${num.toFixed(2)}`;
                        if (!seenItems.has(itemKey)) {
                            const itemName = line.replace(/\d+[.,]\d+/g, '').trim();
                            // Only skip if it's clearly a summary line, otherwise accept it
                            if (!itemName.match(/^(TOTAL|SUBTOTAL|TAX|TIP|GRATUITY|AMOUNT)/i)) {
                                seenItems.add(itemKey);
                                parsedItemsList.push({
                                    id: Date.now() + i + 10000,
                                    name: itemName || `Item ${parsedItemsList.length + 1}`,
                                    price: num,
                                    people: [],
                                    person: '' // Keep for backward compatibility
                                });
                                break; // Only take first reasonable price per line
                            }
                        }
                    }
                }
            }
        }
    }

    return parsedItemsList;
}


// Keep the original extracted subtotal comparison stable as rows are imported.
function updateReviewSummary() {
    if (!receiptSummary) return;
    const originalItems = receiptSummary.items || [];
    const importedSubtotal = items.reduce((sum, item) => sum + item.price, 0);
    const draftSubtotal = parsedItems.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
    const extractedSubtotal = originalItems.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
    const money = value => Number.isFinite(value) ? value.toFixed(2) : 'Not detected';
    const warnings = [...(receiptSummary.warnings || [])];
    if (Number.isFinite(receiptSummary.subtotal) && Math.abs(extractedSubtotal - receiptSummary.subtotal) > 0.02)
        warnings.push('Extracted items do not match the receipt subtotal. Check for missing items or discounts.');
    if (parsedItems.some(item => item.price <= 0)) warnings.push('Zero, unreadable or negative prices need correction. Resolve discounts manually before adding.');
    if (receiptSummary.currency && receiptSummary.currency !== 'USD') warnings.push('This bill splitter displays dollars. Confirm the currency before adding.');
    reviewSummary.innerHTML = `<div class="review-totals"><span>Extracted items <b>${money(extractedSubtotal)}</b></span><span>Receipt subtotal <b>${money(receiptSummary.subtotal)}</b></span><span>Tax <b>${money(receiptSummary.tax)}</b></span><span>Tip <b>${money(receiptSummary.tip)}</b></span><span>Receipt total <b>${money(receiptSummary.total)}</b></span></div>` +
        warnings.map(warning => `<p class="review-warning">${escapeHtml(warning)}</p>`).join('');
    useReceiptTotalBtn.hidden = !(receiptSummary.total > 0);
    const ready = parsedItems.filter(item => Number.isFinite(item.price) && item.price > 0).length;
    addAllParsedBtn.disabled = ready === 0;
    addAllParsedBtn.textContent = ready ? `Keep ${ready} reviewed item${ready === 1 ? '' : 's'}` : 'Correct prices to keep items';
    reviewStatus.textContent = `${parsedItems.length - ready} item(s) need a valid price. Current bill + draft: ${money(importedSubtotal + draftSubtotal)} before tax & tip.`;
}

function displayParsedItems() {
    parsedItemsContainer.innerHTML = parsedItems.map((item, index) => `
        <div class="parsed-item-row" data-index="${index}">
            <div class="line"><strong>Item ${index + 1}${item.needsReview ? ' · Check against photo' : ''}</strong><button type="button" class="btn btn-danger" data-remove="${index}">Remove</button></div>
            <div class="form-group"><label for="review-name-${index}">Item name</label><input id="review-name-${index}" data-field="name" data-index="${index}" value="${escapeAttribute(item.name)}"></div>
            <div class="review-fields">
                <div class="form-group"><label for="review-qty-${index}">Quantity</label><input type="number" min="0.01" step="any" id="review-qty-${index}" data-field="quantity" data-index="${index}" value="${item.quantity ?? ''}" placeholder="Unknown"></div>
                <div class="form-group"><label for="review-price-${index}">Line total</label><input type="number" min="0" step="0.01" id="review-price-${index}" data-field="price" data-index="${index}" value="${item.price.toFixed(2)}"></div>
            </div>
        </div>`).join('') || '<p class="placeholder">No remaining items. Add a missing item or scan another receipt.</p>';
    parsedItemsContainer.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => {
        const item = parsedItems[Number(input.dataset.index)];
        const field = input.dataset.field;
        if (field === 'people') item.people = [...new Set(input.value.split(',').map(name => name.trim()).filter(Boolean))];
        else if (field === 'price' || field === 'quantity') item[field] = Number(input.value) || 0;
        else item[field] = input.value;
        updateReviewSummary();
    }));
    parsedItemsContainer.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
        parsedItems.splice(Number(button.dataset.remove), 1);
        displayParsedItems();
    }));
    updateReviewSummary();
}

function escapeAttribute(value) {
    return escapeHtml(String(value)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// Dinner setup and navigation are separate from the original splitting calculation.
let dinnerGuests = [];
let currentStep = 0;
const flowSteps = [...document.querySelectorAll('[data-step]')];
const flowError = document.getElementById('flow-error');
const guestNameInput = document.getElementById('guest-name');
function showFlowError(message) {
    flowError.textContent = message;
    flowError.hidden = false;
}
function clearFlowError() {
    flowError.hidden = true;
    flowError.textContent = '';
}
function renderGuests() {
    document.getElementById('guest-list').innerHTML = dinnerGuests.map((name, index) =>
        `<span class="guest-chip">${escapeHtml(name)}<button type="button" data-guest-remove="${index}" aria-label="Remove ${escapeAttribute(name)}">×</button></span>`).join('');
    document.querySelectorAll('[data-guest-remove]').forEach(button => button.addEventListener('click', () => {
        const name = dinnerGuests[Number(button.dataset.guestRemove)];
        if (items.some(item => item.people?.includes(name)) && !confirm(`Remove ${name} and their item assignments?`)) return;
        dinnerGuests = dinnerGuests.filter(guest => guest !== name);
        items.forEach(item => { item.people = (item.people || []).filter(person => person !== name); });
        renderGuests();
    }));
}
function addGuests() {
    const names = guestNameInput.value.split(',').map(name => name.trim()).filter(Boolean);
    names.forEach(name => {
        if (!dinnerGuests.some(guest => guest.toLocaleLowerCase() === name.toLocaleLowerCase())) dinnerGuests.push(name);
    });
    guestNameInput.value = '';
    renderGuests();
    clearFlowError();
}
document.getElementById('add-guest').addEventListener('click', addGuests);
guestNameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); addGuests(); }
});
function renderAssignments() {
    document.getElementById('assignment-list').innerHTML = items.map((item, index) =>
        `<fieldset class="assignment-item"><legend>${escapeHtml(item.name || `Item ${index + 1}`)} · $${item.price.toFixed(2)}</legend><div class="assignment-choices">${dinnerGuests.map((name, personIndex) =>
            `<label><input type="checkbox" data-item="${index}" data-person="${personIndex}" ${(item.people || []).includes(name) ? 'checked' : ''}>${escapeHtml(name)}</label>`).join('')}</div></fieldset>`).join('');
    document.querySelectorAll('[data-person]').forEach(input => input.addEventListener('change', () => {
        const item = items[Number(input.dataset.item)];
        const name = dinnerGuests[Number(input.dataset.person)];
        const assigned = new Set(item.people || []);
        if (input.checked) assigned.add(name); else assigned.delete(name);
        item.people = [...assigned];
        clearFlowError();
    }));
}
function goToStep(step) {
    currentStep = step;
    clearFlowError();
    flowSteps.forEach(panel => { panel.hidden = Number(panel.dataset.step) !== step; });
    document.querySelectorAll('[data-progress]').forEach(label => {
        if (Number(label.dataset.progress) === step) label.setAttribute('aria-current', 'step');
        else label.removeAttribute('aria-current');
    });
    if (step === 1) displayItems();
    if (step === 2) renderAssignments();
    if (step === 3) {
        document.getElementById('bill-subtotal').textContent = `Items subtotal: $${items.reduce((sum, item) => sum + item.price, 0).toFixed(2)}`;
        useReceiptTotalBtn.hidden = !(receiptSummary?.total > 0);
    }
    if (step === 4) { calculateResults(); renderResultsDetails(); }
    flowSteps.find(panel => Number(panel.dataset.step) === step)?.querySelector('h1, h2')?.focus();
}
function nextStep() {
    if (currentStep === 0) {
        if (guestNameInput.value.trim()) addGuests();
        if (!dinnerGuests.length) return showFlowError('Add at least one person to continue.');
    }
    if (currentStep === 1) {
        if (parseReceiptBtn.disabled) return showFlowError('Wait for receipt scanning to finish or cancel it.');
        if (itemPriceInput.value || document.getElementById('item-name').value.trim()) return showFlowError('Add the item you’re entering, or clear its fields before continuing.');
        if (parsedItems.length) return showFlowError('Keep the reviewed receipt items or discard the remaining draft before continuing.');
        if (!items.length) return showFlowError('Add at least one item to continue.');
    }
    if (currentStep === 2 && items.some(item => !item.people?.length)) return showFlowError('Choose at least one person for every item.');
    if (currentStep === 3 && (!Number.isFinite(Number(totalPaidInput.value)) || Number(totalPaidInput.value) <= 0)) return showFlowError('Enter a total paid greater than zero.');
    goToStep(Math.min(4, currentStep + 1));
}
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', nextStep));
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => goToStep(Math.max(0, currentStep - 1))));
document.getElementById('reset-bill').addEventListener('click', () => {
    items = [];
    people = new Set();
    dinnerGuests = [];
    resetReceipt();
    uploadedFile = null;
    receiptUpload.value = '';
    receiptImage.removeAttribute('src');
    receiptPreview.style.display = 'none';
    [billNameInput, totalPaidInput, itemPriceInput, itemPersonInput, guestNameInput, document.getElementById('item-name')].forEach(input => { input.value = ''; });
    renderGuests();
    calculateResults();
    document.getElementById('results-details').replaceChildren();
    document.getElementById('assignment-list').replaceChildren();
    document.getElementById('parsed-items-container').replaceChildren();
    document.getElementById('review-summary').replaceChildren();
    document.getElementById('review-status').textContent = '';
    useReceiptTotalBtn.hidden = true;
    tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === 'current'));
    tabContents.forEach(panel => panel.classList.toggle('active', panel.id === 'current-bill'));
    goToStep(0);
    window.scrollTo({top: 0, behavior: 'instant'});
    guestNameInput.focus();
});
goToStep(0);


function renderResultsDetails() {
    const total = Number(totalPaidInput.value) || 0;
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const money = value => '$' + value.toFixed(2);
    const guests = [...new Set([...dinnerGuests, ...items.flatMap(item => item.people || [])])];
    const finalPrice = item => subtotal > 0 ? item.price / subtotal * total : 0;
    const summaryFields = [['Items subtotal', subtotal], ['Tax, tip & other adjustments', total - subtotal], ['Total paid', total]];
    const detected = receiptSummary ? ['subtotal', 'tax', 'tip', 'total'].filter(key => Number.isFinite(receiptSummary[key])).map(key =>
        `<div><dt>Receipt ${key}</dt><dd>${money(receiptSummary[key])}</dd></div>`).join('') : '';
    const receiptPhoto = uploadedFile && receiptImage.src ? `<details class="result-receipt"><summary>View original receipt photo</summary><img src="${escapeAttribute(receiptImage.src)}" alt="Original dinner receipt"></details>` : '';
    document.getElementById('results-details').innerHTML = `
        <section class="result-overview"><h2>${escapeHtml(billNameInput.value.trim() || 'Dinner summary')}</h2>
            <p class="helper">${guests.length} people · ${items.length} items</p>
            <p class="result-guests">${guests.map(escapeHtml).join(', ')}</p>
            <dl class="result-totals">${summaryFields.map(([label, value]) => `<div><dt>${label}</dt><dd>${money(value)}</dd></div>`).join('')}</dl>
        </section>
        <section class="result-item-list"><h2>All receipt items</h2>
        ${items.map((item, index) => `<article class="result-item"><div class="line"><strong>${escapeHtml(item.name || `Item ${index + 1}`)}</strong><span>${money(finalPrice(item))} <small>final</small></span></div>
            <p class="helper">${money(item.price)} before adjustments${item.quantity != null ? ` · Quantity: ${escapeHtml(String(item.quantity))}` : ''}</p>
            <p class="helper">Shared by: ${escapeHtml((item.people || []).join(', '))}</p></article>`).join('')}
        </section>
        <section class="result-breakdown"><h2>Each person’s breakdown</h2>
        ${guests.map(name => {
            const assigned = items.filter(item => item.people?.includes(name));
            const base = assigned.reduce((sum, item) => sum + item.price / item.people.length, 0);
            const final = assigned.reduce((sum, item) => sum + finalPrice(item) / item.people.length, 0);
            return `<article class="result-person"><h3>${escapeHtml(name)}</h3>${assigned.length ? assigned.map(item => `<div class="result-detail-row"><span>${escapeHtml(item.name || `Item ${items.indexOf(item) + 1}`)}${item.people.length > 1 ? ` <small>1/${item.people.length} share</small>` : ''}</span><span>${money(finalPrice(item) / item.people.length)}</span></div>`).join('') : '<p class="helper">No items assigned.</p>'}
                <dl class="result-totals"><div><dt>Before adjustments</dt><dd>${money(base)}</dd></div><div><dt>Tax, tip & other adjustments</dt><dd>${money(final - base)}</dd></div><div><dt>Total owed</dt><dd>${money(final)}</dd></div></dl></article>`;
        }).join('')}</section>
        ${detected ? `<section class="result-detected"><h2>Detected receipt amounts</h2><p class="helper">Scanned estimates, shown for reference. The split uses your total paid above.</p><dl class="result-totals">${detected}</dl></section>` : ''}
        ${receiptPhoto}`;
}
billNameInput.addEventListener('input', () => { if (currentStep === 4) renderResultsDetails(); });

document.getElementById('get-started').addEventListener('click', () => {
    document.getElementById('landing-page').classList.remove('active');
    document.getElementById('current-bill').classList.add('active');
    tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === 'current'));
    goToStep(0);
    window.scrollTo({top: 0, behavior: 'instant'});
    guestNameInput.focus();
});
