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
