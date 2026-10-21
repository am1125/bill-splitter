const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
const storage = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {value:'',style:{},dataset:{},disabled:false,innerHTML:'',textContent:'', listeners:{},
    addEventListener(type, fn){this.listeners[type]=fn;}, querySelectorAll(){return [];}, classList:{add(){},remove(){},toggle(){}},
    setAttribute(name,value){this[name]=value;}, showModal(){this.open=true;},close(){this.open=false;},focus(){}, replaceChildren(){this.innerHTML='';}, removeAttribute(){}, appendChild(){},set textContent(value){this._text = value;},get textContent(){return this._text || '';}});
  return elements.get(id);
}
const document = {getElementById:element,querySelectorAll:()=>[],createElement:()=>{
  const div={};Object.defineProperty(div,'textContent',{set(value){div.innerHTML=String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}});return div;
}};
const context = vm.createContext({crypto:require("node:crypto").webcrypto,document, window:{scrollTo(){}}, console, fetch:async()=>({ok:true,json:async()=>({smartScan:false})}),setTimeout,clearTimeout,AbortController,confirm:()=>true,alert:()=>{},localStorage:{getItem:key=>storage.get(key) || null,setItem:(key,value)=>storage.set(key,value)},Set,Date,Math});
vm.runInContext(fs.readFileSync('script.js','utf8'),context);
const run = code => vm.runInContext(code,context);
// A short receipt must not be duplicated; identical real purchases stay separate.
assert.equal(run("parseReceiptText('Soup 10.00\\nTax 1.00\\nTotal 11.00').length"),1);
assert.equal(run("parseReceiptText('Soup 10.00\\nSoup 10.00\\nTotal 20.00').length"),2);
// Valid reviewed rows are imported before assignment; invalid prices stay in review.
run("parsedItems = [{name:'Soup',price:20,people:['Aaron'],quantity:2},{name:'Tea',price:10,people:[]},{name:'Discount',price:-2,people:['Aaron']}]; receiptSummary = {items:parsedItems.map(i=>({...i})),subtotal:28,total:36};");
element('add-all-parsed-btn').listeners.click();
assert.equal(run('items.length'),2);
assert.equal(run('parsedItems.length'),1);
assert.equal(run('items[0].price'),20);
assert.equal(run('items[0].name'),'Soup');
// Subsequent import doesn't add Soup twice, and original split math remains intact.
run("items[1].people=['Aaron','Bruce'];");
element('add-all-parsed-btn').listeners.click();
assert.equal(run('items.length'),2);
assert.equal(run('parsedItems.length'),1);
element('total-paid').value='36';
run('calculateResults()');
assert.match(element('results-container').innerHTML,/\$30\.00/);
assert.match(element('results-container').innerHTML,/\$6\.00/);
assert.equal(run('escapeAttribute(\'" onfocus="bad\')'),'&quot; onfocus=&quot;bad');
console.log('Receipt UI checks passed: no duplicates, pending rows preserved, line totals and split math intact.');

// Step validation and backtracking preserve current work.
run('items = []; parsedItems = []; dinnerGuests = []; currentStep = 0; nextStep();');
assert.equal(run('currentStep'),0);
assert.match(element('flow-error').textContent,/person/);
element('guest-name').value='Aaron, Bruce, aaron';
run('nextStep()');
assert.equal(run('dinnerGuests.length'),2);
assert.equal(run('currentStep'),1);
run('nextStep()');
assert.equal(run('currentStep'),1);
element('item-price').value='20'; element('item-name').value='Pasta';
run('addItem(); nextStep();');
assert.equal(run('currentStep'),2);
assert.equal(run('items[0].people.length'),0);
run('nextStep()');
assert.equal(run('currentStep'),2);
run("items[0].people=['Aaron']; nextStep();");
assert.equal(run('currentStep'),3);
element('total-paid').value='';
run('nextStep()');
assert.equal(run('currentStep'),3);
element('total-paid').value='24';
run('nextStep()');
assert.equal(run('currentStep'),4);
assert.match(element('results-container').innerHTML,/\$24\.00/);
element('bill-name').value='Flow test dinner';
run('saveBill()');
const savedBeforeReset = storage.get('savedBills');
assert.deepEqual(JSON.parse(savedBeforeReset)[0].participants,['Aaron','Bruce']);
run('goToStep(1)');
assert.equal(run('items.length'),1);
context.confirm = () => false; // Reset must not depend on a browser confirmation dialog.
element('reset-bill').listeners.click();
context.confirm = () => true;
assert.equal(run('currentStep'),0);
assert.equal(run('items.length'),0);
assert.equal(run('dinnerGuests.length'),0);
assert.equal(element('total-paid').value,'');
assert.equal(storage.get('savedBills'),savedBeforeReset);
run("items = [{id:123,name:'Unsaved soup',price:9,people:['Casey']}]; dinnerGuests=['Casey']; parsedItems=[{name:'Pending scan',price:3}];");
element('bill-name').value = 'Draft dinner';
run(`loadBill(${JSON.parse(savedBeforeReset)[0].id})`);
assert.equal(run('currentStep'),0);
assert.equal(run('items[0].name'),'Unsaved soup');
assert.equal(run('dinnerGuests[0]'),'Casey');
assert.equal(run('parsedItems[0].name'),'Pending scan');
assert.equal(element('bill-name').value,'Draft dinner');
assert.equal(element('saved-bill-dialog').open,true);
assert.match(element('saved-dialog-details').innerHTML,/All receipt items/);
assert.match(element('saved-dialog-details').innerHTML,/Pasta/);
assert.match(element('saved-dialog-details').innerHTML,/Before adjustments/);
assert.match(element('saved-dialog-summary').innerHTML,/Bruce/);
assert.match(element('saved-dialog-summary').innerHTML,/\$0\.00/);
assert.match(element('saved-dialog-summary').innerHTML,/\$24\.00/);
assert.equal(storage.get('savedBills'),savedBeforeReset);
element('close-saved-dialog').listeners.click();
assert.equal(element('saved-bill-dialog').open,false);
console.log('Guided flow checks passed: validation, backtracking, save/load, and reset preserving saved bills.');

// Saved contacts survive reset and reload; editing never rewrites bill snapshots.
element('remember-person').checked = true;
element('guest-name').value = 'Casey, casey';
run('addGuests()');
assert.equal(run('savedPeople.length'), 1);
const contactId = run('savedPeople[0].id');
assert.equal(run('readSavedPeople()[0].id'), contactId);
run(`renameSavedPerson(${JSON.stringify(contactId)}, 'Casey Jones')`);
assert.equal(run('savedPeople[0].id'), contactId);
assert.ok(run("dinnerGuests.includes('Casey')"));
assert.equal(storage.get('savedBills'), savedBeforeReset);
element('reset-bill').listeners.click();
assert.equal(run('savedPeople.length'), 1);
run(`addSavedPerson(${JSON.stringify(contactId)}); addSavedPerson(${JSON.stringify(contactId)})`);
assert.equal(run('dinnerGuests.length'), 1);
assert.equal(run('dinnerGuests[0]'), 'Casey Jones');
run(`removeSavedPerson(${JSON.stringify(contactId)})`);
assert.equal(run('savedPeople.length'), 0);
assert.equal(run('dinnerGuests[0]'), 'Casey Jones');
element('remember-person').checked = false;
element('guest-name').value = 'One-time guest';
run('addGuests()');
assert.equal(run('savedPeople.length'), 0);
storage.set('savedPeople', 'invalid JSON');
assert.equal(run('readSavedPeople().length'), 0);
console.log('Saved people checks passed: persistence, identity, duplicate prevention, opt-out, and historical names.');

// Switching entry methods preserves both manual and receipt drafts.
element('item-name').value = 'unfinished pasta';
run("parsedItems = [{name:'Soup',price:12}]; selectItemEntry('scan');");
assert.equal(element('scan-entry').hidden, false);
assert.equal(element('manual-entry').hidden, true);
run("selectItemEntry('manual');");
assert.equal(element('scan-entry').hidden, true);
assert.equal(element('manual-entry').hidden, false);
assert.equal(element('item-name').value, 'unfinished pasta');
assert.equal(run('parsedItems.length'), 1);
console.log('Entry card checks passed: switching preserves unfinished work.');

// Free scan still populates the review and detected receipt totals.
(async () => {
  context.Tesseract = {recognize:async()=>({data:{text:'Soup 20.00\nTea 10.00\nSubtotal 30.00\nTax 3.00\nTip 3.00\nTotal 36.00'}})};
  run('uploadedFile = {}; parsedItems = [];');
  await run('scanReceipt()');
  assert.equal(run('parsedItems.length'),2);
  assert.equal(run('receiptSummary.total'),36);
  assert.equal(element('parsed-items-section').style.display,'block');
  assert.equal(element('parse-receipt-btn').disabled,false);
  // Failures recover controls and preserve the existing draft.
  context.Tesseract = {recognize:async()=>{throw new Error('Unreadable image');}};
  await run('scanReceipt()');
  assert.equal(run('parsedItems.length'),2);
  assert.match(element('parsing-status').textContent,/Unreadable image/);
  assert.equal(element('upload-receipt-btn').disabled,false);
  // There must be no app code capable of calling the retired paid endpoint.
  assert.doesNotMatch(fs.readFileSync('script.js','utf8'),/fetch\s*\(|OPENAI|smartScan|scan-local-btn/);
  console.log('Free scan checks passed: review, totals, error recovery, and no paid requests.');
})().catch(error=>{console.error(error);process.exitCode=1;});
