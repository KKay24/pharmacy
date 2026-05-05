import Fuse from 'fuse.js';

/**
 * Advanced heuristic parser integrating the "Blueprint" strategy (Stage 1-8).
 * Optimized for Lusaka Pharmchem style invoices with index anchors and PCS markers.
 */
export const parseInvoiceText = (text, existingInventory = [], suppliers = []) => {
    // Stage 0: Pre-process "blob" text (if newlines are missing or sparse)
    const preprocess = (txt) => {
        let processed = txt;
        // Insert newlines before common header markers
        processed = processed.replace(/(?:POWERED BY|QUOTE|Quote#|Quote\s*Date|Bill To|#\s+Item|Sub Total|Total|Notes|Terms\s*&\s*Conditions)/gi, (m) => `\n${m}`);
        
        // Insert newlines before row indices (e.g. " 1 COLDRID", " 2 WOODS")
        // This handles cases where multiple rows are merged into one long line
        processed = processed.replace(/\s+(\d{1,3}\b\s+[A-Z0-9])/g, '\n$1');
        
        return processed;
    };

    const segmentedText = preprocess(text);
    const rawLines = segmentedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const extractedItems = [];
    const metadata = { invoiceNumber: "", orderDate: "", supplierId: "" };
    
    // Fuzzy matching setup (Stage 6: 0.3 threshold as per Blueprint)
    const fuse = new Fuse(existingInventory, { 
        keys: ['name', 'genericName'], 
        threshold: 0.3 
    });

    const ocrFixNumber = (val) => {
        if (!val) return "";
        let fixed = val.toUpperCase().trim().replace(/[^A-Z0-9.-]/g, '');
        fixed = fixed.replace(/S/g, '5').replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1');
        return fixed.replace(/[^0-9.]/g, ''); 
    };

    const isNumeric = (val) => {
        const cleaned = ocrFixNumber(val);
        return cleaned && !isNaN(parseFloat(cleaned)) && isFinite(cleaned);
    };

    // Blueprint Stage 5: Regex cleanup
    const cleanBlueprintName = (line) => {
        let name = line
            .replace(/^\s*\d{1,3}[.-]?\s+/, '') // Remove leading row number
            .replace(/\bZMK\b/gi, '') // Remove standalone ZMK noise
            .replace(/(\d+\.\d+)\s*(?:PCS|Pcs|pcs|ZMK).*$/i, '') // Remove Qty + PCS and everything after
            .replace(/[|:|;].*$/, '') // Remove grid noise artifacts
            .trim();
        
        // Remove trailing "Pack Size" markers common in pharma (e.g. - 10*10, (100*10), 50*2)
        name = name.replace(/[-(\s]*\d{1,3}\s*\*\s*\d{1,3}[)\s]*$/, '').trim();
        name = name.replace(/[-(\s]*\d{1,3}\s*['"]\d{1,2}[)\s]*$/, '').trim(); // Handle 20's or 30's
        
        // Clean trailing dashes or punctuation that remains
        name = name.replace(/[-/]\s*$/, '').trim();
        
        return name;
    }

    let buffer = { nameParts: [], values: [] };

    rawLines.forEach((line) => {
        const upLine = line.toUpperCase();
        
        // Metadata (Stage 1) - Support Quote and Invoice labels
        if (!metadata.invoiceNumber) {
            const invMatch = line.match(/(?:Quote#|Invoice#|Invoice\s*No|QT-|INV-)[:#\s]*([A-Z0-9-]+)/i);
            if (invMatch) metadata.invoiceNumber = invMatch[1];
        }
        
        // Robust Date Extraction: Handle cases where label and date are segmented
        const datePattern = /(\d{1,2}\s+[A-Z]{3,9}\s+\d{2,4}|\d{4}[/.-]\d{2}[/.-]\d{2})/i;
        if (!metadata.orderDate) {
            const dateMatch = line.match(new RegExp(`(?:Quote\\s*Date|Invoice\\s*Date|Order\\s*Date)[:\\s]*${datePattern.source}`, 'i'));
            if (dateMatch) {
                const d = new Date(dateMatch[1]);
                if (!isNaN(d.getTime())) metadata.orderDate = d.toISOString().split('T')[0];
            } else if (upLine.includes('DATE')) {
                // Check next line if current line only has the label
                // Handled implicitly by searching for the pattern standalone on subsequent lines
            }
            
            // If date pattern found standalone on a line and we haven't found orderDate yet, assume it's the invoice date
            const standaloneDate = line.match(datePattern);
            if (standaloneDate && !metadata.orderDate) {
                 const d = new Date(standaloneDate[1]);
                 if (!isNaN(d.getTime())) metadata.orderDate = d.toISOString().split('T')[0];
            }
        }

        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return;

        // Skip rows that look like table headers (Blueprint Stage 4 refinement)
        if (upLine.includes('ITEM & DESCRIPTION') || upLine.includes('TAXABLE AMOUNT')) return;
        if (upLine.startsWith('POWERED BY') || upLine.includes('SUB TOTAL') || upLine.startsWith('TOTAL')) return;

        // Blueprint Stage 4: Detect item rows (starts with number)
        const hasIndex = /^\s*\d{1,3}\s*$/.test(parts[0]) || /^\d{1,3}[.-]/.test(parts[0]);
        const hasPCS = upLine.includes('PCS');
        
        // For pharma invoices, we strictly require the 'PCS' marker or a clear quantity decimal to avoid false positives
        const isNewRow = hasIndex && hasPCS;

        if (isNewRow) {
            if (buffer.nameParts.length > 0) extractedItems.push(finalize(buffer, fuse));
            
            // Start Blueprint extraction
            const extractedName = cleanBlueprintName(line);
            const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:PCS|Pcs|pcs)/i);
            
            if (qtyMatch) {
                buffer = {
                    nameParts: [extractedName],
                    values: [qtyMatch[1], ...parts.filter(p => isNumeric(p) && p !== qtyMatch[1])]
                };
            } else {
                buffer = { nameParts: [extractedName], values: parts.filter(isNumeric) };
            }
        } else if (buffer.nameParts.length > 0) {
            // Continuation logic (Filter out isolated labels)
            if (['ZMK', 'PCS', 'ZMK PCS', 'PCS', '#', 'QTY', 'RATE', 'AMOUNT'].includes(upLine)) return;
            
            const numParts = parts.filter(isNumeric);
            if (numParts.length >= 1 && hasPCS) {
                // If it's a numeric line on a row that likely has more values
                buffer.values = [...buffer.values, ...numParts];
            } else {
                const clean = cleanBlueprintName(line);
                if (clean.length > 2 && !upLine.includes('PAGE')) {
                   buffer.nameParts.push(clean);
                }
            }
        }
    });

    if (buffer.nameParts.length > 0) extractedItems.push(finalize(buffer, fuse));

    return { 
        items: extractedItems.filter(i => i.name.length > 3), 
        metadata 
    };
};

const finalize = (buffer, fuse) => {
    const fullName = buffer.nameParts.join(" ").trim();
    const results = fuse.search(fullName);
    const match = results.length > 0 ? results[0].item : null;
    
    const qty = buffer.values[0] || "1";
    const cost = buffer.values[1] || "0";

    return {
        id: Math.random().toString(36).substr(2, 9),
        name: match ? match.name : fullName,
        sku: match ? match.barcode : "",
        isExisting: !!match,
        costPrice: cost.replace(/[^0-9.]/g, ''),
        quantity: Math.floor(parseFloat(qty.replace(/[^0-9.]/g, '') || 1)).toString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        batchNumber: `AUTO-${Math.floor(Math.random() * 10000)}`,
        category: match ? match.category : "Tablets"
    };
};
