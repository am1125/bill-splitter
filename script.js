// Store items and people
let items = [];
let people = new Set();

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

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

