# Bill Splitter

A static bill splitter for desktop and mobile.

## GitHub Pages

Publish from the `main` branch root using repository Settings → Pages. The HTML, CSS, and JavaScript run directly in the browser; `server.py` is only for local previews. Saved bills stay on each device/browser and do not sync.

Run with Python 3.10+ (no packages needed):

```sh
python3 server.py
```

Open http://127.0.0.1:8001. Optionally set `PORT` to choose another local port. A static web server also works.

## Free receipt scanning

Upload a receipt photo and select **Scan receipt**. Tesseract OCR runs in your browser; the receipt image is not uploaded to a server. No account, API key, or paid service is required. Internet access is needed to download the Tesseract script, engine and language resources.

The guided flow starts with dinner guests, then receipt scanning or manual items, then person assignments, total paid, and the results. Review and correct extracted item names and line totals and compare the receipt subtotal with the extracted sum before keeping items. Assign people using the dinner guest checkboxes in the next step. Quantity is informational; the line total is the full price for that row. Tax, tip and total remain separate from purchased items. Apply the detected final total only after checking it includes what you actually paid. Items with invalid prices remain in review when other items are imported. Every kept item must be assigned before proceeding to total paid. Missing items can be added manually. Resolve discounts manually before importing because the splitter uses positive item prices.

Results include the complete item list, assignments, quantities when available, subtotal, adjustments, total paid, and each person’s itemized share. Detected receipt amounts are preserved with saved bills; the original photo is available only during the current dinner.

Use **Start over / clear bill** on the results screen to clear the current dinner, receipt and participants. Saved bills are preserved. Saved bills stay in browser local storage. The Python server only serves app assets; it does not accept receipt uploads.

## Checks

```sh
python3 -m unittest discover -s tests
node tests/receipt-ui.cjs
```

## iPhone / Home Screen

Open the hosted site in Safari, tap Share → Add to Home Screen, and enable Open as Web App if offered. The icon opens a standalone view. The layout adapts automatically to screen width and touch input; no device setting is needed. Use **Take receipt photo** for the rear camera or **Choose receipt photo** for an existing image (the browser controls available camera choices).

Price fields request a decimal keyboard. Forms use larger touch targets and respect iPhone safe areas. Saved bills remain local to the browser/web app; they do not sync, and existing Safari bills may not appear in the Home Screen app. Receipt scanning still needs internet access for OCR downloads. Offline support is not included.

## Saved people

On the People step, tap a saved name to add them to dinner. New names are remembered by default; uncheck **Remember new people for next time** for one-time guests. **Manage saved people** lets you rename or forget contacts. These changes affect future selections, not names or assignments on current or saved bills. Clearing a dinner keeps saved people. Contacts stay in this browser on this site's address, just like saved bills; they do not sync across devices.

## Local vision-model experiment

`tools/evaluate_receipt.py` benchmarks receipt photos against a local Ollama model, independently of the website. It sends images only to the loopback server, requests structured receipt data, and saves extraction, timing, and arithmetic diagnostics in ignored `.local-receipts/results/`. A matching subtotal alone does not prove an extraction is accurate; compare each item with the photo. No model output is imported into saved bills.

With Ollama installed and `qwen3-vl:8b` downloaded, start the local server on port 11435, then run:

```sh
OLLAMA_HOST=127.0.0.1:11435 ollama serve
python3 tools/evaluate_receipt.py /absolute/path/to/receipt.jpg
```

For this workspace's isolated runtime, use `.local-receipts/Ollama.app/Contents/Resources/ollama` and set `OLLAMA_MODELS` to the absolute `.local-receipts/models` directory. Set `OLLAMA_NO_CLOUD=1` to disable Ollama cloud features. Runtime files, model weights, and private evaluation outputs are ignored by Git. The GitHub Pages scanner remains unchanged.

## Saved bills home

The app opens to saved bills. Choose **new bill** to start a dinner. **View bill** opens a read-only results dialog with each person’s share and full bill details, without changing your current dinner or receipt draft. Close the dialog or press Escape to return. Saving a bill returns to this home screen.

Use the division-sign home icon to return to the bill list. During a dinner, **continue current bill** returns to the same step with your draft intact. The current draft is held in memory and does not survive refreshing the page.
