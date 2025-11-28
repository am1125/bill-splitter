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

// Store the uploaded file for OCR processing
let uploadedFile = null;

// Receipt upload handlers
uploadReceiptBtn.addEventListener('click', () => receiptUpload.click());

receiptUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Validate file type - Tesseract.js works best with PNG, JPEG, BMP
        const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/webp', 'image/gif'];
        if (!file.type.startsWith('image/')) {
            parsingStatus.textContent = 'Please select an image file (PNG, JPEG, BMP, WebP, or GIF)';
            receiptUpload.value = '';
            return;
        }
        
        // Warn about potentially unsupported formats
        if (!supportedTypes.includes(file.type.toLowerCase())) {
            parsingStatus.textContent = 'Warning: This format may not work well. PNG or JPEG recommended.';
        } else {
            parsingStatus.textContent = '';
        }
        
        uploadedFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            receiptImage.src = event.target.result;
            receiptPreview.style.display = 'block';
            if (!parsingStatus.textContent.includes('Warning')) {
                parsingStatus.textContent = '';
            }
        };
        reader.onerror = () => {
            parsingStatus.textContent = 'Error reading file';
            uploadedFile = null;
        };
        reader.readAsDataURL(file);
    }
});

cancelUploadBtn.addEventListener('click', () => {
    receiptUpload.value = '';
    uploadedFile = null;
    receiptPreview.style.display = 'none';
    parsedItemsSection.style.display = 'none';
    parsedItems = [];
    parsingStatus.textContent = '';
});

parseReceiptBtn.addEventListener('click', async () => {
    if (!uploadedFile && (!receiptImage.src || receiptImage.src === window.location.href)) {
        parsingStatus.textContent = 'Please upload a receipt image first';
        return;
    }
    
    // Check if Tesseract is loaded
    if (typeof Tesseract === 'undefined') {
        parsingStatus.textContent = 'Error: Tesseract.js library not loaded. Please refresh the page.';
        return;
    }
    
    parsingStatus.textContent = 'Loading OCR engine... This may take a moment.';
    parseReceiptBtn.disabled = true;
    
    try {
        let imageSource;
        
        // Prefer using the File object directly
        if (uploadedFile) {
            imageSource = uploadedFile;
        } else if (receiptImage.src && receiptImage.src.startsWith('data:')) {
            // If we have a data URL, create a blob from it
            const response = await fetch(receiptImage.src);
            const blob = await response.blob();
            imageSource = blob;
        } else {
            // Fallback to image src
            imageSource = receiptImage.src;
        }
        
        parsingStatus.textContent = 'Processing image...';
        
        const result = await Tesseract.recognize(imageSource, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = m.progress || 0;
                    parsingStatus.textContent = `Processing: ${Math.round(progress * 100)}%`;
                } else if (m.status === 'loading tesseract core') {
                    parsingStatus.textContent = 'Loading OCR engine...';
                } else if (m.status === 'initializing tesseract') {
                    parsingStatus.textContent = 'Initializing...';
                } else if (m.status) {
                    parsingStatus.textContent = m.status + '...';
                }
            }
        });
        
        const text = result?.data?.text || result?.text || '';
        
        if (!text || text.trim().length === 0) {
            parsingStatus.textContent = 'No text found in image. Please try a clearer photo.';
            parseReceiptBtn.disabled = false;
            return;
        }
        
        parsingStatus.textContent = 'Parsing receipt data...';
        const items = parseReceiptText(text);
        parsedItems = items;
        displayParsedItems();
        parsedItemsSection.style.display = 'block';
        parsingStatus.textContent = `Found ${items.length} items. Check console (F12) to see raw OCR text if needed.`;
        console.log('Raw OCR Text:', text);
        console.log('Parsed Items:', items);
    } catch (error) {
        const errorMsg = error?.message || error?.toString() || String(error) || 'Unknown error';
        parsingStatus.textContent = 'Error processing receipt: ' + errorMsg;
        console.error('OCR Error:', error);
        console.error('Error details:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            uploadedFile: !!uploadedFile,
            imageSrc: receiptImage.src?.substring(0, 50)
        });
    } finally {
        parseReceiptBtn.disabled = false;
    }
});

addAllParsedBtn.addEventListener('click', () => {
    parsedItems.forEach(item => {
        if (item.price > 0 && item.person) {
            const itemId = Date.now() + Math.random();
            items.push({
                id: itemId,
                price: item.price,
                person: item.person
            });
            if (item.person) {
                people.add(item.person);
            }
        }
    });
    displayItems();
    calculateResults();
    
    // Clear parsed items
    parsedItems = [];
    parsedItemsSection.style.display = 'none';
    receiptUpload.value = '';
    receiptPreview.style.display = 'none';
});

clearParsedBtn.addEventListener('click', () => {
    parsedItems = [];
    parsedItemsSection.style.display = 'none';
    displayParsedItems();
});

// Add a new item from the form inputs
function addItem() {
    const price = parseFloat(itemPriceInput.value) || 0;
    const person = itemPersonInput.value.trim();

    // Require both price and person
    if (price <= 0 || !person) {
        return; // Don't add items without both price and person
    }

    const itemId = Date.now();
    items.push({
        id: itemId,
        price: price,
        person: person
    });

    // Update people set
    if (person) {
        people.add(person);
    }

    // Clear the input fields
    itemPriceInput.value = '';
    itemPersonInput.value = '';

    // Refresh display and calculations
    displayItems();
    calculateResults();
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

        itemsHTML += `
            <div class="item-display">
                <div class="item-info">
                    <span class="item-price-display">$${item.price.toFixed(2)}</span>
                    ${item.person ? `<span class="item-person-display">${escapeHtml(item.person)}</span>` : '<span class="item-person-display no-person">No person</span>'}
                </div>
                ${totalPaid > 0 ? `<div class="item-final-price">$${finalPrice.toFixed(2)}</div>` : ''}
                <button type="button" class="btn btn-danger remove-item" data-id="${item.id}">Remove</button>
            </div>
        `;
    });

    itemsContainer.innerHTML = itemsHTML;

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            removeItem(id);
        });
    });
}

// Remove an item
function removeItem(id) {
    const item = items.find(i => i.id === id);
    if (item && item.person) {
        // Check if this person has other items
        const hasOtherItems = items.some(i => i.id !== id && i.person === item.person);
        if (!hasOtherItems) {
            people.delete(item.person);
        }
    }
    
    items = items.filter(i => i.id !== id);
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

    // Group by person and sum
    const personTotals = {};
    itemsWithFinalPrice.forEach(item => {
        if (item.person) {
            if (!personTotals[item.person]) {
                personTotals[item.person] = 0;
            }
            personTotals[item.person] += item.finalPrice;
        }
    });

    // Display results
    if (Object.keys(personTotals).length === 0) {
        resultsContainer.innerHTML = '<p class="placeholder">Add people to items to see who owes what</p>';
        return;
    }

    let resultsHTML = '';
    
    // Sort people alphabetically
    const sortedPeople = Object.keys(personTotals).sort();
    
    sortedPeople.forEach(person => {
        const amount = personTotals[person];
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
            price: item.price,
            person: item.person
        })),
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
    billNameInput.value = '';
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
        price: item.price,
        person: item.person
    }));
    
    // Update people set
    items.forEach(item => {
        if (item.person) {
            people.add(item.person);
        }
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
    const items = [];
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
        /^(TOTAL|SUBTOTAL|TAX|TIP|GRATUITY|AMOUNT|BALANCE|DUE|CHANGE|CASH|CARD|CREDIT|DEBIT)/i,
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
                itemName = `Item ${items.length + 1}`;
            }
            
            // Create unique key to avoid duplicates (use price + index)
            const itemKey = `${price.toFixed(2)}_${i}`;
            if (seenItems.has(itemKey)) continue;
            seenItems.add(itemKey);
            
            items.push({
                id: Date.now() + i,
                name: itemName || `Item ${items.length + 1}`,
                price: price,
                person: ''
            });
        }
    }
    
    // If still very few items, try more aggressive parsing
    if (items.length < 3) {
        // Look for any line with a decimal number that could be a price
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
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
                                items.push({
                                    id: Date.now() + i + 10000,
                                    name: itemName || `Item ${items.length + 1}`,
                                    price: num,
                                    person: ''
                                });
                                break; // Only take first reasonable price per line
                            }
                        }
                    }
                }
            }
        }
    }
    
    return items;
}

// Display parsed items in editable format
function displayParsedItems() {
    if (parsedItems.length === 0) {
        parsedItemsContainer.innerHTML = '<p class="placeholder">No items parsed</p>';
        return;
    }
    
    let html = '';
    parsedItems.forEach((item, index) => {
        html += `
            <div class="parsed-item-row" data-index="${index}">
                <div class="parsed-item-fields">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="font-size: 0.85rem;">Price</label>
                            <input type="number" class="parsed-item-price" value="${item.price.toFixed(2)}" step="0.01" min="0" data-index="${index}" style="width: 100%; padding: 6px 0; border: none; border-bottom: 1px solid rgba(0,0,0,0.2); background: transparent; font-size: 0.9rem;">
                        </div>
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="font-size: 0.85rem;">Person</label>
                            <input type="text" class="parsed-item-person" value="${escapeHtml(item.person)}" placeholder="Enter name" data-index="${index}" style="width: 100%; padding: 6px 0; border: none; border-bottom: 1px solid rgba(0,0,0,0.2); background: transparent; font-size: 0.9rem;">
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    parsedItemsContainer.innerHTML = html;
    
    document.querySelectorAll('.parsed-item-price').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            parsedItems[index].price = parseFloat(e.target.value) || 0;
        });
    });
    
    document.querySelectorAll('.parsed-item-person').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            parsedItems[index].person = e.target.value.trim();
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

