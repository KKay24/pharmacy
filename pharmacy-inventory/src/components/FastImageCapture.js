import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Upload, Loader, Check, Edit2 } from 'lucide-react';
import Tesseract from 'tesseract.js';

export default function FastImageCapture({ onSave, onClose, categories = [] }) {
    const [viewMode, setViewMode] = useState('capture'); // capture, processing, confirm
    const [stream, setStream] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    
    const [scanProgress, setScanProgress] = useState('');
    const [formData, setFormData] = useState({
        productName: '',
        mainCategoryId: '',
        subcategoryId: '',
        productFormId: '',
        batchNumber: '',
        expiryDate: '',
        quantity: '1'
    });
    
    const [ocrConfidence, setOcrConfidence] = useState({ batch: 'high', expiry: 'high' });
    const selectedCategory = categories.find((category) => String(category.id) === formData.mainCategoryId);
    const selectedSubcategory = selectedCategory?.subcategories.find(
        (subcategory) => String(subcategory.id) === formData.subcategoryId
    );

    const updateClassification = (field, value) => {
        setFormData((current) => ({
            ...current,
            [field]: value,
            ...(field === 'mainCategoryId' ? { subcategoryId: '', productFormId: '' } : {}),
            ...(field === 'subcategoryId' ? { productFormId: '' } : {}),
        }));
    };

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }, [stream]);

    const startCamera = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Camera access denied or unavailable', err);
        }
    }, [videoRef]);

    // Initialize Camera on Mount if in capture mode
    useEffect(() => {
        if (viewMode === 'capture') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [viewMode, startCamera, stopCamera]);

    const handleSnap = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        processImage(imageDataUrl);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            processImage(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const processImage = async (imageSrc) => {
        setViewMode('processing');
        setScanProgress('Initializing Engine...');
        
        try {
            const { data } = await Tesseract.recognize(
                imageSrc,
                'eng',
                { logger: m => {
                    if (m.status === 'recognizing text') {
                        setScanProgress(`Scanning ${Math.round(m.progress * 100)}%`);
                    }
                }}
            );
            
            extractData(data.text);
            setViewMode('confirm');
        } catch (err) {
            console.error('OCR Failed', err);
            // Fallback to manual
            setViewMode('confirm');
        }
    };

    const extractData = (text) => {
        const rawText = text.replace(/\n/g, ' ');
        
        // Match: Batch, Lot, B/N, BN followed by separators and alphanumerics
        const batchRegex = /(?:Batch|Lot|B\/N|BN)[\s:\-#.]*([A-Z0-9-]{4,15})/i;
        const batchMatch = rawText.match(batchRegex);
        
        // Match: Exp, Expiry, ED followed by MM/YYYY or DD/MM/YYYY or YYYY-MM
        const expRegex = /(?:Exp|Expiry|ED)[\s:\-#.]*([0-9]{2,4}[/-][0-9]{2,4}(?:[/-][0-9]{2,4})?)/i;
        const expMatch = rawText.match(expRegex);
        
        let extractedBatch = '';
        let extractedExp = '';
        
        if (batchMatch && batchMatch[1]) extractedBatch = batchMatch[1];
        if (expMatch && expMatch[1]) extractedExp = expMatch[1];
        
        setFormData(prev => ({
            ...prev,
            batchNumber: extractedBatch,
            expiryDate: formatExpiry(extractedExp)
        }));
        
        setOcrConfidence({
            batch: extractedBatch ? 'high' : 'low',
            expiry: extractedExp ? 'high' : 'low'
        });
    };

    const formatExpiry = (rawDate) => {
        // Very basic formatter just to dump valid strings into date picker if possible
        if (!rawDate) return '';
        // If it's pure text, try to instantiate date. If invalid, leave blank.
        const dt = new Date(rawDate);
        if (!isNaN(dt.getTime())) {
            return dt.toISOString().split('T')[0];
        }
        return rawDate; // Fallback, might not bind to date input perfectly but editable
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = selectedSubcategory?.forms.find(
            (item) => String(item.id) === formData.productFormId
        );
        onSave({ ...formData, productFormName: form?.name });
    };

    return (
        <div className="crm-sidebar-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="crm-sidebar" style={{ width: '450px', maxHeight: '90vh', borderRadius: '12px', right: 'auto', position: 'relative' }}>
                <div className="crm-side-header">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Fast Stock Capture</h2>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Scan box to auto-read batch & expiry</span>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                <div className="crm-side-body" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                    {viewMode === 'capture' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', height: '300px', position: 'relative' }}>
                                {stream ? (
                                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ color: 'white', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                        Loading Camera...
                                    </div>
                                )}
                            </div>
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            
                            <button className="asm-btn asm-btn-primary" onClick={handleSnap} style={{ padding: '1rem', justifyContent: 'center' }}>
                                <Camera size={20} /> Snap Photo
                            </button>
                            
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
                                <hr style={{ flex: 1, borderColor: '#e2e8f0' }} />
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>OR</span>
                                <hr style={{ flex: 1, borderColor: '#e2e8f0' }} />
                            </div>

                            <input type="file" id="fast-upload" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                            <label htmlFor="fast-upload" className="asm-btn asm-btn-secondary" style={{ justifyContent: 'center' }}>
                                <Upload size={18} /> Upload Image File
                            </label>
                            
                            <button onClick={() => setViewMode('confirm')} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
                                Skip to Manual Entry
                            </button>
                        </div>
                    )}

                    {viewMode === 'processing' && (
                        <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <Loader className="spin" size={48} color="var(--primary)" />
                            <h3 style={{ margin: 0, color: '#1e293b' }}>{scanProgress}</h3>
                            <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Extracting metadata...</p>
                        </div>
                    )}

                    {viewMode === 'confirm' && (
                        <form id="fast-stock-form" onSubmit={handleSubmit}>
                            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label>Product Name (Optional)</label>
                                    <input className="asm-input" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} placeholder="e.g. Amoxicillin 500mg" />
                                </div>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label>Main Category *</label>
                                    <select className="asm-input" required value={formData.mainCategoryId} onChange={e => updateClassification('mainCategoryId', e.target.value)}>
                                        <option value="">Select main category...</option>
                                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                </div>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label>Subcategory</label>
                                    <select className="asm-input" disabled={!selectedCategory} value={formData.subcategoryId} onChange={e => updateClassification('subcategoryId', e.target.value)}>
                                        <option value="">Select subcategory...</option>
                                        {selectedCategory?.subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                                    </select>
                                </div>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label>Product Form</label>
                                    <select className="asm-input" disabled={!selectedSubcategory} value={formData.productFormId} onChange={e => updateClassification('productFormId', e.target.value)}>
                                        <option value="">Select product form...</option>
                                        {selectedSubcategory?.forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
                                    </select>
                                </div>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Batch Number
                                        {ocrConfidence.batch === 'low' && <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>Needs Review</span>}
                                    </label>
                                    <input className="asm-input" required value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} placeholder="B/N" style={{ borderColor: ocrConfidence.batch === 'low' && formData.batchNumber === '' ? '#f59e0b' : '#e2e8f0' }} />
                                </div>
                                <div className="asm-field" style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Expiry Date (YYYY-MM-DD)
                                        {ocrConfidence.expiry === 'low' && <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>Needs Review</span>}
                                    </label>
                                    <input className="asm-input" type="text" required value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} placeholder="e.g. 2026-12-01" style={{ borderColor: ocrConfidence.expiry === 'low' && formData.expiryDate === '' ? '#f59e0b' : '#e2e8f0' }} />
                                </div>
                                <div className="asm-field">
                                    <label>Quantity *</label>
                                    <input className="asm-input" type="number" min="1" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {viewMode === 'confirm' && (
                    <div className="crm-side-footer" style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
                        <button type="button" className="asm-btn asm-btn-secondary" style={{ flex: 1 }} onClick={() => setViewMode('capture')}>
                            <Edit2 size={16} /> Retake
                        </button>
                        <button type="submit" form="fast-stock-form" className="asm-btn asm-btn-primary" style={{ flex: 2 }}>
                            <Check size={18} /> Save Item
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
