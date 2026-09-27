import React, { useState, useContext } from "react";
import { DataContext } from "../context/DataContext";
import AddStock from "../components/AddStock";
import FastImageCapture from "../components/FastImageCapture";
import { apiFetch } from "../utils/api";
import toast from "react-hot-toast";

export default function AddStockPage() {
  const { fetchInventory, suppliers, inventory } = useContext(DataContext);
  
  const [items, setItems] = useState([
    { id: Date.now(), name: "", sku: "", costPrice: "", quantity: "", sellingPrice: "", expiryDate: "", batchNumber: "" }
  ]);
  
  const [metadata, setMetadata] = useState({
    supplierId: "",
    invoiceNumber: "",
    orderDate: new Date().toISOString().split('T')[0],
    warehouse: "Main Pharmacy"
  });

  const [showCapture, setShowCapture] = useState(false);

  const handleFastSave = async (extractedData) => {
    try {
      const payload = {
        metadata: {
           supplier: "System Default / Fast Camera",
           warehouse: "Main Pharmacy",
           orderDate: new Date().toISOString().split('T')[0],
           invoiceNumber: "FC-" + Date.now()
        },
        items: [{
           id: Date.now(),
           name: extractedData.productName || "Unknown Box",
           sku: "AUTO-" + Math.floor(Math.random() * 1000),
           costPrice: "0",
           sellingPrice: "0",
           quantity: extractedData.quantity || "1",
           expiryDate: extractedData.expiryDate,
           batchNumber: extractedData.batchNumber
        }]
      };

      const res = await apiFetch("/api/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Rapid stock capture added successfully!");
        fetchInventory();
        setShowCapture(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || err.error || "Failed to add via capture");
      }
    } catch (err) {
      toast.error("Network error during rapid add");
    }
  };

  const handleNext = async () => {
    // Basic validation
    if (!metadata.supplierId) return toast.error("Please select a verified partner / supplier");
    
    const validItems = items.filter(i => i.name && i.quantity > 0);
    if (validItems.length === 0) return toast.error("Please add at least one valid item");

    try {
      const selectedSupplier = suppliers.find(s => s.id === parseInt(metadata.supplierId));
      
      const res = await apiFetch("/api/inventory/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: validItems,
          supplier: selectedSupplier ? selectedSupplier.name : "Unknown",
          warehouse: metadata.warehouse,
          invoiceNumber: metadata.invoiceNumber,
          receivedDate: metadata.orderDate
        })
      });

      if (res.ok) {
        toast.success("Stock batch imported successfully");
        fetchInventory();
        handleCancel(); // Reset form
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || err.error || "Failed to import stock");
      }
    } catch (err) {
      toast.error("Network error during stock import");
    }
  };

  const handleCancel = () => {
    setItems([{ id: Date.now(), name: "", sku: "", costPrice: "", quantity: "", sellingPrice: "", expiryDate: "", batchNumber: "" }]);
    setMetadata({
      supplierId: "",
      invoiceNumber: "",
      orderDate: new Date().toISOString().split('T')[0],
      warehouse: "Main Pharmacy"
    });
  };

  return (
    <>
      <AddStock
        items={items}
        setItems={setItems}
        metadata={metadata}
        setMetadata={setMetadata}
        onNext={handleNext}
        onCancel={handleCancel}
        suppliers={suppliers}
        inventory={inventory}
        onFastCapture={() => setShowCapture(true)}
      />
      
      {showCapture && (
          <FastImageCapture 
              onSave={handleFastSave}
              onClose={() => setShowCapture(false)}
          />
      )}
    </>
  );
}
