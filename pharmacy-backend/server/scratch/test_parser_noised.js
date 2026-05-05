const rawText = `POWERED BY   1  LUSAKA PHARMCHEM SUPPLIES LIMITED  Tax ID : 2832834697 PLOT NO. 120, KATUNJILA ROAD, LUSAKA. PHONE NO.: +260776588384   QUOTE  Quote#   : QT-023795  Quote Date   : 07 Apr 2026  Expiry Date   : 11 Apr 2026 Bill To KHYELA PHARMACY  #   Item & Description   Qty   Rate   Amount Taxable Amount  1   COLDRID SYRUP -100ML ZMK 5.00 PCS 37.70   188.50   188.50 2   WOODS 50ML SYRUP-ADULT ZMK 3.00 PCS 40.04   120.12   120.12 3   HIV TEST KIT - OSCAR - 1s   10.00 PCS 12.40   124.00   124.00 4   BACTOCLAV DRY SYRUP - 100ML ZMK 5.00 PCS 24.22   121.10   121.10 5   PANADO SYRUP - 100ML ZMK 5.00 PCS 11.00   55.00   55.00 6   VIVIAN GEL - 30G   5.00 PCS 12.40   62.00   62.00 7   BENYLIN ORIGINAL SYRUP-100ML ZMK 3.00 PCS 142.14   426.42   426.42 8   RUFEN-200 TABS (BRUFEN) - 100*10   1.00 PCS 119.00   119.00   119.00 9   INDOMIN (INDOCID) - 10*10   1.00 PCS 14.80   14.80   14.80 10   PANADO TABS - 50*2 ZMK 1.00 PCS 31.38   31.38   31.38 11   ASPRIN 300 (DOLOPRIN) - 10*10   1.00 PCS 18.00   18.00   18.00 12   RUFEDOL - 10*10 ZMK 2.00 PCS 41.20   82.40   82.40 13   BRUSTAN TABS - 1*10   10.00 PCS 14.52   145.20   145.20 14   PROHIBIN CAPS (OMEPRAZOLE) 20MG - 10*10   1.00 PCS 18.00   18.00   18.00 15   OMLINK CAPS 20MG(10*10)-OMEPRAZOLE   1.00 PCS 18.80   18.80   18.80 16   CEVITE TABS - 10*10 ZMK 2.00 PCS 70.10   140.20   140.20 17   CEVITE SYRUP - 100ML ZMK 5.00 PCS 20.92   104.60   104.60 18   MAGNAVIT CAPS-2*15 ZMK 3.00 PCS 29.72   89.16   89.16 19   CADIPHEN EXPECTORANT - 100ML   5.00 PCS 20.40   102.00   102.00 20   EROS 10MG - 1*4   3.00 PCS 14.00   42.00   42.00 21   EROS 20MG - 1*4   3.00 PCS 28.00   84.00   84.00 22   PYRATRIN TABS (PYRANTEL) - (10*6)   5.00 PCS 60.00   300.00   300.00 23   AMLODIPINE 5MG TABS (KAUSIKH) - 10*10   2.00 PCS 15.40   30.80   30.80 24   AMCORE - 10 (AMLODIPINE BESYLATE-10MG) -10*10   2.00 PCS 30.04   60.08   60.08 25   ATELEB-50 (ATENOLOL TABLETS 50MG)   1.00 PCS 22.00   22.00   22.00
POWERED BY   2  Rounding   0.08  Total   ZMW3,561.50  Items in Total   121.00 Notes  Thanks for your business. Prepared By:___________________________ Checked By:___________________________  Terms & Conditions  * GOODS SUPPLIED ON NO CLAIM OR RETURN SHALL BE ACCEPTED AFTER 24 HOUR OF DELIVERY. * PRICES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE. * PLEASE CHECK YOUR GOODS & EXPIRY DATES BEFORE LEAVING COUNTER.  #   Item & Description   Qty   Rate   Amount Taxable Amount  26   ACEPRIL -5 (ENALAPRIL 5MG TABLETS)   1.00 PCS 66.00   66.00   66.00 27   MAPINOR TABS (NORETHISTERONE) - 10*10 ZMK 2.00 PCS 88.10   176.20   176.20 28   HCG - (MID-STREAM) - 1*5   2.00 PCS 44.00   88.00   88.00 29   ACNESOL CREAM - 25G   5.00 PCS 30.00   150.00   150.00 30   CORTILEB - HYDROCORTISONE CREAM   10.00 PCS 6.00   60.00   60.00 31   TRIPHEN HONEY & GINGER SYRUP - 100ML   10.00 PCS 20.40   204.00   204.00 32   ASHTON TEETHING POWDER - 20'S ZMK 2.00 PCS 66.00   132.00   132.00 33   WATER FOR INJ - 10'S   2.00 PCS 7.80   15.60   15.60 34   DIARSTOP TABS (ORFLOXACIN & ORNIDAZOLE) - 10*10   1.00 PCS 90.00   90.00   90.00 35   NITRILE - (EXAMINATION GLOVES - MEDIUM) - POWDER FREE   1.00 PCS 60.06   60.06   60.06  Sub Total   3,561.42   ZMW3,561.42`;

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

const cleanBlueprintName = (line) => {
    let name = line
        .replace(/^\s*\d{1,3}[.-]?\s+/, '') // Remove leading row number
        .replace(/\bZMK\b/gi, '') // Remove standalone ZMK noise
        .replace(/(\d+(?:\.\d+)?)\s*(?:PCS|Pcs|pcs|ZMK).*$/i, '') // Remove Qty + PCS and everything after
        .replace(/[|:|;].*$/, '') // Remove grid noise artifacts
        .trim();
    
    // Remove trailing "Pack Size" markers common in pharma (e.g. - 10*10, (100*10), 50*2)
    name = name.replace(/[-(\s]*\d{1,3}\s*\*\s*\d{1,3}[)\s]*$/, '').trim();
    name = name.replace(/[-(\s]*\d{1,3}\s*['"]\d{1,2}[)\s]*$/, '').trim(); // Handle 20's or 30's
    
    // Clean trailing dashes or punctuation that remains
    name = name.replace(/[-/]\s*$/, '').trim();
    
    return name;
}

const finalize = (buffer) => {
    const fullName = buffer.nameParts.join(" ").trim();
    const qty = buffer.values[0] || "1";
    return { name: fullName, quantity: qty };
};

const parseInvoiceText = (text) => {
    // Stage 0: Pre-process "blob" text (if newlines are missing or sparse)
    const preprocess = (txt) => {
        let processed = txt;
        processed = processed.replace(/(?:POWERED BY|QUOTE|Quote#|Quote\s*Date|Bill To|#\s+Item|Sub Total|Total|Notes|Terms\s*&\s*Conditions)/gi, (m) => `\n${m}`);
        processed = processed.replace(/\s+(\d{1,3}\b\s+[A-Z0-9])/g, '\n$1');
        return processed;
    };

    const segmentedText = preprocess(text);
    const rawLines = segmentedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const extractedItems = [];
    const metadata = { invoiceNumber: "", orderDate: "" };
    
    let buffer = { nameParts: [], values: [] };

    rawLines.forEach((line) => {
        const upLine = line.toUpperCase();
        
        if (!metadata.invoiceNumber) {
            const invMatch = line.match(/(?:Quote#|Invoice#|Invoice\s*No|QT-|INV-)[:#\s]*([A-Z0-9-]+)/i);
            if (invMatch) metadata.invoiceNumber = invMatch[1];
        }
        
        const datePattern = /(\d{1,2}\s+[A-Z]{3,9}\s+\d{2,4}|\d{4}[/.-]\d{2}[/.-]\d{2})/i;
        if (!metadata.orderDate) {
            const dateMatch = line.match(new RegExp(`(?:Quote\\s*Date|Invoice\\s*Date|Order\\s*Date)[:\\s]*${datePattern.source}`, 'i'));
            if (dateMatch) {
                metadata.orderDate = dateMatch[1];
            } else {
                const standaloneDate = line.match(datePattern);
                if (standaloneDate) metadata.orderDate = standaloneDate[1];
            }
        }

        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return;

        if (upLine.includes('ITEM & DESCRIPTION') || upLine.includes('TAXABLE AMOUNT')) return;
        if (upLine.startsWith('POWERED BY') || upLine.includes('SUB TOTAL') || upLine.startsWith('TOTAL')) return;

        const hasIndex = /^\s*\d{1,3}\s*$/.test(parts[0]) || /^\d{1,3}[.-]/.test(parts[0]);
        const hasPCS = upLine.includes('PCS');
        
        const isNewRow = hasIndex && hasPCS;

        if (isNewRow) {
            if (buffer.nameParts.length > 0) extractedItems.push(finalize(buffer));
            const extractedName = cleanBlueprintName(line);
            const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:PCS|Pcs|pcs)/i);
            
            if (qtyMatch) {
                buffer = {
                    nameParts: [extractedName],
                    values: [qtyMatch[1]]
                };
            } else {
                buffer = { nameParts: [extractedName], values: parts.filter(isNumeric) };
            }
        } else if (buffer.nameParts.length > 0) {
            if (['ZMK', 'PCS', 'ZMK PCS', 'PCS', '#', 'QTY', 'RATE', 'AMOUNT'].includes(upLine)) return;
            const numParts = parts.filter(isNumeric);
            if (numParts.length >= 1 && hasPCS) {
                buffer.values = [...buffer.values, ...numParts];
            } else {
                const clean = cleanBlueprintName(line);
                if (clean.length > 2 && !upLine.includes('PAGE')) {
                    buffer.nameParts.push(clean);
                }
            }
        }
    });

    if (buffer.nameParts.length > 0) extractedItems.push(finalize(buffer));
    return { items: extractedItems.filter(i => i.name.length > 3), metadata };
};

const result = parseInvoiceText(rawText);
console.log('--- OCR FINAL VERIFICATION (REFINED) ---');
console.log('Metadata:', result.metadata);
console.log('Total Items Extracted:', result.items.length);
result.items.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.quantity}] ${item.name}`);
});
